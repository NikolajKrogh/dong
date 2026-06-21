# Tasks: Host Creates Room

**Input**: Design documents from `specs/016-create-host-room/`

**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/](contracts/)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2)
- No project initialization needed — this extends an existing project

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Database RPC and TypeScript types that MUST exist before any client-side work can begin.

**⚠️ CRITICAL**: No user story implementation can start until this phase is complete.

- [X] T001 Write `supabase/migrations/029_host_create_room.sql`: implement `private.create_room_as_host()` (SECURITY DEFINER plpgsql — assert auth.uid() not null, read accounts.preferred_display_name with 'Host' fallback, check for existing joinable room and return its data if found, retry loop up to 5 times generating a 6-digit numeric code via `LPAD(FLOOR(RANDOM()*1000000)::int::text,6,'0')` catching unique_violation, insert game_sessions row with state='joinable', insert participants row with session_role='owner' and membership_type='registered', return jsonb with sessionId/joinCode/hostParticipantId/hostDisplayName) and `public.create_room_as_host()` (thin sql wrapper delegating to private function, GRANT EXECUTE TO authenticated, REVOKE from anon and PUBLIC)
- [X] T002 [P] Write `types/hostRoom.ts`: export `HostRoomCreateResponse` interface (`sessionId: string`, `joinCode: string`, `hostParticipantId: string`, `hostDisplayName: string`) and `HostRoomCreateStatus` type (`'idle' | 'creating' | 'success' | 'error'`)

**Checkpoint**: Migration and types complete — client-side work for both user stories can now begin.

---

## Phase 2: User Story 1 — Host Creates a Room and Receives a Join Code (Priority: P1) 🎯 MVP

**Goal**: An authenticated host can trigger room creation, which atomically generates a 6-digit numeric join code, persists the room in joinable state, records the host as owner participant, and returns the code to the client via a dedicated hook.

**Independent Test**: Sign in as a host → tap "Create Room" → verify `useHostRoomCreate` transitions from idle → creating → success, and that `game_sessions` + `participants` rows exist in the database with correct values.

### Database Tests for User Story 1

- [X] T003 [P] [US1] Write `supabase/tests/database/160_host_create_room.test.sql`: pgTAP tests covering — (1) RPC creates a game_sessions row with join_code matching 6-digit numeric format and state='joinable'; (2) RPC creates a participants row with session_role='owner', membership_type='registered', and correct display_name; (3) calling RPC twice for same authenticated host returns same sessionId (existing-room redirect, no second insert); (4) unauthenticated caller (auth.uid() null) raises 'not_authenticated'; (5) join code is unique across non-completed sessions

### Implementation for User Story 1

- [X] T004 [P] [US1] Extend `utils/supabaseClient.ts`: add `HostRoomRpcClient` interface (`createRoomAsHost(): Promise<HostRoomCreateResponse>`) and `createHostRoomRpcClient(client)` factory function (call `supabase.rpc('create_room_as_host').overrideTypes<HostRoomCreateResponse,{merge:false}>()`, throw on error or null data, mirror the `createGuestRoomRpcClient` pattern); export `getHostRoomRpcClient()` with lazy singleton cache
- [X] T005 [US1] Write `hooks/useHostRoomCreate.ts`: export `UseHostRoomCreateResult` interface (`isCreating: boolean`, `error: string | null`, `createRoom: () => Promise<void>`); implement hook with `useState` for isCreating/error, `createRoom` callback that calls `getHostRoomRpcClient().createRoomAsHost()`, sets isCreating=true before and false after, sets error on failure, and calls `router.push({ pathname: '/lobby/[sessionId]', params: { sessionId, joinCode, hostParticipantId, hostDisplayName } })` on success (depends on T004)
- [X] T006 [US1] Write `__tests__/hooks/useHostRoomCreate.test.ts`: unit tests covering — (1) `isCreating` transitions false→true→false across a successful call; (2) on success, router.push is called with correct pathname and all four params from the RPC response; (3) on RPC error, `error` is set and router.push is not called; (4) `isCreating` resets to false on error (depends on T005)
- [X] T007 [US1] Update `app/index.tsx`: import `useAccountAuth` and `useHostRoomCreate`; add `const { account } = useAccountAuth()` and `const { isCreating, error: createRoomError, createRoom } = useHostRoomCreate()`; render a `ShellActionButton` (variant="primary", label="Create Room", icon people-outline, testID="home-create-room-button") only when `account !== null`, placed adjacent to the existing guest-join button; disable button and show loading indicator when `isCreating`; surface `createRoomError` to user when non-null (depends on T005)

**Checkpoint**: US1 complete — host can trigger room creation from home screen; DB rows verified by pgTAP; hook state verified by unit tests. Navigation to lobby will 404 until T008.

---

## Phase 3: User Story 2 — Host Is Navigated to the Lobby After Room Creation (Priority: P1)

**Goal**: Immediately after room creation, the host is taken to a lobby screen at `app/lobby/[sessionId].tsx` that displays the 6-digit join code prominently and shows the host as the first participant.

**Independent Test**: Navigate directly to `/lobby/[sessionId]?joinCode=123456&hostDisplayName=Alice&hostParticipantId=<uuid>` and verify the join code and host name are rendered; then complete the full creation flow end-to-end via Playwright.

### Implementation for User Story 2

- [X] T008 [US2] Create `app/lobby/[sessionId].tsx`: Expo Router screen that reads `sessionId` from `useLocalSearchParams` plus `joinCode`, `hostParticipantId`, and `hostDisplayName` from params; render the join code in a large, prominent text element (testID="lobby-join-code"); render host display name in a participant slot labelled as owner (testID="lobby-host-participant"); use `ShellScreen` + `SafeAreaView` wrapper consistent with other screens; include a header title "Room Lobby"; add placeholder text indicating waiting for players to join (to be replaced in US5.2)

### E2E Tests for User Story 2

- [X] T009 [P] [US2] Write `e2e/features/host-create-room.feature`: BDD feature file with scenario "An authenticated host creates a room" — Given a signed-in host is on the home screen, When they tap the Create Room button, Then they are navigated to the lobby screen, And a 6-digit numeric join code is displayed, And the host's display name appears in the participant list; add second scenario "Create Room button is hidden for unauthenticated users" — Given a user is not signed in, Then the Create Room button is not visible
- [X] T010 [US2] Write `e2e/steps/host-create-room.steps.ts`: implement step definitions for `host-create-room.feature` — reuse existing sign-in steps from `host-auth.steps.ts`; add steps for tapping the Create Room button (testID "home-create-room-button"), asserting navigation to lobby URL pattern `/lobby/`, asserting join-code element (testID "lobby-join-code") contains 6 digits, asserting host participant element (testID "lobby-host-participant") is visible; run `npm run bddgen` after writing to regenerate scaffolding (depends on T008, T009)

**Checkpoint**: US2 complete — full creation flow works end-to-end; lobby screen renders code and host participant; Playwright e2e passes.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Validation, lint, and quickstart confirmation.

- [X] T011 [P] Run `npm run db:reset && npm run db:test` and verify all tests in `160_host_create_room.test.sql` pass (depends on T003) — PASS: 24 files / 286 tests green locally, including `160_host_create_room.test.sql`.
- [X] T012 Run `npm test && npm run lint` — ensure no regressions in existing test suite and no lint errors (depends on T006, T010)
- [X] T013 Complete the manual smoke test from [quickstart.md](quickstart.md) — VERIFIED across layers:
  - UI half (button hidden when signed out, visible when signed in, navigation to `/lobby/[sessionId]`, 6-digit code displayed, host shown in participant list) is covered by the passing Playwright e2e `host-create-room.feature` (2/2).
  - Backend half exercised against the LIVE hosted dev DB (`qccvlhblytuedgmlqfef`) by calling the deployed `public.create_room_as_host()` as an authenticated host inside a rolled-back transaction (no shared-dev pollution): join_code `235319` (6-digit ✓), state `joinable` ✓, display name `Smoke Test Host` ✓, owner participant `owner/registered` ✓, second call returns same sessionId ✓.
  - Not performed: a literal hands-on click-through of the deployed web UI with a real login (would need real host credentials). The migration is live on the dev project and `.env.local` points there, so this is ready for a human pass via `npx expo start --web`.

### Post-implementation defect found & fixed (real-device testing)

- **Symptom**: On a real device a signed-in host tapped "Create Room" and got "Failed to create room." (HTTP 400). Not related to the Java `command-api` (which is not on this path).
- **Root cause**: latent bug in migration `025` — `private.assert_session_owner_participant()` is a DEFERRABLE constraint trigger attached to BOTH `participants` and `game_sessions`, but it resolved the session id via `COALESCE(NEW.session_id, OLD.session_id)`. `game_sessions` has no `session_id` column (PK is `id`), so every COMMITTED `game_sessions` insert raised `record "new" has no field "session_id"` at commit. It was never caught because every pgTAP test (and the initial smoke test) used `BEGIN/ROLLBACK`, so the deferred trigger never fired. Host room creation is the first committed client-side `game_sessions` insert.
- **Fix**: `supabase/migrations/030_fix_owner_participant_assert_trigger.sql` — resolve the session id from `TG_TABLE_NAME` (`game_sessions.id` vs `participants.session_id`). Applied locally and to the hosted dev project.
- **Regression guard**: `160_host_create_room.test.sql` now runs `SET CONSTRAINTS ALL IMMEDIATE` after the RPC calls so the deferred trigger actually fires inside the rollback-based test. Full local suite: 24 files / 286 tests green. Hosted committed-path verified (deferred trigger forced immediate) — returns a valid 6-digit code with no error.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Requires T001 (migration) and T002 (types) from Phase 1
- **US2 (Phase 3)**: Requires T007 (home screen wired to hook) from US1
- **Polish (Phase 4)**: Requires T003 (pgTAP), T006 (unit tests), T010 (e2e) from prior phases

### User Story Dependencies

- **US1**: Depends on Foundational (T001, T002) only
- **US2**: Depends on US1 (T007 must be complete so the navigation call exists); T009 (feature file) can be written in parallel with US1 work

### Within Each Story

| Task | Depends on |
|------|-----------|
| T003 | T001 (migration must exist to test) |
| T004 | T002 (types must exist for TypeScript) |
| T005 | T004 (RPC client factory) |
| T006 | T005 (hook) |
| T007 | T005 (hook) |
| T008 | T002 (types for params) |
| T009 | None — can be written any time after spec is complete |
| T010 | T008 (screen testIDs), T009 (feature file) |

---

## Parallel Opportunities

### Phase 1 (Foundational)

```
T001  Write migration 029_host_create_room.sql
T002  Write types/hostRoom.ts                    ← parallel with T001
```

### Phase 2 (US1)

```
T003  Extend supabaseClient.ts (RPC client)  ─┐
T004  Write pgTAP test file                  ─┤← parallel after T001+T002
                                              ↓
T005  Write useHostRoomCreate hook           (sequential, after T003)
                                              ↓
T006  Write hook unit tests      ─┐
T007  Update app/index.tsx       ─┤← parallel after T005
```

### Phase 3 (US2)

```
T009  Write .feature file         ← parallel with US1 work
                                    ↓
T008  Create lobby screen (after T007)
                                    ↓
T010  Write step definitions      (sequential, after T008 + T009)
```

---

## Implementation Strategy

### MVP First (Both Stories are P1 — deliver together)

1. Complete Phase 1: Foundational (T001, T002)
2. Complete Phase 2: US1 (T003–T007)
3. Complete Phase 3: US2 (T008–T010)
4. **STOP and VALIDATE**: pgTAP passes, hook unit tests pass, Playwright e2e passes
5. Run quickstart.md smoke test (T013)
6. Open PR

### Suggested Commit Cadence

- After T001 + T002: `feat(db): add create_room_as_host RPC and TypeScript types`
- After T003–T005: `feat(hook): add useHostRoomCreate hook and RPC client`
- After T006–T007: `feat(home): auth-aware Create Room button with tests`
- After T008–T010: `feat(lobby): add lobby screen and e2e tests for host room creation`

---

## Notes

- `[P]` tasks operate on different files with no shared incomplete dependencies — safe to parallelize
- `[US1]` / `[US2]` labels map tasks to user stories from `spec.md` for traceability
- pgTAP tests (T003) should be run against a local Supabase stack (`npm run db:reset && npm run db:test`)
- The lobby screen (T008) is intentionally minimal for US5.1 — real-time participant updates arrive in US5.2 (#136)
- After writing `host-create-room.feature` (T009), run `npm run bddgen` to scaffold step boilerplate before writing T010
