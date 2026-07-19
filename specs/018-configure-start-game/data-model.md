# Data Model: Configure Room and Start Game

**Feature**: 018-configure-start-game · **Date**: 2026-06-28

One new table (`public.command_idempotency`, see below) backs the command-dispatch idempotency store (R7); otherwise we leverage the existing schema and add a series of clean, validated RPCs.

---

## Existing Schema Leveraged

### `public.game_sessions`
- `state`: transitions from `'joinable'::public.session_state` (lobby) to `'in_progress'::public.session_state` (gameplay).
- `common_match_id`: points to the chosen common match.

### `public.matches`
- Stores selected matches within a session.
- Composite Key: `(session_id, id)`.

### `public.assignments`
- Map linking participants to their assigned matches in a session.
- Primary Key: `(session_id, participant_id, match_id)`.

### `public.gameplay_events`
- Records immutable gameplay events: `'match_added'`, `'common_match_selected'`, `'assignment_replaced'`, `'session_started'`.
- All writes trigger `bump_room_last_activity` which bumps `last_activity_at` automatically.

---

## Room State Machine (Updated)

```text
                 add_room_match, set_assignments
                 ┌───────────────┐
                 ▼               │
[created] ──> joinable ──────────┘
                 │  │
                 │  ├── start-game (validated by command-api) ──> in_progress
                 │  │
                 │  └── (lobby presence/handover transitions...)
                 │
                 └── in_progress ──> completed / closed
```

Transition to `'in_progress'` lock-protects the room config. No more matches can be added or assignments modified once the game is running.

---

## Gameplay Events & Payloads

When mutations are executed via the database RPCs, they populate appropriate gameplay events:

### `match_added`
- Payload: `{ "matchId": "<uuid>", "homeTeamName": "...", "awayTeamName": "..." }`

### `common_match_selected`
- Payload: `{ "commonMatchId": "<uuid>" }`

### `assignment_replaced`
- Payload: `{ "assignments": [...] }`

### `session_started`
- Payload: `{ "startedAt": "<timestamptz>" }`

---

## New Schema: `public.command_idempotency`

Backs the dispatch-layer idempotency store (research.md R7). One row per `Idempotency-Key` ever seen by the Java command-api.

```sql
CREATE TABLE public.command_idempotency (
    idempotency_key uuid PRIMARY KEY,
    command_type    text NOT NULL,
    room_id         uuid NOT NULL,
    host_account_id uuid NOT NULL,
    response_status text,              -- NULL while reserved-but-not-yet-completed
    response_detail jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);
```

Both RPCs are `authenticated`-only `SECURITY DEFINER` functions that set `host_account_id := auth.uid()` internally, following the same pattern as `private.find_active_room_for`/`get_my_active_room` (migration `032_room_membership_rpcs.sql`). Per R6, the Java `command-api` calls them under the host's own forwarded JWT — **not** a `service_role` credential; there is no reason for this bookkeeping table to be the one RPC pair that reintroduces a service-role secret into the Java process. RLS on the table scopes select/insert to rows where `host_account_id = auth.uid()`.

- `reserve_command_idempotency` inserts a row with `response_status = NULL` (reservation). If the insert conflicts on `idempotency_key`, the function compares the existing row's `(command_type, room_id)` to the incoming request and returns one of three outcomes:
  - **`replay`** — same `command_type` + `room_id`, `response_status IS NOT NULL`: the dispatcher returns the stored `response_status`/`response_detail` directly and does not invoke the handler. Only successes are ever stored here (see below), so this is always a cached success.
  - **`in_flight`** — same `command_type` + `room_id`, `response_status IS NULL`: a genuine concurrent double-submit (the scenario in spec.md's "Concurrent start commands" edge case and FR-013). This is **not** an error. See "Resolving an in-flight duplicate" below.
  - **`reserved`** — no conflict: a fresh key; the dispatcher proceeds to invoke the handler.
  - **`conflict`** — different `command_type` or `room_id` for an existing key: terminal key reuse across unrelated commands, mapped to `409 IDEMPOTENCY_KEY_REUSE`. This is the only outcome that is a client error.
- `complete_command_idempotency` fills in `response_status`/`response_detail`/`completed_at` on the reserved row **only when the handler succeeds** — `CommandResult` has no failure variant, so there is nothing else to cache.
- `release_command_idempotency` deletes the reservation row outright. Called when the handler throws (a validation failure such as `INVALID_ROOM_STATE`): a failed attempt is never replayed, and a subsequent request with the same key re-runs validation from scratch as if it were the first attempt. This also means an in-flight poller (below) that outlives a released reservation should itself proceed to reserve and run the handler, rather than treating "reservation vanished" as an error.

### Resolving an in-flight duplicate (FR-013)

A single Postgres statement cannot block across the separate stateless RPC calls that make up "reserve → run handler → complete/release" (each is its own PostgREST connection), so the wait is handled at the Java dispatch layer, which already owns orchestration (Constitution IV): on `in_flight`, `PersistentIdempotencyService` polls `reserve_command_idempotency` a few times with a short bounded backoff (sub-second budget, e.g. 5 attempts / ~500ms total). Two ways out:
  - The outcome flips to `replay` → the original succeeded; return that cached success. This is the primary double-click scenario and never surfaces an error.
  - The outcome flips to `reserved` (the original failed and was released) → this caller now owns the reservation and proceeds to invoke the handler itself, exactly as if it were the first request.
If the budget is exhausted without either resolution (e.g. the original request's process crashed mid-flight without reaching `complete`/`release` — an operational edge case, not a validation failure), the dispatcher fails the second request with the existing `503 SERVICE_UNAVAILABLE` ("try again") rather than a misleading conflict code.

## Supabase RPC Interfaces

All database RPCs are `SECURITY DEFINER` and run under `search_path = ''`.

### `public.add_room_match`
```sql
public.add_room_match(
    p_session_id uuid,
    p_source_provider text,
    p_source_match_id text,
    p_home_team_name text,
    p_away_team_name text,
    p_kickoff_at timestamptz
) RETURNS uuid
```
- Inserts match into `public.matches`.
- Emits a `'match_added'` gameplay event.
- Returns the generated match UUID.
- **Idempotency/conflict-handling (FR-014)**: `public.matches` has a unique constraint on `(session_id, source_provider, source_match_id)`. On `unique_violation`, the function does not raise — it returns the existing match's id as a no-op success instead of inserting a duplicate or emitting a second `match_added` event.

### `public.remove_room_match`
```sql
public.remove_room_match(
    p_session_id uuid,
    p_match_id uuid
) RETURNS void
```
- Deletes assignments associated with the match from `public.assignments`.
- If the match was the common match (`common_match_id`), sets `game_sessions.common_match_id = NULL`.
- Deletes match from `public.matches`.
- **Idempotency/conflict-handling**: naturally idempotent. If `p_match_id` does not exist (already removed by a prior call), the function returns successfully without raising and without emitting a duplicate event.

### `public.set_common_match`
```sql
public.set_common_match(
    p_session_id uuid,
    p_match_id uuid
) RETURNS void
```
- Validates the match exists in the session.
- Updates `game_sessions.common_match_id = p_match_id`.
- Emits a `'common_match_selected'` gameplay event.
- **Idempotency/conflict-handling**: naturally idempotent. If `p_match_id` already equals the current `common_match_id`, the function is a no-op success and does not emit a duplicate event.

### `public.set_room_assignments`
```sql
public.set_room_assignments(
    p_session_id uuid,
    p_assignments jsonb
) RETURNS void
```
- Deletes existing rows for `p_session_id` in `public.assignments`.
- Inserts new assignments based on array entries in `p_assignments`.
- Emits an `'assignment_replaced'` gameplay event.
- **Idempotency/conflict-handling**: naturally idempotent by construction — always a full delete + replace, so replaying the same `p_assignments` payload converges to the same end state.

### `public.start_game_session`
```sql
public.start_game_session(
    p_session_id uuid,
    p_idempotency_key uuid
) RETURNS jsonb
```
- Takes a `SELECT ... FOR UPDATE` row lock on the `game_sessions` row for `p_session_id` before checking state, so two concurrent callers for the same room serialize instead of racing (see research.md R7).
- If `state <> 'joinable'`, raises `invalid_room_state` (mapped by the Java handler to `422 INVALID_ROOM_STATE`) — this covers both a stale start attempt and the losing side of the race above.
- Otherwise: updates `game_sessions.state = 'in_progress'::public.session_state`, emits a `'session_started'` gameplay event (using `p_idempotency_key` as part of the event's `idempotency_key` value, consistent with the `(session_id, idempotency_key)` unique index on `public.gameplay_events`), and returns `jsonb_build_object('status', 'started', 'sessionId', p_session_id::text)`.
- `join_code` is left as-is (not cleared/nulled). Guests reconnecting to an already-`in_progress` room still resolve via the existing join-code/active-room lookup path (`private.find_active_room_for`, R9) rather than fresh joins, which are separately blocked by `FR-009`'s `joinable`-only guard on the join RPCs.
- **Idempotency/conflict-handling**: mutation-level backstop only — end-to-end exactly-once semantics for a *repeated* client request are provided by the dispatch-layer `command_idempotency` store (R7), which short-circuits a replay before this RPC is even called a second time. This RPC's own job is the concurrency backstop for two *different* idempotency keys racing on the same room.
