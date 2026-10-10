# Shared History Review Record

Review scope: the full changed Feature 028 implementation and its connected callers, including History data access, presentation, Friends integration, route/navigation, database contract and tests, and feature documentation/context. The user-added `.agents/skills/simplify` and `skills-lock.json` are outside this inventory and were not edited.

## Findings and disposition

- `docs/development-workflow.md` described Feature 027's one-session test exception in present tense. Reworded it as historical and linked validation claims to each feature's quickstart.
- `contracts/social-history.md`, `research.md`, and `tasks.md` retained the initial assumption that personal totals had no standalone endpoint. Clarified that pair-bundle viewer totals remain pair-scoped and that approved T034 adds the actor-only dashboard endpoint.
- `quickstart.md` linked to a nonexistent `changed-files.txt`. Replaced it with this scoped review record.
- The data-layer pass found compressed interfaces/branches and ambiguous parser/RPC helper names. Refactored those for readability, centralized the repeated connection fallback message, and gave account query-key prefixes named helpers. The social hook now has separate typed game/timeline loaders sharing one paging lifecycle helper; conditional result casts are gone, with serial/account-scope checks retained. No behavior or authorization change was intended, and focused tests pass.
- Replaced the handwritten account-ID regex with a module-cached Zod Mini `guid()` schema and named type guard. This preserves the old generic hexadecimal 8-4-4-4-12 format without imposing UUID version or variant restrictions. The user asked to remove direct tests of library primitives, so GUID syntax is exercised through repository and route behavior instead of duplicated schema-unit cases. Promoted the already-installed Zod 4.4.3 package to an exact runtime dependency.
- The follow-up audit replaced remaining handwritten History payload type, array, finite-number, date, enum, and key checks with Zod Mini schemas, and routed History timestamp ordering through a shared library-backed helper. Account-stat unknown keys remain rejected while other payload objects keep their prior allow-extra/strip behavior. Domain checks for identity, guest linkage, membership, aggregates, current relationships, requested discovery IDs, cursor limits, and cancellation remain explicit. The user asked to remove tests that duplicate library primitives; those direct GUID, date, numeric/count, and basic trim/min-length cases were removed while feature-policy and integration coverage remains.
- No material SQL or data-layer security defect was verified. The applied migration is already deployed, so its SQL history remains unchanged. The review also found and fixed the Friends route's selected-account pagination issue described below. The repository keeps actor-derived personal totals separate from friend authorization, rechecks friendship/block access for social reads, and returns aggregate-only overall friend data.
- `features/friends/useFriends.ts` imports the public `features/history` barrel; its `Person` dependency is type-only. The boundary does not create a runtime cycle, so no barrel restructuring was justified.

## Reviewed files

### Client implementation and generated types

- `features/history/historyRepository.ts` — Reviewed paging, cancellation checks, canonical result replacement, and separation of personal/local history from social aggregates. In the validation-library follow-up, replaced handwritten response-shape checks with Zod Mini schemas while preserving cancellation, result-replacement, and domain checks.
- `features/history/socialHistoryRepository.ts` — Expanded compact interfaces and branches; renamed generic validation/unwrapping helpers to `parse*`/`requireRpcData`; flattened average validation; added one exported connection-error fallback used by the error class and hook. Account IDs use the cached Zod Mini GUID schema. The validation-library follow-up replaces handwritten object, array, number, date, enum, and object-key checks with cached Zod Mini schemas, while retaining exact error text, string wire values, cursor bounds, and authorization/domain checks. The unsafe mapper cast was removed; schema-inferred data is passed directly to `mapCompletedSession`.
- `features/history/historyDate.ts` — Added a shared Zod Mini date parser for History timestamp consumers; malformed values map to `null` for stable sort behavior.
- `features/history/useSocialHistory.ts` — Expanded packed state/query/lifecycle branches; added named account, social-history, personal-stats, and co-player query-key helpers. Replaced the boolean page loader and conditional result casts with typed game/timeline loaders over one shared paging helper. Serial, current-account, visibility, cancellation, and hidden-payload guards remain in place. Moved the two existing state-in-effect lint suppressions onto the specific hide/refresh calls they justify; lifecycle behavior is unchanged.
- `features/history/index.ts` — Reviewed public exports and the Friends integration boundary. Left as-is; the existing type-only cross-reference avoids a runtime cycle.
- `platform/abort.ts` — Reviewed compatibility with native AbortSignal implementations that lack `throwIfAborted()` and `reason`. Left as-is; it supplies the behavior the repositories and tests need without a dependency.
- `scripts/db-types.mjs` — Reviewed local-default and explicit `DONG_DB_URL` generation/check paths. Updated generated-type formatting to use the TypeScript AST rather than string matching; the explicit URL override does not alter hosted state by default.
- `types/database.types.ts` — Reviewed generated signatures for the feature RPCs against the contract. Left as-is; it is generated output and matches the implemented API.
- `package.json` and `package-lock.json` — Promoted the already installed Zod 4.4.3 package from Knip's transitive dependency to an exact runtime dependency; no unrelated lockfile churn was reported.

### Client tests

- `__tests__/features/history/historyRepository.test.ts` — Reviewed abort, pagination/deduplication, frozen-departure-to-canonical-result, and response-boundary coverage. The validation-library follow-up keeps application/domain coverage while removing direct tests that duplicated Zod primitives.
- `__tests__/features/history/socialHistoryRepository.test.ts` — Retains malformed/private payload, subject/scope, aggregate consistency, and abort coverage. Added application-contract coverage for username wire-value preservation, allowed extra fields, guest identity pairing, relationship allowlists, configured pagination limits, cursor compatibility, and rejecting oversized cursors before JSON parsing. Direct GUID/date/number/blank-string primitive tests were removed at the user's request.
- No standalone `historyDate` primitive test remains; the user asked to remove tests that duplicated Zod's date parser. Existing History presentation and navigation tests cover the application behavior that consumes the shared timestamp helper.
- `__tests__/scripts/db-types.test.ts` — Added focused cases for generated TypeScript declaration formatting and AST-based type generation.
- `__tests__/features/history/useSocialHistory.test.ts` — Reviewed pending/error privacy, lifecycle refresh, permission revocation, cancellation, and account/display race coverage. Left as-is; coverage corresponds to the hook's privacy boundary.
- `__tests__/lib/queryClient.test.ts` — Reviewed account-scoped social cache cancellation/removal and late-result behavior. Left as-is; no duplicated feature logic or missing cache namespace separation was found.

### Applied migration, pgTAP and fixture

- `supabase/migrations/20261009192736_shared_history_comparisons.sql` — Reviewed eligibility/projection, definer/invoker boundary, search path, grants, actor derivation, friendship and bilateral-block checks, pagination reauthorization, aggregate privacy, and origin preflight. No material SQL defect was verified. Left unchanged because it is already deployed.
- `supabase/tests/database/personal_history_stats.test.sql`, `supabase/tests/database/social_history_foundation.test.sql`, `supabase/tests/database/social_history_comparison.test.sql`, `supabase/tests/database/social_history_discovery.test.sql`, and `supabase/tests/database/social_history_revocation.test.sql` — Reviewed as one authorization/contract suite: actor-only statistics; online eligibility and private-call/grant boundaries; aggregate math and separate-game privacy; evidence-bounded discovery and pagination; and revocation, block, stale-auth and per-page checks. Left as-is; the assertions align with the final contract. No hosted or local database tests were run by this review agent.
- `supabase/tests/fixtures/social_history.sql` — Reviewed fixture identities and records for accepted friends, shared/separate/ongoing/imported games, guest/departure cases, and personal-stat totals. Left as-is; it provides the scenarios expected by the grouped SQL suite.

### Feature artifacts and context

- `specs/028-shared-history-comparisons/checklists/requirements.md` — Reviewed requirement status and evidence references. Left as-is; incomplete runtime gates remain distinct from automated evidence.
- `specs/028-shared-history-comparisons/contracts/social-history.md` — Clarified the pair-scoped viewer language and pointed to the separate actor-only endpoint. Other authorization, pagination, and privacy clauses were left as-is.
- `specs/028-shared-history-comparisons/data-model.md` — Reviewed aggregate/shared/detail boundaries and departure representation. Left functionally unchanged; removed redundant blank lines at EOF.
- `specs/028-shared-history-comparisons/plan.md` — Reviewed the dashboard refinement, migration identity, rollout and testing constraints. Left functionally unchanged; removed redundant blank lines at EOF.
- `specs/028-shared-history-comparisons/quickstart.md` — Replaced the broken inventory link with this report. Reviewed the local validation record and explicit unverified gates; no result was reclassified by this review.
- `specs/028-shared-history-comparisons/research.md` — Added a dated note recording that the approved actor-only dashboard endpoint superseded the initial pair-only assumption.
- `specs/028-shared-history-comparisons/spec.md` — Reviewed requirements and acceptance criteria against the final dashboard and privacy behavior. Left functionally unchanged; removed redundant blank lines at EOF.
- `specs/028-shared-history-comparisons/tasks.md` — Reworded T006 to preserve its pair-bundle meaning while pointing to the later T034 endpoint.
- `docs/development-workflow.md` — Reworded the Feature 027 exception as historical to avoid presenting that past session as current policy.
- `AGENTS.md` and `CLAUDE.md` — Reviewed repository workflow, CodeGraph-first, Supabase, generated-type, and testing guidance. Left as-is; the feature-specific exception and validation limits are captured in the feature artifacts.
- `.specify/feature.json` — Reviewed feature metadata only. No metadata change was needed.

### Shared History presentation pass (reported by the UI reviewer)

- `features/history/HistoryStatistics.tsx`, `features/history/SharedHistoryContent.tsx`, and `features/history/SharedHistoryScreen.tsx` — The UI reviewer reports clearer JSX/component responsibilities, accessible button and heading semantics, theme-based friend avatars, accurate shared-history actions, and explicit pending-friend handling. The reviewer also reports resolving game dates once and clarifying selected-friend loading state.
- `app/history.tsx`, `components/history/PlayerStatsList.tsx`, and `features/history/HistoryStatistics.tsx` — The validation-library follow-up uses the shared `getHistoryTimestamp` helper for game ordering and recency calculations, so malformed dates follow one consistent fallback path.
- `components/history/historyUtils.ts` — `formatHistoryDate` and `formatModalDate` now reuse `getHistoryTimestamp` for date validation while preserving their locale formatting, fallback text, and epoch-zero behavior.
- `__tests__/components/history/HistoryStatistics.platform.test.tsx` and `__tests__/components/history/SharedHistoryScreen.platform.test.tsx` — The UI reviewer reports a focused pending-friend regression proving unresolved IDs and outgoing-friend names stay hidden and no social-history query is made for that ID.
- Reported validation: those two suites passed (11 tests); targeted ESLint passed with zero warnings; `git diff --check` passed. These results were reported by the UI reviewer and were not rerun by this reviewer.

### Friends integration and History navigation pass (reported by the Friends reviewer)

- `features/friends/PeopleList.tsx`, `features/friends/FriendsScreen.tsx`, `features/friends/FindFriendsScreen.tsx`, `features/friends/BlockedAccountsScreen.tsx`, `features/friends/RequestsPanel.tsx`, `features/friends/FriendActions.tsx`, `app/history.tsx`, `components/history/PlayerStatsList.tsx`, `components/history/GameDetailsModal.tsx`, `__tests__/app/history.platform.test.tsx`, and `__tests__/components/history/SharedHistoryNavigation.platform.test.tsx` — Reviewed and changed. The pass removed route ownership from `PeopleList`, made the accepted-friend history action a full-width semantic button supplied by the screen, retained the global mutation lock with per-account progress labels, disabled pagination during any fetch, separated initial and next-page loading, and removed misleading retry copy. The History route now validates friend IDs, resets content on account/target changes, and fetches accepted-friend pages until the selected target is found or the query ends, with auth/self/account/fetch guards. `PlayerStatsList` now uses canonical identity keys and named relationship/rank helpers; game sorting avoids `indexOf` over sorted inputs, and in-game friend shortcuts and their button semantics are explicit.
- `features/friends/index.ts`, `features/friends/useFriends.ts`, `app/history-comparison/[accountId].tsx`, and `__tests__/components/history/GameDetailsModal.platform.test.tsx` — Reviewed without edits; the existing export boundary and mutation guard remain appropriate, and the comparison route retains its role.
- Reported validation: `npm run test:ci -- --runInBand --forceExit --runTestsByPath __tests__/app/history.platform.test.tsx __tests__/components/history/GameDetailsModal.platform.test.tsx __tests__/components/history/SharedHistoryNavigation.platform.test.tsx` passed (3 suites, 36 tests). Focused ESLint over owned and connected paths passed with `--max-warnings 0`. ARTEMIS verified Friends → You & Qwerty → Stats navigation and expansion/collapse. A payload fetch during the source refactor encountered a connection error; no final-source-version payload success was captured, so live social-data loading remains unverified. React Doctor was attempted but hung and was terminated without a result.

## Verification

The parent reviewer verified the final worktree after the validation-library follow-up:

- `npm run test:ci -- --runInBand --silent --forceExit` — 130 suites, 814 tests passed in 25.563 seconds. An earlier full run had one unrelated asynchronous `useTeamLogo` test failure; the fresh full rerun passed without a code change for that test.
- `npm run typecheck` — passed with exit code 0 after the test fixtures were changed to avoid assignments into null-inferred properties.
- `npm run lint` with `--max-warnings 0` — passed.
- `npm run check:unused` — passed.
- `npm run db:types:check` — passed against the disposable `dong_feature028_clean` database.
- `git diff HEAD --check` — passed.

The parent reviewer also executed all five local pgTAP suites against the disposable `dong_feature028_clean` database: 59 assertions passed (personal 10, foundation 16, comparison 15, discovery 9, revocation 9), with transaction rollback and explicit `not ok` output checks. The applied migration hash remains `cddff743794f59708a33c41983f49d790aa756e2`; no SQL changed. No hosted deployment or E2E workflows were run. Jest used `--forceExit` because the existing test process retains open handles.
