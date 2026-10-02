# Tasks: Friendships, Unique Usernames, and Maintainable Foundations

**Branch**: `188-friendships-unique-usernames`
**Inputs**: [spec](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [contracts](contracts/social-api.md), [validation guide](quickstart.md), [v4 workflow](mockups/README.md).
**Status**: Functionality and cleanup implemented with unit/static validation. Non-unit validation tasks remain unchecked under the explicit 2026-10-01 user exception; see [verification.md](verification.md).

Tests are required by the specification and constitution V, regardless of optional-test wording in the template. Write SQL/unit checks before the behavior they validate. For UI tests, explore the running target with ARTEMIS before authoring executable interactions; therefore those tasks follow UI implementation. Choose a connected device when ambiguous. Native YAML paths below are planned flow artifacts: select a runner that fits the existing test environment after exploration, record its invocation, and adjust the extension if required; do not deliver non-runnable pseudocode.

Paths are repository-relative. New feature, test and script files are proposed destinations, not claims they already exist. New migrations must receive CLI-generated timestamps at implementation time; tasks name exact migration slugs and directory rather than inventing timestamps. Regenerate client contracts after every SQL slice. Do not modify applied migrations.

`[P]` means the marked tasks can execute together after their phase prerequisites, with separate files; it never overrides the dependency schedule below. Shared migrations, package manifests and friend hooks require sequential integration. No automatic commits, deployment, or hosted data reset is implied.

## Phase 1: Setup

Record the baseline and establish reproducible tools. These tasks do not deploy or reset a hosted database.

- [X] T001 Record branch, dirty files, existing lint/type/test failures, local CLI/Node versions, and prior-schema revision in `specs/027-friendships-unique-usernames/verification.md`; read applicable implementation skills before changing their domains.
- [X] T002 Pin compatible Node/Supabase CLI versions and install the planned TanStack Query v5 and SDK-compatible expo-network in `package.json` and `package-lock.json`; preserve the existing framework stack and record the dependency decisions in `specs/027-friendships-unique-usernames/removal-ledger.md`.
- [X] T003 Inventory account-name SQL consumers, profile dependencies, import-ledger readers, deletion paths, and dynamic/native package usage in `specs/027-friendships-unique-usernames/removal-ledger.md`; use CodeGraph before indexed-code searches and catalog inspection for SQL dependencies.

## Phase 2: Foundational prerequisites

Complete this phase before story work. Only common contract/tooling prerequisites belong here; Query integration is owned by US5 and social authority by US2–4.

- [X] T004 Wire `createClient<Database>` into the shared transport in `lib/supabase.ts`, migrate transport imports from `utils/supabaseClient.ts` without moving unrelated domain commands, and fix generated-type/JSON parser mismatches using `types/database.types.ts`; remove superseded transport entrypoints only after callers migrate.
- [X] T005 Add reproducible local type generation and non-mutating drift checks in `scripts/db-types.mjs` and `scripts/check-db-types.mjs`, expose `db:types`, `db:types:check`, and `typecheck` in `package.json`, and regenerate `types/database.types.ts` from the tested schema.
- [X] T006 Removed from scope on 2026-10-02: additional disposable upgrade and generic barrier runners. Keep existing local Supabase commands and database tests.
- [X] T007 Create reusable local authenticated account fixtures in `supabase/seed.sql` and `supabase/tests/fixtures/social.sql`; include more than 20 prefix matches, valid unique Unicode names, and distinct actor/third-party roles without embedding hosted credentials.

## Phase 3: US1 — Choose a unique username (P1)

Goal: one database-enforced username everywhere. Independent test: concurrent equivalent claims yield one owner; rename preserves UUID relationships and captured history. First reviewable MVP is this story plus foundation.

- [ ] T008 [P] [US1] Add username normalization, grants, direct-write bypass, null eligibility, rename/reuse, and deletion assertions in `supabase/tests/database/username.test.sql`; cover NFC, per-code-point casing, Greek prefix corpus, 2/3/30/31 lengths, Nd/Nl/No, supplementary letters, controls, and invalid marks.
- [X] T009 [P] [US1] Add repository/error and auth-save stale-response tests in `__tests__/features/account/accountRepository.test.ts`; cover a failed save preserving the prior account and same-account case changes.
- [X] T010 [US1] Create pinned Unicode 16.0.0 source metadata/license/checksum and reproducible L/N range generation in `scripts/generate-username-ranges.mjs` and `scripts/data/unicode-16.0.0/UnicodeData.txt`; test First/Last expansion and deterministic output in `__tests__/scripts/usernameRanges.test.ts`.
- [X] T011 [US1] Create the CLI-timestamped `unique_usernames` migration in `supabase/migrations/`: preflight invalid/colliding fixtures, add private generated category reference data, rename the account field, derive NFC/per-code-point ICU-root keys in a write trigger, constrain length/characters/null pairing, and add bytewise uniqueness and owner-only set_account_username; restrict column/function grants.
- [X] T012 [US1] Update current-name SQL readers, room projections, and account-deletion dependencies in the same new `supabase/migrations/` migration and `supabase/functions/delete-account/index.ts` where needed; remove unused profiles only after dependency reconciliation, preserving historical migration files and participant snapshots.
- [X] T013 [US1] Move account persistence/domain functions into `features/account/accountRepository.ts` and `features/account/index.ts`, migrate callers of `utils/accountRepository.ts` and `hooks/useAccountAuth.ts` to username terminology, and remove obsolete row-contract copies without compatibility aliases.
- [X] T014 [US1] Update `components/auth/UsernameOnboardingForm.tsx`, `components/preferences/ProfileSection.tsx`, and `app/userPreferences/profile.tsx` with Username labels, one field, format guidance, taken/error recovery, and successful-save-only identity updates; preserve return-to navigation and existing theme controls.
- [ ] T015 [US1] After exploring the actual updated flow with ARTEMIS, record verified interactions in `specs/027-friendships-unique-usernames/verification.md`, then update platform component coverage in `__tests__/components/auth/UsernameOnboardingForm.platform.test.tsx` and `__tests__/components/preferences/ProfileSection.platform.test.tsx`.
- [ ] T016 [US1] Add web username setup/edit/duplicate recovery to `e2e/features/unique-usernames.feature` and `e2e/steps/unique-usernames.steps.ts`, plus runnable native checks in `e2e/native/unique-usernames.yaml` using a device-supported runner selected after ARTEMIS exploration; use verified locators and deterministic waits.
- [ ] T017 [US1] Exercise concurrent claims using independent connections to the existing local database, regenerate `types/database.types.ts`, and record username clean/upgrade, retained snapshots, and cross-platform results in `specs/027-friendships-unique-usernames/verification.md`.

## Phase 4: US2 — Find someone and request friendship (P1)

Goal: eligible users find names and create one pending request. Independent test: two registered accounts discover each other and see opposite incoming/outgoing projections. US1 precedes authority work; US5 shared-cache tasks precede UI/query integration. Do not ship social UI until US3/US4 authority is complete.

- [ ] T018 [P] [US2] Add prefix-search/send/list authorization tests in `supabase/tests/database/friend-search.test.sql`: minimum three normalized characters, literal underscores, Greek prefixes, cap/order/filter-before-limit, cursor validation, ineligible/self/third-party denials, target rename, crossed sends, and operation-ID conflicts.
- [X] T019 [P] [US2] Add query/repository contract tests in `__tests__/features/friends/friendsRepository.test.ts` covering all returned errors, raw search input, per-page cancellation, and stable account selection.
- [X] T020 [US2] Create the CLI-timestamped `social_authority` migration in `supabase/migrations/`: reuse unique unordered pairs, add request generations, directional block storage and private transactional receipts, define pair locking/order and cleanup on deletion, and close direct mutation bypasses with grants/RLS/EXECUTE restrictions.
- [X] T021 [US2] Implement private send/search/list operations and narrow public wrappers in the new `social_authority` migration under `supabase/migrations/`; require eligible actors, check both block directions, confirm expected_username, use literal canonical prefix lookup and bounded keyset lists, and return current authorized projections on replay.
- [X] T022 [US2] Implement typed social access and domain error mapping in `features/friends/friendsRepository.ts`, `features/friends/queryKeys.ts`, and `features/friends/index.ts`; regenerate `types/database.types.ts` and add account-scoped hooks in `features/friends/useFriends.ts` after US5 cache foundation.
- [X] T023 [US2] Build v4 `features/friends/FriendsScreen.tsx` and `features/friends/FindFriendsScreen.tsx`, composed by `app/friends/index.tsx` and `app/friends/search.tsx`; add the Friends row only to `app/userPreferences/profile.tsx`, keep Home visually unchanged, and use only Friends/Requests tabs with search above them.
- [X] T024 [US2] Implement initial/loading/empty/error/pending/renamed-target states and one open/return/foreground/manual refresh path in `features/friends/useFriends.ts`; suppress competing automatic social refetch triggers, fence stale mutations, and show confirmed Pending after send; working Cancel request controls are integrated in T030–T031.
- [ ] T025 [US2] Explore search/navigation on ARTEMIS before authoring `__tests__/features/friends/FriendsScreen.test.tsx`, `e2e/features/friend-search.feature`, `e2e/steps/friend-search.steps.ts`, and `e2e/native/friend-search.yaml`; cover Profile entry, unchanged Home including active-game state, short search, more than 20 matches, and two-account persisted requests.
- [ ] T026 [US2] Run opposite-send and duplicate-operation concurrency using independent connections to the existing local database, inspect prefix query plans, and record US2 evidence in `specs/027-friendships-unique-usernames/verification.md`.

## Phase 5: US3 — Manage requests and friendships (P1)

Goal: recipient consent, immediate fresh requests after decline, cancellation, and unfriend. Independent test: accept/decline/cancel/unfriend persist correctly; stale actions never affect a new generation. Depends on US2 authority, with UI after US5 shared cache.

- [ ] T027 [P] [US3] Add decision and cancellation SQL tests in `supabase/tests/database/friend-transitions.test.sql` for recipient-only responses, fresh sends after decline, replay versus new intent, expected-state guards, stale generations, friendship-only access removal, and history preservation.
- [X] T028 [P] [US3] Add action-presentation and operation identity tests in `__tests__/features/friends/friendsRepository.test.ts` and `__tests__/features/friends/useFriends.test.ts`; cover role-dependent controls, uncertain outcomes, deliberate fresh intent, and stale callback suppression.
- [X] T029 [US3] Create a CLI-timestamped `friendship_decisions` migration in `supabase/migrations/` implementing respond_friend_request and cancel_friendship with shared pair locks/receipts, generation and expected_status checks; cancellation that loses to acceptance conflicts rather than unfriending.
- [X] T030 [US3] Extend `features/friends/friendsRepository.ts` and `features/friends/useFriends.ts` for accept/decline/cancel/unfriend, current-state reconciliation and stable operation IDs; regenerate `types/database.types.ts`.
- [X] T031 [US3] Implement incoming/outgoing groups and row controls in `features/friends/RequestsPanel.tsx`, friend overflow and distinct Unfriend confirmation in `features/friends/FriendActions.tsx`, add working Cancel request controls to outgoing rows and pending search results, and integrate with `features/friends/FriendsScreen.tsx` using shared theme/accessibility primitives.
- [ ] T032 [US3] After ARTEMIS exploration, add `e2e/features/friend-decisions.feature`, `e2e/steps/friend-decisions.steps.ts`, and `e2e/native/friend-decisions.yaml`; validate fresh sends after decline, cancellation from outgoing rows and pending search results, and both lists after cancel/unfriend with two persisted accounts.
- [ ] T033 [US3] Run accept/cancel, conflicting response, and old-operation/new-generation races using independent local database connections; record permission revocation and untouched game history in `specs/027-friendships-unique-usernames/verification.md`.

## Phase 6: US4 — Block unwanted interaction (P1)

Goal: protective blocks work at every relationship state with private ownership and safe recovery. Independent test: both block directions independently prevent interaction; unblock never restores friendship. Depends on US2/US3 authority; social UI release requires this story.

- [ ] T034 [P] [US4] Add owner-only block/unblock/lookup and access tests in `supabase/tests/database/friend-blocks.test.sql`; cover opposite blocks, unavailable privacy responses, deleted actors/targets, stale block IDs, and retained room-member history.
- [X] T035 [P] [US4] Add pure block action-model tests in `__tests__/features/friends/friendsRepository.test.ts` and `__tests__/features/friends/useFriends.test.ts`; cover action eligibility, pending/error states, and denied-operation handling; defer executable menu/dialog/focus interactions to T039.
- [X] T036 [US4] Create a CLI-timestamped `friendship_blocks` migration in `supabase/migrations/` with block/unblock/list wrappers, shared pair locks/receipts, block generations, and a block-aware accepted-friend predicate; update every surviving friend-only reader without broadening independent room membership permissions.
- [X] T037 [US4] Add block operations to `features/friends/friendsRepository.ts` and `features/friends/useFriends.ts`, regenerate `types/database.types.ts`, and ensure delayed unblock/replay cannot remove a newer block or reveal the opposite block.
- [X] T038 [US4] Implement `features/friends/BlockedAccountsScreen.tsx`, `app/friends/blocked.tsx`, and Block confirmation in `features/friends/FriendActions.tsx`; place Blocked accounts only in the Friends header overflow, with per-person Block actions in row menus and Unblock on owned block rows.
- [ ] T039 [US4] After ARTEMIS exploration, add `e2e/features/friend-blocks.feature`, `e2e/steps/friend-blocks.steps.ts`, and `e2e/native/friend-blocks.yaml`; add component checks in `__tests__/features/friends/BlockActions.platform.test.tsx` for overflow menus, confirmation dismissal, accessible labels and focus restoration; cover menu discovery, confirmation, blocking from search/requests/friends, mutual blocks, and no restoration after unblock.
- [ ] T040 [US4] Exercise block/send/accept, unblock/reblock, account deletion, and replay races using independent connections to the existing local database; record database role/security and two-client outcomes in `specs/027-friendships-unique-usernames/verification.md`.

## Phase 7: US5 — Consistent account and history state (P2)

Goal: share server-data lifecycle without leaking accounts or sacrificing local gameplay/history. Independent test: delay A's requests/mutations, switch to B, and verify no A data/callback affects B; local history and cloud history remain usable without import machinery. Execute its cache foundation before US2 UI tasks.

- [X] T041 [P] [US5] Add auth-generation/cache lifecycle tests in `__tests__/lib/queryClient.test.ts`; cover A→B, A→signed-out→A, expiry/deletion, same-account token refresh, delayed reads/mutations and canceled pagination.
- [X] T042 [P] [US5] Add history composition/import-retirement regression tests in `__tests__/features/history/historyRepository.test.ts`; preserve local-only sessions and completed/early-leave cloud snapshots while removing import-link dependencies.
- [X] T043 [US5] Implement in-memory Query provider/auth scope in `lib/queryClient.ts`, `app/_layout.tsx`, and `hooks/useAccountAuth.ts`; disable unresolved-identity queries, cancel/remove old private caches, guard mutation completions by identity generation, and forbid persisted private cache/offline mutation queues.
- [X] T044 [US5] Connect existing visibility abstraction and SDK-compatible network state in `platform/connectivity/index.ts`, `platform/connectivity/index.native.ts`, and `platform/connectivity/index.web.ts`; test unknown reachability, listener cleanup and focus deduplication in `__tests__/platform/connectivity.test.ts`.
- [X] T045 [US5] Move `utils/historyRepository.ts` and `hooks/useHistory.ts` behavior into `features/history/historyRepository.ts`, `features/history/useHistory.ts`, and `features/history/index.ts`; adopt account-scoped Query reads with abort propagation, preserve local composition, migrate `app/history.tsx` and `app/index.tsx` imports without changing Home UI, then remove old entrypoints.
- [X] T046 [US5] Remove the importer journey in `app/userPreferences/history-import.tsx`, `components/preferences/LegacyHistoryImportSection.tsx`, `components/preferences/LegacyHistoryImportClaimantModal.tsx`, and `hooks/useLegacyHistoryImport.ts`, with exclusive utilities/state/styles and references discovered in the removal ledger; remove the Settings History import row and empty Data group only.
- [X] T047 [US5] After runtime readers stop using import links, create the CLI-timestamped `retire_history_import` migration in `supabase/migrations/` to remove active importer functions/ledger and reconcile deletion/read dependencies explicitly; update `supabase/functions/delete-account/index.ts` as needed, retain applied migrations and regenerate `types/database.types.ts`.
- [ ] T048 [US5] Retire importer-only scenarios in `e2e/features/legacy-history-import.feature` and `e2e/steps/legacy-history-import.steps.ts`; after ARTEMIS exploration add runnable replacement `e2e/features/account-history-isolation.feature`, `e2e/steps/account-history-isolation.steps.ts`, and `e2e/native/account-history-isolation.yaml` for account switching, local history and cleaned Settings.
- [X] T049 [US5] Run retained auth/lobby/guest/start-game/history regressions and record absence of runtime importer calls, late-callback isolation, and unchanged Home in `specs/027-friendships-unique-usernames/verification.md`.

## Phase 8: US6 — Reproducible future changes and cleanup (P2)

Goal: contracts, boundaries, migration checks and unused-code tooling prevent renewed drift. Independent test: intentional stale types and forbidden imports fail checks; clean install and upgrade succeed. Depends on foundation; cleanup follows the relevant migrated readers.

- [X] T050 [P] [US6] Enforce route/feature/repository/transport direction and public cross-feature imports in `eslint.config.js`; verify with an intentional violating import, remove the fixture afterwards, and record the result in `specs/027-friendships-unique-usernames/verification.md`.
- [X] T051 [US6] Install/configure dev-only Knip in `package.json`, `package-lock.json`, and `knip.json`, register `check:unused`, and account for Expo routes, config, tests, scripts, native peers and dynamic entrypoints without blanket exclusions.
- [X] T052 [US6] Remove only usage-verified package candidates from `package.json` and `package-lock.json`, recheck the branch-specific JSX lint exception in `eslint.config.js`, and update `specs/027-friendships-unique-usernames/removal-ledger.md` with exact removed/retained files, rationale and platform evidence.
- [X] T053 [US6] Remove `command-api/src/main/java/com/dong/commandapi/command/EchoCommandHandler.java` and its exclusive test/registration references; retain dispatcher/start-game/persistent idempotency behavior and verify via `command-api/mvnw.cmd`.
- [X] T054 [US6] Update `.github/workflows/db-ci.yml` and `.github/workflows/client-ci.yml` so SQL-only changes trigger local schema rebuild, database tests, generated-contract drift and client typecheck; include the reviewed Knip gate, using pinned tooling.
- [X] T055 [US6] Correct required-test guidance in `.specify/templates/tasks-template.md` and tracked task-generation instruction copies including `.agents/skills/speckit-tasks/SKILL.md`; align them with constitution V and add supported module/migration guidance in `docs/development-workflow.md` and `CLAUDE.md`.
- [ ] T056 [US6] Prove deliberate stale-generated-types, forbidden-import, and unused-code fixtures fail the intended gates; remove fixtures and prove clean regeneration/upgrade works using `scripts/check-db-types.mjs`, recording results in `specs/027-friendships-unique-usernames/verification.md`.

## Phase 9: Cross-cutting verification and handoff

All six stories remain required for the full change; an MVP checkpoint does not drop the cleanup scope. No hosted reset/deployment or runtime test is performed by task generation.

- [ ] T057 Run the complete implemented `specs/027-friendships-unique-usernames/quickstart.md` gate: focused/full relevant Jest, SQL/concurrency/upgrade, typecheck/lint/type drift/Knip, Playwright, Maven, web export and Android build; separate baseline failures from regressions in `specs/027-friendships-unique-usernames/verification.md`.
- [ ] T058 Perform the persisted two-account web/native journey and actual Android validation after ARTEMIS exploration, including the SC-006 measurement protocol in `quickstart.md`, accessibility, failed fetch recovery and unchanged Home; append reproducible failures as discovered to `specs/027-friendships-unique-usernames/verification.md` and resolve scoped failures.
- [X] T059 Document coordinated schema/client cutover, versioned fixtures, linked-history read-only inspection and later deployment dry-run, explicit Edge Function deployment where changed, and local/hosted recovery boundaries in `specs/027-friendships-unique-usernames/quickstart.md`; do not reset hosted data or rewrite migration history.
- [X] T060 Reconcile every FR/SC against evidence, dependency additions/removals and v4 workflow in `specs/027-friendships-unique-usernames/verification.md`, `specs/027-friendships-unique-usernames/removal-ledger.md`, and `specs/027-friendships-unique-usernames/checklists/requirements.md`; leave unexecuted gates incomplete and update `specs/027-friendships-unique-usernames/tasks.md` only with proven completion.

## Dependencies and execution order

Task IDs are stable identifiers grouped in story priority order, not permission to ignore cross-story prerequisites.

1. Setup T001–T003 → foundation T004–T007.
2. US1 T008–T017 is the first complete reviewable increment. T008/T009 run together; T010 precedes T011; migration precedes account integration.
3. After US1, establish US5 cache infrastructure T041, T043, T044 before social hooks/UI T022–T025. T042 and history migration T045–T049 can continue separately once shared files are stable.
4. Implement social authority in order: T018–T021 → T027–T029 → T034–T036. Blocking storage is introduced in T020 so every social command already checks it; its authorized commands and final permission predicate land in T036. Do not expose a partially secured social feature between these steps.
5. Then integrate US2 UI T022–T026 → US3 T030–T033 → US4 T037–T040. SQL tests and pure action tests can be written earlier at their phase entry; UI interaction tests follow ARTEMIS exploration.
6. Complete US5 history/import retirement T042, T045–T049. T047 follows removal of every import-ledger reader; never drop the ledger while an active consumer remains.
7. US6 T050/T053 can run after the inventory on separate files. Serialize T051/T052 with any package edits; T054 follows working scripts and feature SQL; T055 documents the final boundaries. T056 follows T050/T051/T054.
8. T057–T060 require all stories. A failure in scoped behavior is repair work, not permission to check a task complete.

Dependency graph:

```text
Setup → Foundation → US1
                       ├→ US5 cache foundation ───────────┐
                       └→ US2 SQL → US3 SQL → US4 SQL ───┤
                                                         ↓
                                                   US2 UI → US3 UI → US4 UI
US5 cache foundation → US5 history/import retirement ────────────────┐
Foundation + migrated feature boundaries → US6 workflow/cleanup ────┤
All six stories ────────────────────────────────────────────────────→ final gates
```

## Parallel examples

| Story | Safe parallel work after prerequisites |
|---|---|
| US1 | T008 database assertions and T009 repository/error tests; do not concurrently edit auth integration |
| US2 | T018 database search tests and T019 repository tests |
| US3 | T027 transition SQL tests and T028 pure action tests |
| US4 | T034 database block tests and T035 action/menu model tests; author executable UI interactions only after exploration |
| US5 | T041 cache tests and T042 history composition tests; integrate auth/provider changes sequentially |
| US6 | T050 ESLint boundary work and T053 Java echo retirement use different files; package cleanup remains serialized |

Parallel work is optional. One implementer may follow the dependency schedule serially.

## Requirement coverage

| Requirements / outcomes | Task coverage |
|---|---|
| FR-001–004; SC-001, SC-005 | T008–T017: naming, normalization, uniqueness, stable identity and rename/reuse |
| FR-005–006; SC-002, SC-006 | T018–T026, T058: private prefix discovery, eligibility, target confirmation, navigation and performance |
| FR-007–010; SC-003–004 | T020–T021, T027–T033: pair state, replay, consent, decline/retry, cancel/unfriend |
| FR-011–014; SC-003–004 | T034–T040: block ownership, mutual blocks, races and access revocation |
| FR-015; SC-002 | T024–T025, T032, T039, T058: refresh, confirmed state and recoverable UI |
| FR-016–017; SC-005 | T006–T008, T011–T012, T017, T034, T040, T057, T059: fixture/upgrade/deletion/recovery |
| FR-018; SC-005 | T003, T012–T013: one current identity and profile retirement |
| FR-019; SC-007 | T019, T024, T041–T045, T048–T049: shared lifecycle and account isolation |
| FR-020; SC-009 | T042, T045–T049: complete importer retirement and preserved history |
| FR-021; SC-008 | T004, T013, T022, T045, T050, T055–T056: explicit feature boundaries |
| FR-022–023; SC-008 | T005–T007, T054–T059: generated contracts and one migration workflow |
| FR-024–025; SC-010 | T003, T046–T056, T060: removal ledger, tooling and future-change guidance |
| FR-026; SC-011 | T061: zero-warning lint, unused-code and compiler gates, clean unit execution |
| Approved visual workflow | T014, T023–T025, T031–T032, T038–T039, T048, T058: v4, unchanged Home, Profile entry and secondary block management |

## Implementation strategy and completion evidence

- **First MVP checkpoint:** foundation + US1. Demonstrate unique usernames on both platforms and at persistence; this is not completion of issue #145 or permission to omit cleanup.
- **Complete social increment:** US2–US4 plus US5 cache foundation. Demonstrate two-account discovery, request decisions, cancel/unfriend, block/unblock and safe retries with the approved navigation.
- **Full requested scope:** also finish US5 history/import retirement and US6 maintainability work, then cross-cutting gates. Keep each migration/application slice reviewable.
- Every task stays unchecked until its deliverable and relevant check pass. Record exact commands, failures and evidence in `verification.md`; do not equate mocked tests, generated images, or Android compilation with persisted two-device behavior.
- Follow [quickstart.md](quickstart.md) for local setup and recovery. Hosted rollout requires the concrete target, history inspection, dry-run and recovery instructions; this task list does not authorize a blanket reset.
- Optional extension hook before/after task generation: `/speckit-git-commit`. Not executed; artifacts remain uncommitted for review.


## Execution exception — 2026-10-01

The user also explicitly requires a warning-free codebase. Existing lint and unused-code findings are in scope; a baseline exemption does not satisfy completion.

- [X] T061 Remove existing lint warnings and unused-code findings, replace the Knip baseline ratchet with a zero-issue gate, and verify unit tests and static checks without running web, Android or E2E tests.

The user explicitly requested implementation and unit tests only, skipping web, Android and E2E tests. No browser/device journey, ARTEMIS exploration, web export or Android build was executed in this session. SQL integration/concurrency/upgrade runs and Java integration tests were also excluded from the unit-only execution scope. Existing platform/E2E/database fixtures were updated or retired where the renamed API/removal would otherwise leave stale references; this is not evidence that they pass.

Unchecked tasks T008, T015–T018, T025–T027, T032–T034, T039–T040 and T048 contain deferred non-unit deliverables or execution. T056's three static negative gates passed; its clean/upgrade rerun is deferred. T057 completed only unit/static gates; T058 is deferred entirely. The additional upgrade and generic barrier scripts were removed from scope on 2026-10-02; feature-specific race verification remains deferred. These are known unverified outcomes, not missing permission for the implemented functionality.
