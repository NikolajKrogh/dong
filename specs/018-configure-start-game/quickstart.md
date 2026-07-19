# Quickstart: Configure Room and Start Game

**Feature**: 018-configure-start-game · **Date**: 2026-06-28

How to validate the feature end-to-end once implemented. Contracts: [contracts/room-rpcs.md](contracts/room-rpcs.md) · [contracts/start-game-api.md](contracts/start-game-api.md). Schema: [data-model.md](data-model.md).

---

## Prerequisites

1. Docker running and local Supabase stack active: `npm run db:start`
2. Migrations applied cleanly: `npm run db:reset`
3. Running local Java `command-api` backend:
   ```bash
   cd command-api
   $env:SUPABASE_JWT_SECRET="test-secret-which-is-at-least-thirty-two-bytes-long"
   $env:SUPABASE_URL="http://localhost:9"
   .\mvnw.cmd spring-boot:run
   ```
4. Expo dev client or web running: `npx expo start --web`

---

## Database Layer (pgTAP)

Run database tests to confirm RPC logic, events emission, and integrity rules:

```bash
npm run db:test
```

Expected passing assertions for new test plans:
- `220_add_room_match` — adding a match inserts into `public.matches` and emits `'match_added'` event; repeat-adding the same fixture is a no-op success, not a duplicate row (FR-014).
- `230_remove_room_match` — removing a match purges assignments, clears `common_match_id` if it was common, and clears the match row; removing an already-removed match is a no-op success.
- `240_set_common_match` — setting a common match updates `game_sessions` and logs `'common_match_selected'`; re-setting the same match is a no-op.
- `250_set_room_assignments` — synchronizing assignments purges previous layouts, saves new assignments, and logs `'assignment_replaced'`.
- `260_start_game_session` — transitioning room to `in_progress` sets status and emits `'session_started'`; a second call while already `in_progress` fails `invalid_room_state` (the row-lock/state-guard, not the dispatch-layer dedup).
- `270_command_idempotency` — `reserve_command_idempotency`/`complete_command_idempotency` cover all four outcomes: `reserved`, `replay`, `in_flight`, `conflict` (research.md R7).
- `280_find_active_room_for_in_progress` — `private.find_active_room_for` still resolves a session once `state = 'in_progress'` (research.md R9).

---

## Service Layer (JUnit / Integration)

Verify that the Java `command-api` correctly intercepts the incoming command, fetches the lobby snapshot, parses and validates against all five cross-aggregate rules, and commands Supabase on success:

```powershell
cd command-api
.\mvnw.cmd test -Dtest=StartGameCommandHandlerTest,StartGameCommandControllerTest
```

Features tested:
- Starts game when room config is valid.
- Rejects start with `INVALID_ROOM_STATE` if state != `joinable`.
- Rejects start with `EMPTY_PARTICIPANTS` if player count is 0.
- Rejects start with `EMPTY_MATCHES` if match count is 0.
- Rejects start with `MISSING_COMMON_MATCH` if `commonMatchId` is NULL.
- Rejects start with `INVALID_COMMON_MATCH` if common match is not in the pool.
- Rejects start with `UNASSIGNED_PARTICIPANTS` if any participant lacks match assignments.
- Double-submitting the same `Idempotency-Key` returns an identical response without a second state transition (FR-013/SC-005) — covers both the "replay after completion" and "in-flight duplicate" cases (research.md R7).
- Reusing an `Idempotency-Key` against a different `roomId`/command returns `409 IDEMPOTENCY_KEY_REUSE`.

---

## Client Layer (Jest)

Verify the hooks compile, matches can be added/removed, and state transition leads to automatic navigation:

```bash
npm test -- --testPathPattern="useRoomConfigure|useRoomLobby"
```

---

## Full End-to-End Suite (Playwright BDD)

Run end-to-end regression tests:

```bash
npm run test:e2e -- --grep "configure start game"
```

Expected scenarios:
1. Host selects matches, selects a common match, randomizes assignments, and clicks "Start Game" successfully.
2. An incomplete configuration displays a clear error explanation to the host and prevents starting.
3. Connected members and guests see the game starts and transition instantly to the active dashboard.
