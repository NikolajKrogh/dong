# RPC Contracts: Configure Room and Start Game

All RPCs are PL/pgSQL/SQL `SECURITY DEFINER`, `SET search_path = ''`, fully schema-qualified, with a thin `public` wrapper delegating to a `private` function. Grants are exact (no `anon`/`PUBLIC` unless stated). Response payloads are `jsonb` or plain identifiers.

---

## `public.add_room_match(p_session_id uuid, p_source_provider text, p_source_match_id text, p_home_team_name text, p_away_team_name text, p_kickoff_at timestamptz) → uuid`

- **Caller**: `authenticated` only (`GRANT EXECUTE TO authenticated`).
- **Preconditions**: Caller is the owner of the session. Room must be in `joinable` state.
- **Behavior**: Inserts a new match into `public.matches`. Writes a `'match_added'` event into `public.gameplay_events`.
- **Idempotency/conflict-handling**: unique constraint on `(session_id, source_provider, source_match_id)`. Repeat-adding the same fixture is a no-op success returning the existing match id (no duplicate row, no duplicate event) — see FR-014, data-model.md.
- **Response**: The UUID of the (new or pre-existing) match row.

## `public.remove_room_match(p_session_id uuid, p_match_id uuid) → void`

- **Caller**: `authenticated` only.
- **Preconditions**: Caller is the owner of the session. Room must be in `joinable` state. Match must exist in the session.
- **Behavior**:
  1. Deletes any assignments for the match from `public.assignments`.
  2. If the match is the designated common match (`common_match_id` on `game_sessions`), sets `common_match_id = NULL`.
  3. Deletes the match from `public.matches`.
- **Idempotency/conflict-handling**: naturally idempotent — removing an already-removed/non-existent match is a no-op success.
- **Response**: `void`.

## `public.set_common_match(p_session_id uuid, p_match_id uuid) → void`

- **Caller**: `authenticated` only.
- **Preconditions**: Caller is the owner of the session. Room must be in `joinable` state. Match must exist in the matches table for the session.
- **Behavior**: Highlights and designates the match as the room's global Common Match by updating `game_sessions.common_match_id = p_match_id`. Writes a `'common_match_selected'` event to `public.gameplay_events`.
- **Idempotency/conflict-handling**: naturally idempotent — re-designating the already-current common match is a no-op success (no duplicate event).
- **Response**: `void`.

## `public.set_room_assignments(p_session_id uuid, p_assignments jsonb) → void`

- **Caller**: `authenticated` only.
- **Preconditions**: Caller is the owner of the session. Room must be in `joinable` state. All participant IDs and match IDs referenced in `p_assignments` must belong to the session.
- **Behavior**:
  1. Deletes all existing assignments for `p_session_id` in `public.assignments`.
  2. Inserts new assignments parsed from `p_assignments`.
  3. Writes an `'assignment_replaced'` event to `public.gameplay_events`.
- **Idempotency/conflict-handling**: naturally idempotent by construction (full delete + replace); replaying the same payload converges to the same end state.
- **Response**: `void`.

## `public.start_game_session(p_session_id uuid, p_idempotency_key uuid) → jsonb`

- **Caller**: `authenticated` (internal orchestration — called by the Java Command service forwarding the host's own bearer token; see research.md R6).
- **Preconditions**: Room must be in `joinable` state.
- **Behavior**:
  1. Takes a `SELECT ... FOR UPDATE` lock on the `game_sessions` row for `p_session_id`.
  2. If `state <> 'joinable'`, raises `invalid_room_state`.
  3. Updates `game_sessions.state = 'in_progress'::public.session_state`.
  4. Writes a `'session_started'` event to `public.gameplay_events`, using `p_idempotency_key` in the event's `idempotency_key` value.
  5. Returns `jsonb_build_object('status', 'started', 'sessionId', p_session_id::text)`.
- **Idempotency/conflict-handling**: the `FOR UPDATE` lock is the mutation-level backstop against two *different* idempotency keys racing on the same room (research.md R7). End-to-end exactly-once behavior for a *repeated* client request (same key) is handled one layer up, by the dispatch-layer `command_idempotency` store (see `reserve_command_idempotency`/`complete_command_idempotency` below) — this RPC is not re-invoked at all on replay.
- **Response**: `jsonb` (`{ "status": "started", "sessionId": "<uuid>" }`).

## `public.reserve_command_idempotency(p_idempotency_key uuid, p_command_type text, p_room_id uuid) → jsonb`

- **Caller**: `authenticated` only — called by the Java command-api's dispatch layer forwarding the host's own bearer token (R6), same as every other RPC in this feature. `host_account_id` is set from `auth.uid()` internally, not passed by the caller.
- **Preconditions**: none beyond authentication.
- **Behavior**: Inserts a reservation row into `public.command_idempotency`. See data-model.md for the four possible outcomes (`reserved` / `replay` / `in_flight` / `conflict`).
- **Response**: `jsonb` (`{ "outcome": "reserved" | "replay" | "in_flight" | "conflict", "responseStatus": ..., "responseDetail": ... }`) so `CommandDispatcher` knows whether to invoke the handler, replay a cached result, poll-and-wait (`in_flight`), or reject with `409 IDEMPOTENCY_KEY_REUSE` (`conflict`).

## `public.complete_command_idempotency(p_idempotency_key uuid, p_response_status text, p_response_detail jsonb) → void`

- **Caller**: `authenticated` only, same forwarded-host-token model as above.
- **Preconditions**: Caller must own the reservation (`host_account_id = auth.uid()`).
- **Behavior**: Fills in `response_status`/`response_detail`/`completed_at` on the row reserved by `reserve_command_idempotency`, making the result available for future replays of the same key. Called only on handler **success** — `CommandResult` has no failure variant.
- **Response**: `void`.

## `public.release_command_idempotency(p_idempotency_key uuid) → void`

- **Caller**: `authenticated` only, same forwarded-host-token model as above.
- **Preconditions**: Caller must own the reservation (`host_account_id = auth.uid()`).
- **Behavior**: Deletes the reservation row outright. Called when the handler throws instead of returning a `CommandResult` (e.g. a validation failure), so a failed attempt is never cached/replayed and the same `Idempotency-Key` can be retried from scratch.
- **Response**: `void`.
