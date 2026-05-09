# Tasks: History, Comparison, and Leaderboard Read Models

**Input**: Design documents from `specs/009-history-read-models/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: This feature requires pgTAP coverage for the new SQL surfaces and query behavior. No UI end-to-end coverage is required because the feature stays in the Supabase database layer.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to, for example `US1`, `US2`, or `US3`
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the migration and pgTAP scaffolds for the new read-model slice.

- [x] T001 [P] Create migration scaffolds in `supabase/migrations/018_history_read_models_support.sql`, `supabase/migrations/019_history_read_models_history.sql`, `supabase/migrations/020_history_read_models_lifetime.sql`, `supabase/migrations/021_history_read_models_comparisons.sql`, and `supabase/migrations/022_history_read_models_leaderboard.sql`
- [x] T002 [P] Create pgTAP scaffolds in `supabase/tests/database/070_history_read_models_history.test.sql`, `supabase/tests/database/080_history_read_models_lifetime.test.sql`, `supabase/tests/database/090_history_read_models_comparisons.test.sql`, `supabase/tests/database/100_history_read_models_leaderboard.test.sql`, and `supabase/tests/database/110_history_read_models_performance.test.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared completed-session rollup primitives that every read model builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add shared internal rollup views/functions in `supabase/migrations/018_history_read_models_support.sql` that normalize completed-session filtering, participant rows, match rows, assignment rows, and reusable comparison inputs for later read models

**Checkpoint**: The shared read-model primitives exist and the story-specific views/functions can now be built on top of them.

---

## Phase 3: User Story 1 - Completed History Loads Without Local Recalculation (Priority: P1) 🎯 MVP

**Goal**: A player opening History can load completed session summaries and overview totals from the database without recomputing them on the client.

**Independent Test**: Load representative completed sessions and confirm the returned summary data includes the session identity, nested participants, matches, assignments, completion timing, and totals needed to render the Games and Stats tabs.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T004 [P] [US1] Add pgTAP coverage in `supabase/tests/database/070_history_read_models_history.test.sql` for completed-session summary shape, nested participant/match/assignment data, guest scoping, and stable ordering

### Implementation for User Story 1

- [x] T005 [US1] Implement `public.completed_session_summaries` and `public.history_overview_totals` in `supabase/migrations/019_history_read_models_history.sql`, using the shared helpers from `supabase/migrations/018_history_read_models_support.sql` and granting authenticated read access

**Checkpoint**: User Story 1 is independently testable and the database can serve the History screen data without client-side aggregation.

---

## Phase 4: User Story 2 - Lifetime Stats Stay Keyed To Registered Identity (Priority: P1)

**Goal**: Signed-in players can load durable lifetime totals across completed sessions, with one row per registered account and no guest rows in permanent rankings.

**Independent Test**: Query multiple completed sessions and confirm each registered account aggregates into one lifetime row while guest participants remain excluded.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T006 [P] [US2] Add pgTAP coverage in `supabase/tests/database/080_history_read_models_lifetime.test.sql` for one-row-per-account aggregation, guest exclusion, empty-state behavior, and stable totals

### Implementation for User Story 2

- [x] T007 [US2] Implement `public.lifetime_player_stats` in `supabase/migrations/020_history_read_models_lifetime.sql` from the shared completed-session rollups and registered account identity keys, with authenticated read access

**Checkpoint**: User Story 2 is independently testable and durable lifetime totals are available for the Players and Stats tabs.

---

## Phase 5: User Story 3 - Player Comparisons Are Stable And Session-Safe (Priority: P2)

**Goal**: Players can load head-to-head comparison data from the database, with registered users compared across completed sessions and guest participants kept session-scoped.

**Independent Test**: Request comparison data for two selected participants and confirm the response covers the metrics currently shown in the comparison modal, including the no-overlap registered-user case and the same-session guest case.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T008 [P] [US3] Add pgTAP coverage in `supabase/tests/database/090_history_read_models_comparisons.test.sql` for registered-user comparisons, same-session guest comparisons, zero-overlap fallback, and deterministic timeline ordering

### Implementation for User Story 3

- [x] T009 [US3] Implement `public.compare_registered_players` and `public.compare_session_participants` in `supabase/migrations/021_history_read_models_comparisons.sql`, using the shared helpers and the spec's guest-scope rules, with authenticated execute access

**Checkpoint**: User Story 3 is independently testable and comparison reads no longer rely on client-side aggregation.

---

## Phase 6: User Story 4 - Leaderboards Rank Registered Users Only (Priority: P2)

**Goal**: Leaderboards show registered users ranked by total drinks consumed in completed sessions, with deterministic tie-breaks and no guest identities in permanent rankings.

**Independent Test**: Request the leaderboard from completed-session data and verify only registered accounts appear, ordered by total drinks, then average drinks per game, then account ID.

### Tests for User Story 4 (REQUIRED coverage) ⚠️

- [x] T010 [P] [US4] Add pgTAP coverage in `supabase/tests/database/100_history_read_models_leaderboard.test.sql` for rank ordering, tie-breaks, zero-result handling, and guest exclusion

### Implementation for User Story 4

- [x] T011 [US4] Implement `public.leaderboard_entries` in `supabase/migrations/022_history_read_models_leaderboard.sql` from `public.lifetime_player_stats`, preserving the total-drinks, average-per-game, and `account_id` ordering rules

**Checkpoint**: User Story 4 is independently testable and the leaderboard now comes from the database instead of local sorting.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, performance checks, and documentation alignment.

- [x] T012 [P] Add pgTAP performance checks in `supabase/tests/database/110_history_read_models_performance.test.sql` with `EXPLAIN (ANALYZE, BUFFERS)` assertions for the completed-session history, lifetime stats, comparison, and leaderboard read paths
- [x] T013 [P] Run `npx --yes supabase db reset` and `npx --yes supabase test db` to validate the full read-model slice against `supabase/migrations/` and `supabase/tests/database/`
- [x] T014 [P] Update `specs/009-history-read-models/quickstart.md` so the documented migration and test filenames match the final implementation layout and the validation steps stay accurate

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Each depends on Foundational completion; US1, US2, and US3 can proceed independently after Phase 2, while US4 depends on the lifetime-stats work from US2
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational - no dependency on US1, but its output is reused by US4
- **User Story 3 (P2)**: Can start after Foundational - independent of US1 and US2
- **User Story 4 (P2)**: Can start after US2 because it derives from `public.lifetime_player_stats`

### Within Each User Story

- Required tests MUST be written and FAIL before implementation
- Different story phases can be worked on in parallel once the shared foundation exists
- Each implementation task stays inside its named migration file so the SQL surface remains easy to review and test
- Performance validation is deferred to the polish phase once the main SQL surfaces exist

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **Phase 3-6 Tests**: T004, T006, T008, and T010 can be prepared in parallel because they touch different test files
- **Phase 3-6 Implementation**: T005, T007, and T009 can be implemented in parallel after T003 because they touch different migration files; T011 follows after US2 because the leaderboard reuses lifetime stats
- **Phase 7**: T012, T013, and T014 can run independently once the SQL surfaces are complete

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm the History data contract works independently
5. Deploy/demo if ready

### Incremental Delivery

1. Finish Setup + Foundational so the shared completed-session primitives exist
2. Deliver User Story 1 to remove local history aggregation
3. Deliver User Story 2 to supply durable lifetime stats
4. Deliver User Story 3 to supply stable comparison reads
5. Deliver User Story 4 to rank registered users in the database
6. Run the quickstart smoke checklist and the full pgTAP suite before merge

### Parallel Team Strategy

With multiple contributors:

1. Split Setup and Foundational file creation early
2. After Phase 2, assign one contributor to US1 history views/tests, one to US2 lifetime stats/tests, one to US3 comparisons/tests, and one to US4 leaderboard work once US2 lands
3. Validate each user story independently as soon as its tests and SQL are complete

---

## Summary

| Phase                  | Story | Tasks         | Parallel Opportunities |
| ---------------------- | ----- | ------------- | ---------------------- |
| 1 - Setup              | -     | T001-T002 (2) | T001 + T002            |
| 2 - Foundational       | -     | T003 (1)      | -                      |
| 3 - US1 History        | P1    | T004-T005 (2) | T004                   |
| 4 - US2 Lifetime Stats | P1    | T006-T007 (2) | T006                   |
| 5 - US3 Comparisons    | P2    | T008-T009 (2) | T008                   |
| 6 - US4 Leaderboard    | P2    | T010-T011 (2) | T010                   |
| 7 - Polish             | -     | T012-T014 (3) | T012 + T013 + T014     |
| **Total**              |       | **14**        |                        |

---

## Notes

- [P] tasks can be executed in parallel when they touch different files and do not depend on incomplete work
- Each story is independently testable once its tasks are complete
- Keep the read-model work in Supabase migrations and pgTAP tests; the client integration can land in a later story once these contracts are stable
