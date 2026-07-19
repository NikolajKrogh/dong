# Research: Configure Room and Start Game

**Feature**: 018-configure-start-game · **Date**: 2026-06-28

Decisions resolving the unknowns in implementation planning. Each decision includes: Decision, Rationale, and Alternatives Considered.

---

## R1. Match Selection Source & Persistence

- **Decision**: The host fetches the sports fixtures catalog via the unauthenticated `GET /v1/matches` endpoint of the Java proxy backend `command-api/`. Once selected, matches are stored durably in the room by calling a new `SECURITY DEFINER` Supabase RPC `public.add_room_match` which inserts a row into `public.matches`, writes a `'match_added'` gameplay event to maintain an audit trail, and bumps `last_activity_at`. Removing a match calls `public.remove_room_match` which deletes any associated participant assignments and the match row itself.
- **Rationale**: Keeps database writes secure, atomic, and validated. Direct insert policies on public tables would bypass validation and lack auditable event triggers.
- **Alternatives considered**: Direct INSERT/DELETE access policies on the `public.matches` table. Rejected because it's less secure, bypasses validation triggers, doesn't generate audit-trail gameplay events, and violates the "use RPC for shared-state mutations" principle (Constitution II).

## R2. Designated Common Match Management

- **Decision**: The host designates a match as the "Common Match" by calling a secure RPC `public.set_common_match(session_id uuid, match_id uuid)`. This updates `game_sessions.common_match_id` directly in Supabase Postgres. An event of type `'common_match_selected'` is logged. If the common match is deleted from the room, `common_match_id` is set to `NULL` via foreign key cascade or explicit trigger cleaning.
- **Rationale**: A room must have exactly one common match. Writing the selection to the database ensures that all participants can view the same common match on their screens when the lobby snapshot is fetched.
- **Alternatives considered**: Keeping the common match selection client-side until the game is started. Rejected because all players need to see which match is designated as the common match in the lobby, requiring live database synchronization.

## R3. Participant Match Assignments

- **Decision**: Assignments are synchronized via `public.set_room_assignments(session_id uuid, assignments jsonb)` which accepts an array of `{ participantId: "...", matchId: "..." }`. The RPC deletes any existing assignments for the session in `public.assignments` and inserts the new ones, then publishes an `'assignment_replaced'` event.
- **Rationale**: Bulk synchronization avoids multi-request sequence issues when setting up player-to-match assignments, particularly with automated random assignment. Making it atomic guarantees consistent states.
- **Alternatives considered**: Individual `add_assignment` and `remove_assignment` RPCs. Rejected because they are chattier over the network and risk concurrency inconsistency during bulk randomization.

## R4. Java Command vs. Supabase RPC for Game Commencement

- **Decision**: The host triggers starting the game by submitting a signed POST command to the Java proxy: `POST /v1/rooms/{roomId}/commands/start-game`.
  The Java backend `start-game` CommandHandler reads the room snapshot from the Supabase RPC `/rest/v1/rpc/get_room_snapshot` on behalf of the host (by forwarding the host's JWT Bearer token).
  Java then validates five cross-aggregate rules:
  1. Room state must be `'joinable'::public.session_state`.
  2. There must be at least 1 participant.
  3. There must be at least 1 selected match.
  4. There must be a valid common match designated in `common_match_id` which corresponds to one of the selected matches.
  5. Every active participant in the lobby roster must have at least one assigned match (excluding the Common Match).
  If validation passes, Java executes a Supabase RPC `public.start_game_session(session_id uuid)` to transition the session's state in PostgreSQL to `'in_progress'` and emit the `'session_started'` gameplay event.
- **Rationale**: Retains the architected boundary (Constitution Principle IV) where the Java API layer is the authority for cross-aggregate validation, orchestration, and commands, whilst Supabase remains the canonical data store.
- **Alternatives considered**: Passing all validation on the client and triggering state transition directly from the client via Supabase REST. Rejected because client-side state is easily bypassed or manipulated, violating the Server-Authoritative Shared State principle (Constitution II).

## R5. Propagating the Start Game State to Clients

- **Decision**: Participants' devices polling the lobby snapshot via `useRoomLobby` will detect when the snapshot `state` transitions to `'in_progress'`. Once detected, the client automatically triggers navigation to the active gameplay dashboard `/gameProgress` and clears the local room cache if needed.
- **Rationale**: Reuses the periodic 4-second snapshot polling already active in `useRoomLobby`. Requires no heavy realtime subscriptions or WebSockets, complying with the project's scalability and cost guidelines.
- **Alternatives considered**: Implementing Supabase Realtime subscriptions just for state transitions. Skype/realtime subscriptions are overkill when 4-second polling already recovers and syncs state reliably, presenting a much smaller footprint.

## R6. Forwarding Host Credentials from Java Proxy to Supabase

- **Decision**: To let the Java `command-api` make API calls on behalf of the host, we will extend the `AuthenticatedHost` record to include the raw Bearer JWT token validated by `SupabaseJwtFilter`. The `StartGameCommandHandler` will then inject this JWT in the `Authorization` header when making RestClient requests to Supabase REST / RPC endpoints.
- **Rationale**: Completely stateless. Executes all queries of the host under the host's specific Postgres credentials, honoring database RLS policies and access controls automatically without introducing any dangerous service-role secrets in the Java space.
- **Alternatives considered**: Storing the Supabase `service_role` key in Java and running database updates as an administrator. Rejected because it exposes a major elevation-of-privilege risk to the proxy and bypasses client RLS defenses.

## R7. Idempotent, Exactly-Once Command Processing (Constitution II)

`start-game` (T030) is the first state-mutating `CommandHandler` wired into the Java dispatcher. `NoOpIdempotencyService`'s own docstring and `IdempotencyStubGuardTest` (ADR-7, issue #133) are a deliberate guardrail: the test fails the build the moment a second handler is registered while idempotency is still format-validation-only, forcing whoever adds the first mutating command to replace the no-op store "in the same change." This feature is that change, so it must land a persistent dedup implementation — not relax or delete the guard.

- **Decision**: Two layers, addressing two different failure modes:
  1. **Command-level dedup (dispatch layer)** — replace `NoOpIdempotencyService` with a Postgres-backed `PersistentIdempotencyService`. Before invoking a handler, `CommandDispatcher` reserves the `(idempotencyKey)` via a new RPC `public.reserve_command_idempotency(p_idempotency_key uuid, p_command_type text, p_room_id uuid)`, called under the host's own forwarded JWT (R6) — not a service-role credential; this bookkeeping table gets the same `auth.uid()`-scoped `SECURITY DEFINER` treatment as every other RPC in this feature (see data-model.md). Outcomes:
     - New key → `reserved`: the dispatcher calls the handler. On success, persists the resulting `CommandResult` via `public.complete_command_idempotency(...)`. On a handler exception (validation failure — `CommandResult` has no failure variant), calls `public.release_command_idempotency(...)` to delete the reservation and rethrows, so a failed attempt is never cached and a same-key retry re-runs validation from scratch.
     - Same `commandType` + `roomId`, already completed → `replay`: the dispatcher returns the stored (always-successful) result directly and does **not** re-invoke the handler — a byte-for-byte replay, satisfying "exactly once."
     - Same `commandType` + `roomId`, still in flight (the literal double-click: request 2 arrives before request 1's `complete`/`release` call) → `in_flight`: **not an error**. The dispatcher polls `reserve_command_idempotency` a few times with a short bounded backoff until it either flips to `replay` (original succeeded — return that cached success) or the reservation is released (original failed — this caller now proceeds to invoke the handler itself, as if it were the first request). FR-013 and the spec.md "Concurrent start commands" edge case both require the success path to end in success, not a conflict.
     - Different `commandType`/`roomId` reusing the same key → `conflict`: terminal client error, `409 IDEMPOTENCY_KEY_REUSE`. This is the only outcome that is actually an error.
  2. **Mutation-level conflict handling (RPC)** — `start_game_session` additionally takes a `SELECT ... FOR UPDATE` row lock on the target `game_sessions` row before checking state. This closes the race where two *different* idempotency keys (e.g. two devices, or a host double-clicking fast enough to generate two keys) both pass Java-side validation concurrently against a `joinable` room: only one transaction wins the lock and performs the `joinable → in_progress` transition; the other sees `state <> 'joinable'` and is correctly rejected with `INVALID_ROOM_STATE` — a genuine conflict, not a replay, so it must not be silently "made safe."
- **Rationale**: The dispatch-layer store is command-type-agnostic and protects every future mutating command (post-#133), matching ADR-7's stated design ("a Decorator on the dispatch path"). The RPC-level lock is required regardless of the Java store because two legitimately-different idempotency keys can never be deduplicated by a key-based store — only the database's own row-locking can serialize them. A Postgres-backed (not Java in-memory) store is chosen per Constitution IV (Supabase-first, durable storage; also correct if `command-api` ever scales to multiple instances). It is deliberately **not** a `service_role`-backed store: R6 already rejected putting a service-role secret in the Java process, and this bookkeeping table doesn't need one — `auth.uid()`-scoped `SECURITY DEFINER` functions work exactly as well here as they do for `find_active_room_for`.
- **Alternatives considered**:
  - *Delegate dedup purely to `public.gameplay_events`'s existing `(session_id, idempotency_key)` unique index* (already used by `026_guest_room_join.sql`/`033_host_leave.sql` for internal event dedup), skipping the Java-level store. Rejected as the *sole* mechanism — it only protects whichever RPC happens to write a gameplay event and leaves every other command unprotected at the dispatch boundary, contradicting the seam's command-agnostic purpose. It is not needed as a second layer here because the `FOR UPDATE` lock above already provides the mutation-level backstop.
  - *Relax or delete `IdempotencyStubGuardTest` to unblock wiring a second handler.* Rejected — that test is the mechanism that makes this gap visible; routing around it would silently reintroduce the double-submit bug the edge case in spec.md and SC-005 explicitly guard against.

### Idempotency / conflict-handling for the other new RPCs (Constitution II applies to each)

- **`add_room_match`**: NOT naturally idempotent — two calls would insert two rows for the same fixture. **Decision**: add a unique constraint on `(session_id, source_provider, source_match_id)`; a repeat add of an already-selected fixture is caught (`unique_violation`) and treated as a no-op success returning the existing match's id, per FR-014.
- **`remove_room_match`**: naturally idempotent. Removing a match that no longer exists (already removed) is a no-op success rather than an error.
- **`set_common_match`**: naturally idempotent. Re-designating the currently-set match is a no-op; designating a different one replaces it (already the intended behavior per US2 AC2).
- **`set_room_assignments`**: naturally idempotent by construction — it is always a full delete + replace of the session's assignments, so replays converge to the same end state without extra handling.

## R8. `in_progress` Idle/Abandonment Policy — Explicit Deferral

- **Decision**: This feature does not define an idle/abandonment policy for rooms in the `in_progress` state. It is explicitly out of scope (see spec.md "Out of Scope") and deferred to #138/#165.
- **Rationale**: `private.expire_stale_rooms()` (migration `034_room_expiry.sql`) only sweeps `game_sessions` where `state = 'joinable'::public.session_state`. Because 018 is the first feature that makes `in_progress` reachable, shipping it without acknowledging this gap would silently leave abandoned in-progress rooms alive forever. Recording the deferral here (rather than staying silent) keeps the gap tracked instead of accidentally discovered later.
- **Alternatives considered**: Extending the 24-hour sweep in this feature to also close stale `in_progress` rooms. Rejected — out of scope for issue #134, and #138/#165 likely need different heuristics for "abandoned" during active gameplay (e.g. time since last scoring event) than for an idle lobby.

## R9. `find_active_room_for` Regression Check

- **Decision**: No code change is required. `private.find_active_room_for` (migration `032_room_membership_rpcs.sql`) filters `WHERE gs.state NOT IN ('completed', 'closed')`, which already includes `in_progress`. A pgTAP test is added (see tasks.md) to lock in this behavior now that `in_progress` becomes reachable for the first time, rather than relying on it being "probably fine."
- **Rationale**: Issue #134 explicitly calls out verifying this function once `in_progress` is reachable. A regression test is cheap insurance against a future migration narrowing that filter without realizing `in_progress` rooms must still resolve as "active" for the one-room-per-account guard and reconnect flow.
