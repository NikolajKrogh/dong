# Tasks: In-Game Leave and Preserved History

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/in-game-leave.md`
**Tests**: Focused pgTAP and Jest are required. No E2E tests or suites are authored or run.

## Phase 1: Setup

- [x] T001 Confirm issue #165, dependencies, clean `multiplayer` base, and create `codex/165-in-game-leave-history`; record evidence in `specs/026-in-game-leave-history/verification.md`.
- [x] T002 Explore the existing Android Game actions path with ARTEMIS before authoring focused test code; record observations in `specs/026-in-game-leave-history/verification.md`.

## Phase 2: Foundational

- [x] T003 Create a forward migration under `supabase/migrations/` that restores departed participants in shared game snapshots, retains a separate active roster, and captures exact in-progress departure results on immutable events.
- [x] T004 Add focused pgTAP checks under `supabase/tests/database/` for one event, preserved totals, active-write rejection, guest/member/host authorization, and lobby behavior.

## Phase 3: User Story 1 - Leave and freeze (P1)

**Goal**: One confirmed server departure preserves the player and blocks subsequent writes.

**Independent Test**: Depart after a drink change, retry, attempt writes, and inspect participant/event state.

- [x] T005 [US1] Widen registered member in-progress leave in `supabase/migrations/`, keeping room-first locks and existing lobby behavior.
- [x] T006 [US1] Return captured result from confirmed guest in-progress leave via `supabase/migrations/`, preserving guest-grant retry and denial behavior.
- [x] T007 [US1] Verify host handover event capture and existing gameplay write guards in `supabase/tests/database/`.

## Phase 4: User Story 2 - Immediate history (P1)

**Goal**: Registered leavers read the captured cloud result and guests keep the confirmed result on their device.

**Independent Test**: Read history before completion, change the live game, then read it again.

- [x] T008 [US2] Add the account-scoped provisional result projection in `supabase/migrations/` and its access checks in `supabase/tests/database/`.
- [x] T009 [US2] Map and deduplicate provisional results in `utils/historyRepository.ts`, `hooks/useHistory.ts`, and `components/history/historyTypes.ts` with one focused Jest check in `__tests__/utils/`.
- [x] T010 [US2] Save confirmed guest result once in `store/store.ts` and the game leave flow, with one focused non-E2E check in `__tests__/hooks/`.

## Phase 5: User Story 3 - In-game action and final history (P1)

**Goal**: Web and Android players can confirm departure while completed history retains them.

**Independent Test**: Leave in Game actions, continue play as host, finish, and read completed history.

- [x] T011 [US3] Add Leave Game to `components/gameProgress/GameActionsSheet.tsx`, `components/gameProgress/FooterButtons.tsx`, and `app/gameProgress.tsx` with confirmation, failure feedback, and host handover/close handling.
- [x] T012 [US3] Wire registered and guest leave orchestration through the existing hooks in `hooks/`, preserving Home/Setup and End Game behavior.
- [x] T013 [US3] Add one focused non-E2E component/controller check under `__tests__/` for the action and cancelled/confirmed paths.
- [x] T014 [US3] Verify completed history includes the leaver and supersedes a provisional registered result in `supabase/tests/database/` and `__tests__/utils/`.

## Phase 6: Verification and Convergence

- [x] T015 Run permitted focused checks, TypeScript and lint; record exact commands/results and limitations in `specs/026-in-game-leave-history/verification.md`.
- [x] T016 Compare implementation against `spec.md`, `plan.md`, and `tasks.md`; append remaining tasks if needed and complete them. Update `quickstart.md` with final manual web and user-run Android steps.
- [x] T017 Review and commit only issue #165 files in small coherent commits, then record commit SHAs in `specs/026-in-game-leave-history/verification.md`.

## Dependencies

T001 and T002 precede test authoring. T003 precedes T005-T008. T008 precedes T009. T006 and T009 precede T010. T011-T012 depend on server and history contracts. T013-T014 precede T015. T016 follows verification.

## Implementation Strategy

Preserve the database truth first, then expose the result through existing history contracts, then wire the shared UI. Use one migration and small focused checks. The E2E coverage requirement remains explicitly unmet under the user's constraint.

## Phase 7: Authorized Hosted Deployment

- [x] T018 Compare linked migration history and dry-run the push; confirm only `20260928163507_preserve_in_game_leavers.sql` is pending.
- [x] T019 Apply the migration to linked project `qccvlhblytuedgmlqfef` with Vault updates disabled, then verify migration history, objects, grants, and an empty follow-up dry run.
