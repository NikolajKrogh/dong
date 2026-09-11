# Tasks: Server-Authoritative Multiplayer Gameplay

**Input**: Design documents from `/specs/024-server-authoritative-gameplay/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by FR-032 and constitution §V. Write each story's automated
tests first and confirm they fail for the missing behavior before implementation.

**Organization**: Tasks are grouped by user story so each story can be
implemented and validated as an independently demonstrable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can execute in parallel because it touches different files and has no
  dependency on an incomplete task in the same phase.
- **[Story]**: Maps the task to one specification user story.
- Every task names its concrete repository path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the branch baseline and prepare shared generated surfaces
without altering the existing #186 implementation.

- [X] T001 Record the current dirty-worktree baseline and verify migration 041 remains present and passing with `git status --short`, `npm run db:reset`, and `npm run db:test` in `specs/024-server-authoritative-gameplay/quickstart.md`
- [X] T002 [P] Run `npx tamagui generate-prompt` and record the generated implementation guidance for the new multiplayer controls in `specs/024-server-authoritative-gameplay/research.md`
- [X] T003 [P] Regenerate the current Supabase TypeScript schema baseline and confirm migration-041 reassignment signatures in `types/database.types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared active-game types, client boundaries, and test
fixtures used by every story.

**⚠️ CRITICAL**: Complete this phase before starting any user-story work.

- [X] T004 Define `ActiveGameContext`, sequence-numbered canonical snapshot, gameplay result, pending mutation, and stable error-token types in `types/room.ts`
- [X] T005 [P] Extend registered and guest room snapshot parsing/serialization with owner and `lastEventSequence` fields in `types/room.ts`, `types/guestRoom.ts`, and `utils/roomSnapshot.ts`
- [X] T006 Implement typed registered/guest gameplay RPC methods, UUID idempotency keys, and error mapping without direct table writes in `utils/supabaseClient.ts`
- [X] T007 [P] Add the authenticated Supabase Function invocation contract for provider refresh in `utils/supabaseClient.ts`, leaving `utils/commandApiClient.ts` discovery-only
- [X] T008 Add persisted multiplayer context setters/clearers while keeping guest secrets in the existing grant and solo state distinct in `store/store.ts`
- [X] T009 [P] Add reusable registered/guest, concurrent-command, stale-snapshot, completed-room, and shared two-client fixtures in `e2e/steps/browser-flow.helpers.ts`
- [X] T010 Add foundational type, RPC serialization, error mapping, and active-context persistence tests in `__tests__/utils/supabaseClient.gameplay.test.ts` and `__tests__/store/activeGameContext.test.ts`

**Checkpoint**: Shared contracts compile and both signed-in and guest callers can
be represented without enabling any new gameplay behavior.

---

## Phase 3: User Story 1 - Everyone Plays One Shared Game (Priority: P1) 🎯 MVP

**Goal**: Active participants share canonical manual goals and drink totals;
retries apply once, concurrent distinct actions survive, optimistic failures
roll back, and provider scores remain trusted canonical observations.

**Independent Test**: Start an in-progress room with registered and guest
participants, submit goal/drink deltas concurrently and with a repeated request
UUID, accept a provider correction, and verify one ordered audit trail plus the
same final values on both clients within five seconds.

### Tests for User Story 1

- [X] T011 [P] [US1] Add pgTAP cases for registered/guest authorization, manual/provider separation, negative guards, replay/conflict, concurrent deltas, event ordering, and reconstruction in `supabase/tests/database/280_server_authoritative_gameplay.test.sql`
- [X] T012 [P] [US1] Add optimistic composition, success reconciliation, uncertain retry, rollback, and stable-error tests in `__tests__/hooks/useActiveGameRoomSync.test.ts`
- [X] T013 [P] [US1] Add controller tests for multiplayer goal/drink routing, provider read-only controls, and multiplayer pull-to-refresh in `__tests__/hooks/useGameProgressController.multiplayer.test.ts`
- [X] T014 [P] [US1] Add pure Jest tests for Edge grouping, normalization, malformed responses, concurrency, and timeout behavior in `__tests__/supabase/refreshProviderScores.test.ts`

### Implementation for User Story 1

- [X] T015 [US1] Add transactionally ordered manual-score, drink, and provider-observation private functions, registered/guest wrappers, fingerprinted idempotency, immutable events, grants, and snapshot sequence output in `supabase/migrations/042_server_authoritative_gameplay.sql`
- [X] T016 [P] [US1] Implement the JWT-authenticated `refresh-provider-scores` Edge Function and testable provider normalization module in `supabase/functions/refresh-provider-scores/`
- [X] T017 [US1] Implement service-role-only lease claiming and transactional provider batch acceptance in `supabase/migrations/042_server_authoritative_gameplay.sql`
- [X] T018 [US1] Implement canonical-plus-pending goal/drink overlays, request UUID retention, explicit retry, rollback, and four-second refresh in `hooks/useActiveGameRoomSync.ts`
- [X] T019 [US1] Route multiplayer score/drink actions through the sync hook while retaining provider controls as read-only in `hooks/useGameProgressController.ts` and `components/gameProgress/MatchQuickActionsModal/ScoreControls.tsx`
- [X] T020 [US1] Replace direct-device ESPN polling for multiplayer rooms with Supabase Function refresh while leaving solo live scoring and Java discovery unchanged in `hooks/useActiveGameRoomSync.ts` and `hooks/useLiveScores.ts`
- [X] T021 [US1] Surface pending state, canonical rollback errors, offline refusal, and shared participant drink totals in `components/gameProgress/MatchQuickActionsModal/index.tsx` and `components/gameProgress/PlayersList.tsx`

**Checkpoint**: US1 passes pgTAP, Jest, and Java tests and can be demonstrated
with two clients without relying on recovery, completion, or reassignment UI.

---

## Phase 4: User Story 2 - Recover the Current Game (Priority: P1)

**Goal**: A backgrounded, restarted, disconnected, removed, or stale client
recovers canonical roster, assignments, scores, drinks, room state, and host
before it can submit another change.

**Independent Test**: Make one client stale while another changes the room,
then resume/restart it and verify canonical state replaces local state within ten
seconds and controls remain disabled until recovery succeeds.

### Tests for User Story 2

- [X] T022 [P] [US2] Add hook coverage for sequence fencing, optimistic retry/rollback, reconnect gating, completed-room read-only behavior, and access-loss recovery in `__tests__/hooks/useActiveGameRoomSync.test.ts`
- [X] T023 [P] [US2] Add registered and guest lobby-to-game context handoff tests in `__tests__/app/lobby/lobbyInProgress.platform.test.tsx` and `__tests__/hooks/useHomeRoomActions.guestStart.test.ts`
- [X] T024 [P] [US2] Add and pass the stale-client/reconnect Playwright BDD scenario in `e2e/features/server-authoritative-gameplay.feature` and `e2e/steps/server-authoritative-gameplay.steps.ts`

### Implementation for User Story 2

- [X] T025 [US2] Persist active room/participant context before registered and guest game navigation and clear it on access loss in `app/lobby/[sessionId].tsx`, `hooks/useHomeRoomActions.ts`, and `hooks/useActiveGameRoomSync.ts`
- [X] T026 [US2] Add initial hydration, sequence rejection, polling lifecycle, platform visibility refresh, reconnect gating, and ended/access-lost states in `hooks/useActiveGameRoomSync.ts` using `platform/visibility/useAppVisibility.ts`
- [X] T027 [US2] Apply canonical snapshot roster, assignments, scores, drinks, owner, and room state without resetting unrelated values in `store/store.ts`
- [X] T028 [US2] Disable multiplayer mutations until recovery and render loading, reconnect, ended, and access-lost feedback in `components/gameProgress/MultiplayerGameStatus.tsx` and `app/gameProgress.tsx`

**Checkpoint**: US2 independently proves stale state cannot remain editable or
overwrite the room after resume/restart.

---

## Phase 5: User Story 3 - End the Multiplayer Game Cleanly (Priority: P1)

**Goal**: Only the current host can canonically complete from the active screen;
all clients receive the same immutable final result and no device creates a
duplicate local history entry.

**Independent Test**: End a room containing multi-device gameplay, a departed
participant, and assignment history; verify pending confirmation, final-state
convergence, exact shared history, and rejection of later writes.

### Tests for User Story 3

- [X] T029 [P] [US3] Extend pgTAP coverage for gameplay/completion ordering, departed-participant retention, immutable final results, and rejection of every post-completion command in `supabase/tests/database/280_server_authoritative_gameplay.test.sql`
- [X] T030 [P] [US3] Add host/non-host, final-snapshot, and no-local-history controller tests in `__tests__/hooks/useGameProgressController.multiplayer.test.ts`
- [X] T031 [P] [US3] Add and pass shared completion/history steps in `e2e/features/server-authoritative-gameplay.feature` and `e2e/steps/server-authoritative-gameplay.steps.ts`

### Implementation for User Story 3

- [X] T032 [US3] Align migration 042 gameplay locks and result sequence with migration 041's `end_game_session` transaction and completed snapshot/history views in `supabase/migrations/042_server_authoritative_gameplay.sql`
- [X] T033 [US3] Branch end-game handling by active context so multiplayer calls canonical completion, waits for confirmation, and never invokes local `saveGameToHistory` in `hooks/useGameProgressController.ts`
- [X] T034 [US3] Recompute host-only completion permission from each snapshot and render pending/read-only final states in `components/gameProgress/EndGameModal.tsx`, `components/gameProgress/FooterButtons.tsx`, and `app/gameProgress.tsx`
- [X] T035 [US3] Clear mutable active-game context when the user leaves or access is lost, while retaining the hydrated completed snapshot for read-only display in `hooks/useActiveGameRoomSync.ts` and `store/store.ts`

**Checkpoint**: US3 independently completes a shared room exactly once and
leaves all participants on the same non-editable outcome.

---

## Phase 6: User Story 4 - Host Corrects Assignments During Play (Priority: P2)

**Goal**: The current host can use #186's server reassignment command from the
active game, with canonical pending/convergence behavior and preserved gameplay.

**Independent Test**: Score and record drinks, reassign one participant's exact
non-common match count, then verify two clients retain prior gameplay, converge
on assignments, and use the new assignment for later attribution.

### Tests for User Story 4

- [X] T036 [P] [US4] Add component coverage for exact-selection, Common Match locking, and pending-state behavior in `__tests__/components/gameProgress/ReassignmentControl.platform.test.tsx`; host visibility and error/host-handover mapping are covered at the screen and sync boundaries
- [X] T037 [P] [US4] Add sync tests for reassignment acceptance, sequence refresh, and preservation of canonical score/drink state in `__tests__/hooks/useActiveGameRoomSync.test.ts`
- [X] T038 [P] [US4] Add and pass the two-client reassignment, reconnect, completion, and convergence journey in `e2e/features/server-authoritative-gameplay.feature` and `e2e/steps/server-authoritative-gameplay.steps.ts`

### Implementation for User Story 4

- [X] T039 [US4] Implement responsive Tamagui Sheet participant and exact-match selection with the Common Match locked in `components/gameProgress/ReassignmentControl.tsx`
- [X] T040 [US4] Integrate migration 041's typed reassignment wrapper as a non-optimistic pending command and refetch its accepted sequence in `hooks/useActiveGameRoomSync.ts`
- [X] T041 [US4] Show reassignment only to the current snapshot owner, map stale/invalid/non-host errors, and attach the control to `app/gameProgress.tsx`
- [X] T042 [US4] Verify assignment refresh updates attribution without rewriting canonical scores, drinks, or pending overlays in `hooks/useGameProgressController.ts` and `store/store.ts`

**Checkpoint**: US4 completes #186's client half and remains independently
testable after any pre-existing goal/drink state.

---

## Phase 7: User Story 5 - Solo Play Remains Local and Reliable (Priority: P2)

**Goal**: Games without multiplayer context keep the existing offline scoring,
drinks, completion, and exactly-once local history behavior.

**Independent Test**: With network access disabled and no active room context,
start, play, and complete a solo game and verify no RPC attempt and one local
history record; separately verify multiplayer completion creates no local copy.

### Tests for User Story 5

- [X] T043 [P] [US5] Cover offline solo goal/drink/completion and exactly-once local-history regression behavior in `__tests__/hooks/useGameProgressController.test.ts`
- [X] T044 [P] [US5] Add mode-isolation and context-clear regression tests in `__tests__/store/activeGameContext.test.ts`
- [X] T045 [P] [US5] Add and pass the solo-no-network Playwright scenario in `e2e/features/server-authoritative-gameplay.feature` and `e2e/steps/server-authoritative-gameplay.steps.ts`

### Implementation for User Story 5

- [X] T046 [US5] Isolate all shared RPC/poll/provider-refresh behavior behind `mode === multiplayer` while preserving existing local reducers and history calls in `hooks/useGameProgressController.ts` and `hooks/useLiveScores.ts`
- [X] T047 [US5] Ensure new multiplayer status and host controls render nothing and add no network dependency for solo mode in `app/gameProgress.tsx`

**Checkpoint**: US5 passes completely offline and multiplayer completion still
has no duplicate local history.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Close the integrated #190 acceptance boundary across platforms and
record release/recovery evidence.

- [X] T048 [P] Add the complete two-client primary journey tags, deterministic fixture reset, shared command routes, and convergence assertions in `e2e/features/server-authoritative-gameplay.feature` and `e2e/steps/browser-flow.helpers.ts`
- [X] T049 [P] Regenerate Supabase types after migration 042; retain explicit domain result DTOs where generated RPC returns `Json` so client parsing remains typed in `types/database.types.ts`, `types/room.ts`, and `utils/supabaseClient.ts`
- [X] T050 Run `npm run lint`, `npm run test:ci -- --runInBand`, `npm run db:reset`, `npm run db:test`, `command-api/mvnw.cmd clean verify`, and the tagged Playwright journey; record results and the physical-device limitation in `specs/024-server-authoritative-gameplay/quickstart.md`
- [ ] T051 Perform the physical Android plus web second-client smoke for goal, drink, resume, reassignment, completion, and final-state convergence (pending authenticated room/session credentials); record device serial/build/date/evidence in `specs/024-server-authoritative-gameplay/quickstart.md`
- [X] T052 Review migration grants, explicit `search_path`, token/JWT redaction, authorization-before-replay, retained event recovery, and forward rollback instructions in `supabase/migrations/042_server_authoritative_gameplay.sql` and `specs/024-server-authoritative-gameplay/quickstart.md`
- [X] T053 Run the read-only cross-artifact analysis and resolve all HIGH/CRITICAL findings in `specs/024-server-authoritative-gameplay/spec.md`, `specs/024-server-authoritative-gameplay/plan.md`, and `specs/024-server-authoritative-gameplay/tasks.md`
- [X] T054 Restrict provider lease and batch RPCs to `service_role`, preserve league metadata and legacy compatibility, and add pgTAP privilege/lease/atomicity/correction coverage
- [X] T055 Add room-generation fencing, terminal access-loss mapping, pending-only overlays, and original-UUID uncertain retry behavior in `hooks/useActiveGameRoomSync.ts`
- [X] T056 Enforce multiplayer lifecycle navigation, per-control editability, host-only completion, duplicate-completion rejection, and guest session-specific hydration
- [X] T057 Remove the unshipped Java provider-refresh controller/service/DTO/tests while retaining Java match discovery, normalization, and caching

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and preserves the #186 baseline.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundation; establishes canonical gameplay
  writes and is the recommended MVP.
- **US2 (Phase 4)**: Depends on Foundation and integrates with US1 values; its
  recovery mechanism can be developed in parallel with US1 after shared types.
- **US3 (Phase 5)**: Depends on US1's ordered commands and US2's final snapshot
  consumption for the complete acceptance outcome.
- **US4 (Phase 6)**: Depends on US2 snapshot convergence and the existing #186
  migration 041; it may proceed in parallel with US3 once US2 is complete.
- **US5 (Phase 7)**: Depends on the multiplayer branch points from US1-US3 so it
  can prove isolation; tests may be drafted after Foundation.
- **Polish (Phase 8)**: Depends on all selected stories.

### User Story Dependency Graph

```text
Foundation
├── US1 Shared gameplay ──┬── US3 Completion
│                         └── US5 Solo regression
└── US2 Recovery ─────────┬── US3 Completion
                          └── US4 Reassignment
```

### Within Each User Story

1. Write the listed tests and confirm they fail for the missing behavior.
2. Implement database/model boundaries before clients that consume them.
3. Implement services/hooks before UI integration.
4. Run the story's independent test before moving to its checkpoint.

### Parallel Opportunities

- Setup tasks T002-T003 can run in parallel after T001.
- Foundation type/guest fixture work (T005, T007, T009) can run in parallel;
  T006/T008 then converge through T010.
- Within US1, pgTAP, client hook/controller, and Edge normalization tests
  T011-T014 can be written concurrently; Edge T016 can proceed beside database
  T015/T017.
- Each later story's database, hook, component, and E2E tests marked `[P]` can
  be drafted concurrently.
- After US2, US3 completion and US4 reassignment can be implemented in parallel.

## Parallel Execution Examples

### User Story 1

```text
Task T011: pgTAP canonical gameplay contract
Task T012: optimistic reconciliation hook tests
Task T013: controller routing tests
Task T014: Edge provider refresh normalization tests
```

### User Story 2

```text
Task T022: recovery/sequence hook tests
Task T023: lobby context handoff tests
Task T024: stale-client Playwright scenario
```

### User Story 3

```text
Task T029: completion-order pgTAP tests
Task T030: completion controller tests
Task T031: completion/history E2E steps
```

### User Story 4

```text
Task T036: reassignment component tests
Task T037: reassignment sync tests
Task T038: two-client reassignment E2E steps
```

### User Story 5

```text
Task T043: offline solo controller tests
Task T044: mode-isolation store tests
Task T045: solo-no-network E2E scenario
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 through T021.
3. Stop and independently demonstrate shared goal/drink concurrency, retries,
   rollback, and provider correction on two clients.
4. Treat this as the technical MVP; do not claim issue #190 complete until
   recovery, completion, reassignment, solo regression, and integrated QA land.

### Incremental Delivery

1. Foundation → typed room context and command boundaries.
2. US1 → trustworthy shared gameplay MVP.
3. US2 → safe recovery and stale-client fencing.
4. US3 → canonical completion/history (P1 product boundary).
5. US4 → #186 active-game reassignment UI.
6. US5 → explicit offline solo guarantee.
7. Polish → integrated web journey, physical device, security, and analysis.

## Notes

- `[P]` means different files or independently draftable tests, not permission
  to bypass their phase dependency.
- Never overwrite or renumber migration 041; feature database changes begin at
  migration 042.
- Preserve request UUIDs across explicit retry after uncertain responses.
- Never place guest tokens, JWTs, or service credentials in fixtures, logs, or
  gameplay events.
- Commit after logical groups only if the user chooses the optional git hook.
