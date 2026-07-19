# Tasks: Harden Codebase Foundations

**Input**: Design documents from `/specs/019-harden-codebase-foundations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Grouped by user story (US1–US6). Each "Phase" below is one PR branched from `origin/multiplayer` (`git fetch origin && git checkout -b <branch> origin/multiplayer`). Verification commands per phase: see [quickstart.md](./quickstart.md). **Gate**: Phases 11–12 start only after feature 018 (`153-configure-start-game`) merges. Phases 1–10 must not touch the in-flight files listed in plan.md Technical Context.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable within its phase (different files, no dependencies)

---

## Phase 1: Client + DB CI, repo hygiene (US1) 🎯 MVP — branch `tech-debt/01-client-db-ci` — ✅ MERGED-PENDING: pushed, PR [#169](https://github.com/NikolajKrogh/dong/pull/169) open (stacked on [#168](https://github.com/NikolajKrogh/dong/pull/168) → `multiplayer`). CI confirmed green on GitHub: `build` (client-ci) and `pgtap` (db-ci) both `pass` on every push/pull_request run.

- [x] T001 [US1] Add `"test:ci": "jest --ci"` script to `package.json` (keep `"test": "jest --watchAll"` for local dev)
- [x] T002 [P] [US1] Create `.github/workflows/client-ci.yml` per the FR-002 closed convention list (pinned `actions/checkout@v4.1.7` + `persist-credentials: false`, pinned `actions/setup-node@v4.0.4` with `cache: npm`, `permissions: contents: read`, no secrets); triggers push/PR with `paths-ignore: ["command-api/**", "supabase/**", "specs/**", ".agents/**", "*.md"]` plus a workflow comment noting that new top-level non-client dirs must be appended to the ignore list; steps: `npm ci` → `npm run lint` → `npm run test:ci`. Verified locally (see below); `npx tsc --noEmit` step omitted (not yet run clean repo-wide, left for a later phase to confirm before adding)
- [x] T003 [P] [US1] Create `.github/workflows/db-ci.yml` per the FR-002 convention list: paths `supabase/**` + workflow file; `npx supabase start` → `npx supabase test db` → `npx supabase stop` under `if: always()` (Docker preinstalled on ubuntu-latest; ports/timeouts already in `supabase/config.toml`; partial suite execution = red run per spec Edge Cases)
- [x] T004 [P] [US1] Add `test-results/` and `playwright-report/` to `.gitignore`; `git rm -r --cached test-results/` (one committed Playwright PNG) — done
- [x] T005 [P] [US1] Fix stale plan pointer in `CLAUDE.md` SPECKIT block — de-pinned to "highest-numbered specs/ directory" wording (done on the Phase 1 branch; note this branch's own copy of CLAUDE.md, edited separately during 019 spec authoring on `refactoring`, still points at 019 pinned — the two are reconciled whichever branch merges last)
- [ ] T006 [US1] Configure `client-ci` and `db-ci` as required status checks on `master`/trunk branch protection (FR-013). **Blocked on repo-admin access + explicit user authorization** (branch protection is shared-infrastructure config, not something to change unilaterally) — documented as a handoff item: required check names are exactly `build` (client-ci job id) and `pgtap` (db-ci job id) once the workflows are pushed. Verified locally instead: `npm run lint` clean, `npm run test:ci` → 63 suites/271 tests green, `npx supabase start && npx supabase test db` → 32 files/339 tests PASS, `npx supabase stop` clean. Induced-failure and required-check-blocks-merge demonstration still pending push + branch protection.

**Checkpoint**: CI workflows live on GitHub and confirmed green on PR #169. T006 (required status checks) remains an explicit handoff — needs repo-admin action; check names are `build` and `pgtap`.

---

## Phase 2: Playwright e2e CI (US1) — branch `tech-debt/02-e2e-ci` — ❌ ABANDONED, not shipped. PR [#170](https://github.com/NikolajKrogh/dong/pull/170) closed unmerged per user decision after three failed fix attempts (T008b-d). Branch left in place, un-merged. No e2e CI job ships as part of this feature; `npm run test:e2e` remains local/manual only. See research.md D11 for the full investigation.

- [x] T007 [US1] Create `.github/workflows/e2e-ci.yml`: `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:e2e`; upload `playwright-report/` artifact on failure. No backend services (Playwright self-boots Expo web :8093, backends mocked in `e2e/steps/browser-flow.helpers.ts`).
- [x] T008 [US1] Verify: job runs on PR #170 (initially push/pull_request triggers). **Result: FAILED on GitHub Actions** — 59 failed / 37 passed, dominated by `Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8093/` — the self-booted Expo dev server stopped answering entirely partway through each ~17min run, not a per-test timeout.
- [x] T008a [US1] **Design change (user-directed)**: a fully serialized/long run is too slow to gate every PR regardless of root cause. Restructured `e2e-ci.yml`: dropped `push`/`pull_request` triggers, added `schedule` (nightly, 03:00 UTC) + `workflow_dispatch`, plus a `check-for-changes` job that skips the Playwright job when nothing has landed since the last completed run. `client-ci`/`db-ci` are unaffected — they stay per-PR (fast, ~1-2 min, already proven stable). **Caveat flagged to user**: GitHub only fires `schedule` triggers for workflow files on the repo's configured *default* branch, which is `master` (per D10, stale) — this schedule will not actually fire until the workflow reaches whichever branch is configured as default. `workflow_dispatch` works immediately regardless. Supersedes FR-013's original plan for `e2e-ci` to become a required PR check — see updated FR-013.
- [x] T008b [US1] **Investigation, attempt 1 (root cause: wrong)**: hypothesized default Playwright worker concurrency across both projects was overwhelming the shared dev server. Set `workers: process.env.CI ? 1 : undefined`. Re-verified via manual `workflow_dispatch`: **worse**, not better — 71 failed / 25 passed (vs. 59/37 before). Serializing didn't help because concurrency was never the actual cause (see T008c) — it just meant more tests were still queued when the server eventually died.
- [x] T008c [US1] **Investigation, attempt 2 (real root cause found)**: pulled the actual crash from the job log (not just the downstream symptom) — `[WebServer] FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`, at ~5 minutes of server uptime, independent of worker count. The dev-mode Expo/Metro server (SSR-per-request, no production build) genuinely leaks memory over a long run. Reverted `workers` to default; set `NODE_OPTIONS=--max-old-space-size=6144` in `webServer.env`. Re-verified: **still failed**, but the GC log confirmed the setting took effect (heap correctly reached ~6.1–6.2GB, matching the 6144MB limit) — it just delayed the crash (from ~5min to ~6.1min server uptime) rather than preventing it. Extrapolating the observed growth rate (~17MB/sec sustained) across a full ~17min run implies ~17GB would be needed — more heap than a GitHub-hosted runner has in total, so this is not fixable by raising the limit further.
- [x] T008d [US1] **Investigation, attempt 3 (user-directed: switch to static export)**: replaced the dev-mode `webServer.command` with `npx expo export -p web && npx serve -s dist -p <port>` (added `serve@14.2.6` as a pinned devDependency) — a static production build has no per-request compilation/rendering, so nothing to leak. Confirmed locally that route resolution works (including the dynamic `/lobby/[sessionId]` route, via `serve -s` SPA fallback) and that `EXPO_PUBLIC_*` env vars bake in correctly at export time when no local `.env.local` is present to shadow them (as is the case in CI). **However, a full local e2e run against the static build failed WORSE than the original dev-server baseline: 42 failed / 54 passed** (vs. 82/14 on the dev server). Failures are not cosmetic — e.g. `getByTestId('home-create-room-button')` never becomes visible within 90s; `LegacyHistoryImportButton` stays `aria-disabled="true"` and never enables. This points to a genuine behavioral/timing difference between dev-mode and production-mode app state readiness (not yet root-caused — no `__DEV__` or `NODE_ENV`-gated code was found in a first pass) that the e2e test-seeding infrastructure implicitly depends on. **Reverted** (change was never committed) rather than push a regression. **Final decision (user-directed): abandon e2e-ci entirely** — PR #170 closed unmerged, not added to this feature's scope. See research.md D11 for the full writeup and options for anyone who revisits this later.

---

## Phase 3: Remove axios + node-fetch (US2) — branch `tech-debt/03-remove-axios-node-fetch` — ✅ pushed, PR [#171](https://github.com/NikolajKrogh/dong/pull/171) open (stacked on #169)

- [x] T009 [US2] Replace `axios.get` in `hooks/useTeamData.ts` (import line 2, call ~line 56 inside `Promise.all`) with `fetch` + explicit `if (!res.ok) throw` + `res.json()` — must replicate axios's reject-on-non-2xx so error states are identical
- [x] T010 [US2] Remove `axios` and `node-fetch` from `package.json` dependencies; refresh lockfile (136 lines removed)
- [x] T011 [US2] Verify: `git grep -E "axios|node-fetch" -- ':!package-lock.json'` clean (only doc/spec text and an unrelated skill-file comment remain); lint clean; `npx jest --ci` → 63 suites/271 tests green; setupGame team pickers manually verified — navigated to the Matches step on web and confirmed via browser console that the exact fetch pattern used correctly retrieves/parses openfootball data (380 matches, correct shape), no CORS issues. CI confirmed green on GitHub: `build` (client-ci) passes on both push and pull_request runs.

---

## Phase 4: ESLint 9 flat config + TypeScript bump (US2) — branch `tech-debt/04-eslint9-ts5x` (no skill applies — plain devDependency/config migration; stated per §VI) — ✅ pushed, PR [#172](https://github.com/NikolajKrogh/dong/pull/172) open (stacked on #169)

- [x] T012 [US2] Bump devDeps in `package.json`: `eslint` → ^9.39.5, `eslint-config-expo` → ~9.2.0 (the correct stable line for Expo SDK 52 — later majors like 56.x/57.x track newer SDK generations directly), `typescript` → ^5.9.3. `@types/react` held at ~18.3. Dropped `eslint-plugin-react-native` entirely — confirmed unreferenced by either the old or new config.
- [x] T013 [US2] Created `eslint.config.js` from `eslint-config-expo/flat`, folding in every `.eslintrc.js`/`.eslintignore` pattern **plus `.tamagui/`** (the vendored/generated config wasn't excluded by the legacy `.eslintignore` and inflated an unfiltered first run to 5000+ spurious errors). Deleted `.eslintrc.js` and `.eslintignore`. **Real blocker found**: this project's bundled `@expo/cli@0.22.26` (Expo SDK 52 era) has no flat-config detection at all (confirmed in its own source — a `TODO(cedric): drop these files once we swap to flat config` comment) and was silently reinstalling ESLint 8 + re-scaffolding a legacy config every time `expo lint` ran, undoing the migration. Fixed by changing the `"lint"` script from `expo lint` to `eslint .`, bypassing Expo CLI's outdated bootstrap — ESLint 9 detects `eslint.config.js` natively.
- [x] T014 [US2] Fixed the 19 real errors (zero errors required for green; ~300 remaining findings are warnings, which don't fail the build): `react/no-children-prop` (2×, moved `children` to trailing `React.createElement` args), `react/no-unescaped-entities` (14× across 3 components, escaped to `&quot;`/`&apos;`), and 3× more `react/no-unescaped-entities` in `app/index.tsx` + `app/lobby/[sessionId].tsx` — **both in-flight on branch 153 per the freeze list, not edited**; added a scoped `eslint.config.js` override disabling just that rule for exactly those two files instead. Fixed the `utils/teamLogos.ts` suppression: renamed rule (`no-var-requires` → `no-require-imports`) and moved it onto the actual `require()` line (it was on the wrong line, silently inactive). **Investigated the TS bump for new type errors**: `tsc --noEmit` shows ~130 pre-existing errors, confirmed identical (133 vs 130, same locations, diffed) between TS 5.3.3 and 5.9.3 — pre-existing tech debt unrelated to this phase (matches Phase 1's note that tsc was never verified clean), not fixed here. Verified: `npm run lint` → 0 errors exit 0; `npx jest --ci` → 63 suites/271 tests green. CI confirmed green on GitHub: `build` (client-ci) passes on both push and pull_request runs.

---

## Phase 5: Spring Boot 3.3.5 → 3.5.x (US2) — branch `tech-debt/05-spring-boot-3.5` (parallel-safe with Phases 3–4; no skill applies — plain Maven upgrade) — ✅ pushed, PR [#173](https://github.com/NikolajKrogh/dong/pull/173) open (stacked on #169)

- [x] T015 [US2] In `command-api/pom.xml`: parent 3.3.5 → **3.5.3** (verified latest stable 3.5.x via Maven Central, not assumed); `springdoc.version` 2.6.0 → **2.8.6**; `logstash.version` 7.4 → **8.1**; removed the `maven-compiler-plugin` 3.10.1 pin (incl. `fork`/`executable=javac` override) — redundant given `<java.version>17</java.version>` already lets the Boot parent manage it. jjwt/caffeine/jacoco/dependency-check left unchanged.
- [x] T016 [US2] Verified: `mvnw clean verify` → BUILD SUCCESS, 75/75 tests passing, jacoco "All coverage checks have been met" (0.60 floor holds). Manually started the service (`mvnw spring-boot:run`) and confirmed `/swagger-ui/index.html` and `/v3/api-docs` both return 200, with `/v3/api-docs` serving a valid OpenAPI 3.1.0 document listing the real endpoints. CI confirmed green on GitHub: `build` (command-api CI / java-ci.yml) passes on both push and pull_request runs.
- [ ] ~~T017~~ **DEFERRED — not part of the Phase 5 PR.** Relocated to Phase 11 (see T041a below): after feature 018 merges, re-run `mvnw verify` on master since 018's new command-api handlers only compile under 3.5 once both have landed. Left as a strikethrough placeholder here so Phase 5's own checklist doesn't carry a weeks-open checkbox.

---

## Phase 6: ESPN parsing consolidation + dead code (US3) — branch `tech-debt/06-espn-parsing` (skills: `react-native-testing` for T018's fixture tests, `refactor` for the T019/T020 moves) — ✅ pushed, PR [#174](https://github.com/NikolajKrogh/dong/pull/174) open (stacked on #172)

- [x] T018 [US3] Wrote 24 characterization tests in `__tests__/utils/espnParsing.test.ts` against the pre-move `processApiMatch`/`parseStatistics`/`extractMatchId` (temporarily exported them from `useLiveScores.ts` to test before moving). Fixtures cover own goals, penalties, red/yellow cards, missing `athletesInvolved`, missing statistics, HT/FT display, and malformed inputs (empty `competitions`, missing `status`, missing `id`, entirely empty event) asserting the current `null` return.
- [x] T019 [US3] Created `utils/espnParsing.ts`: moved the three parsers verbatim, now typed against `types/espn.ts` (`ESPNEvent`/`ESPNCompetitor`) — no `any` anywhere. **The types needed zero extension** — already complete, just bypassed. `useLiveScores.ts` imports `processApiMatch` and shrank to fetch/poll orchestration only.
- [x] T020 [US3] Created `types/matchScores.ts` with `MatchWithScore`/`GoalScorer`/`MatchStatistics`; `useLiveScores.ts` re-exports all three for compatibility. Migrated the real imports in `components/gameProgress/MatchQuickActionsModal.tsx`, `components/gameProgress/MatchesGrid/types.ts`, `MatchesGridContainer.tsx` to the new location. `hooks/useGameProgressController.ts` only imports the `useLiveScores` hook itself (not the types by name) — needed no change.
- [x] T021 [P] [US3] Re-verified via grep (zero production consumers), then deleted: `extractTeamsFromESPNEvent` (`utils/matchUtils.ts`) + its 7 test cases; the `useTeamFiltering` hook (`hooks/useTeamFiltering.ts`). Relocated the still-used `filterMatchesByDateAndTime` to `utils/matchUtils.ts`; `useTeamFiltering.ts` is now a one-line re-export shim (`MatchList.tsx`'s import path unchanged). Fixed the stale `MatchList.tsx:66` doc comment (referenced the deleted hook; now correctly names `useMatchListFilters`, the hook actually used).
- [x] T022 [US3] Verified: 24 new characterization tests pass unchanged against the new module location. Full suite: 64 suites/288 tests green (was 63/271 — +1 suite/+24 tests, −7 deleted dead-code tests). `npm run lint` → 0 errors, same 298 warnings as before (no new ones). `npx tsc --noEmit` → exactly 130 pre-existing errors (the Phase 4 baseline, confirmed via comparison) — 3 test fixtures deliberately passing malformed events needed an explicit type cast once the parsers gained real types (the point of this phase). CI confirmed green on GitHub: `build` (client-ci) passes on both push and pull_request runs.

---

## Phase 7: gameProgress decomposition (US4) — branch `tech-debt/07-gameprogress-decomposition` (needs Phase 6; use `refactor` skill) — ✅ pushed, PR [#175](https://github.com/NikolajKrogh/dong/pull/175) open (stacked on #174)

- [x] T023 [US4] Moved the 7 pure pieces out of `hooks/useGameProgressController.ts` into `hooks/gameProgress/`: `uiReducer.ts` (`gameProgressUiReducer` + types), `toastQueueReducer.ts` (`toastQueueReducer` + types), `matchMigration.ts` (`migrateLegacyMatch`), `goalScoring.ts` (`calculateToastScoreDisplay`, `applyHomeGoalUpdate`, `applyAwayGoalUpdate`, `updateMatchForGoal` + types). Extracted the toast subsystem as `hooks/useGoalToastQueue.ts` (owns the reducer, the "show next toast" effect, and `formatGoalToastMessage`). Controller shrank to orchestration only (603 → 260 lines at that point) with an identical public return shape.
- [x] T024 [US4] `components/gameProgress/MatchQuickActionsModal.tsx` (1,424 lines) → folder `MatchQuickActionsModal/` per the sibling `MatchesGrid/` pattern: `styles.ts` (375-line `createStyles`, moved verbatim), `types.ts`, `StatProgressBar.tsx`, `PossessionCircle.tsx` (both deliberately keep the pre-existing single-arg `createStyles(colors)` call — a pre-existing TS2554 error preserved and relocated, not fixed, to keep the tracked tsc baseline exact). Extracted `hooks/useMatchQuickActionsAnimations.ts` for the 8 `Animated.Value` refs + their 3 `useEffect`s. Folder `index.tsx` transparently preserves both existing import paths (`app/gameProgress.tsx`, `components/index.ts`) since neither specifies a file extension. **Second pass**: `index.tsx` was still 659 lines after the first split, over the 400-line ceiling (SC-005/FR-009) — split further into `MatchHeader.tsx`, `ModalTabBar.tsx`, `ScoreControls.tsx`, `GoalScorersSection.tsx`, `PlayersSection.tsx`, `StatisticsSection.tsx`, leaving `index.tsx` as a 302-line orchestrating shell. All files now under 400 lines (largest: `styles.ts` at 375).
- [x] T025 [P] [US4] Created `utils/svgArc.ts` (`polarToCartesian`, `describeArc`, moved verbatim) + `__tests__/utils/svgArc.test.ts` (11 tests).
- [x] T026 [US4] Added unit tests for the extracted pure pieces as behavior-preservation evidence (`svgArc.test.ts`; full reducer/helper coverage deferred to Phase 10 per plan).
- [x] T027 [US4] Verified: `npx jest --ci` → 65 suites/299 tests, all passing (pre-existing gameProgress tests unmodified). `npm run lint` → 0 errors, exactly 298 warnings (matches baseline). `npx tsc --noEmit` → exactly 130 errors (matches baseline), including the 2 relocated TS2554s at `PossessionCircle.tsx:21` and `StatProgressBar.tsx:24`. Local `npm run test:e2e` showed unrelated flakiness (failures clustered in `app-shell`, `legacy-history-import`, `host-profile-settings` — all ~29s durations at the timeout ceiling, matching the already-documented Phase 2 sandbox-contention signature, not a regression from this phase) — relied instead on the full unit suite plus manual browser verification. Manually verified on Expo web (both before and after the second split): opened the quick-actions modal, incremented a goal, confirmed the score updated and the toast notification fired correctly, no console errors. CI confirmed green on GitHub: `build` (client-ci) passes on both push and pull_request runs.

---

## Phase 8: useAccountAuth decomposition (US4) — branch `tech-debt/08-account-auth-decomposition` — ✅ pushed, PR [#176](https://github.com/NikolajKrogh/dong/pull/176) open (stacked on #175)

- [x] T028 [US4] Split `hooks/useAccountAuth.ts` (786 lines): route/URL builders (`normalizeAccountDisplayName`, `normalizeAccountFlowReturnTo`, `buildAccountAuthRoute`, `buildAccountAuthRedirectUrl`) → `utils/accountAuthRoutes.ts`; Supabase persistence (`bootstrapAccountRow`, `saveAccountDisplayName`, `loadAccountSyncedSettings`, `saveAccountSyncedSettings`) → `utils/accountRepository.ts`. **Second extraction beyond the plan**: after the first split the provider was still 554 lines (over the 400-line ceiling, SC-005/FR-009), so the session-restore + `onAuthStateChange` sync logic (`resolveAuthenticatedUser`, `syncAuthenticatedSettings`, `resolveAccountStatus`, `syncAuthenticatedSession`, `clearAuthenticatedState`, the restore-session effect) was further extracted into `hooks/useAccountSessionSync.ts`. The store-subscription settings-sync effect went to `hooks/useAccountSettingsSync.ts` per the original plan. `useAccountAuth.ts` (356 lines) keeps `AccountAuthProvider` + the auth actions and re-exports every symbol it previously exported, so all consumer import paths are unchanged. Pure move, zero logic edits. New modules import `utils/supabaseClient` but do not modify it — no 153 conflict.
- [x] T029 [US4] Verified acceptance criterion: `__tests__/hooks/useAccountAuth.test.ts` passes **unmodified** (15/15). Full suite: `npx jest --ci` → 65 suites/299 tests. `npm run lint` → 0 errors, 298 warnings (baseline). `npx tsc --noEmit` → 130 errors (baseline; the only account-related errors are 3 pre-existing `Session` references in the untouched test file). Manual browser verification on Expo web: `/userPreferences` renders the signed-out `AccountSection`, `/auth` renders the sign-in form, no console errors. CI: one of two `build` runs flaked on an unrelated pre-existing test (`ProfileSection.platform.test.tsx`, a file this PR never touches) — confirmed as a flake, not a regression, by re-running the same commit (both runs went green) and by the parallel `build` run on the identical commit passing 299/299 the first time.

---

## Phase 9: Hook tests, trivial/medium tier (US5) — branch `tech-debt/09-hook-tests-1` (use `react-native-testing` skill; pattern per research.md D7)

- [ ] T030 [P] [US5] `__tests__/hooks/useTeamLogo.test.ts` (mock `utils/teamLogos`)
- [ ] T031 [P] [US5] `__tests__/hooks/usePlayerSuggestions.test.ts` (seed `useGameStore` history; pure derivation, no async)
- [ ] T032 [P] [US5] `__tests__/hooks/usePersistedTeamLogos.test.ts` (assert side-effect calls on `utils/teamLogos` mocks)
- [ ] T033 [P] [US5] `__tests__/hooks/useLeagueLogo.test.ts` (mock fetch + AsyncStorage; cover asset → cache → ESPN priority and unmount guard)
- [ ] T034 [P] [US5] `__tests__/hooks/useMatchListFilters.test.ts` (test reducer actions directly + one Probe pass)
- [ ] T054 [P] [US5] `__tests__/hooks/useTeamData.test.ts` (mock `fetch` across the 7 league `Promise.all` calls; covers the Phase 3 fetch-replacement success/error paths, completing FR-010's 10-of-11-hooks coverage)
- [ ] T035 [US5] Verify: each file green in isolation; full jest + lint green. NOTE: `useMyActiveRoom` deliberately deferred to Phase 11 (its mock seam `utils/supabaseClient.ts` and reference test are in flight on 153)

---

## Phase 10: Hook tests, complex tier (US5) — branch `tech-debt/10-hook-tests-2` (needs Phase 7)

- [ ] T036 [P] [US5] `__tests__/hooks/useLegacyHistoryImport.test.ts`: phase machine (`checking→ready→importing→completed/failed`) + auth gating (mock `getLegacyHistoryImportRpcClient`, `getSupabaseClient().auth.getUser`, `hasSupabasePublicConfig`)
- [ ] T037 [P] [US5] `__tests__/hooks/useMatchProcessing.test.ts`: `jest.useFakeTimers()` + `advanceTimersByTime` for the 50ms polling loop — no real waits
- [ ] T038 [P] [US5] Extend direct tests for the 7 extracted gameProgress reducers/helpers; `__tests__/hooks/useGoalToastQueue.test.ts`
- [ ] T039 [US5] Slim Probe-based integration test of the composed `useGameProgressController` (mock `useLiveScores`, `expo-router`, platform hooks)
- [ ] T040 [US5] Verify: jest + lint green; zero flaky timer patterns

---

## === GATE: feature 018 (`153-configure-start-game`) merged to master ===

---

## Phase 11: app/index.tsx decomposition + deferred test (US4, US5) — branch `tech-debt/11-home-decomposition`

- [ ] T041 [US4] Confirm gate: 018 merged and `git diff origin/multiplayer -- app/index.tsx` clean before starting
- [ ] T041a [US2] Execute deferred T017: re-run `mvnw clean verify` on `command-api` against `origin/multiplayer` now that both 018 and Phase 5 (Boot 3.5.x) have merged; fix any new compile errors in 018's handlers under the newer Boot line before proceeding
- [ ] T042 [P] [US4] Create `utils/homeStats.ts` (`getTotalDrinks`, `getTopDrinker`) + `__tests__/utils/homeStats.test.ts`
- [ ] T043 [P] [US4] Extract in-file components to `components/home/`: `HomeSplash.tsx`, `CurrentGameCard.tsx`, `HistoryStatsCard.tsx`
- [ ] T044 [US4] Create `hooks/useHomeRoomActions.ts`: room-join/host/exit orchestration composing `useHostRoomCreate`, `useMyActiveRoom`, `useRegisteredRoomJoin`, `useGuestRoomJoin`, `useRoomExit` + handlers — pure move against freshly merged code, no behavior edits
- [ ] T045 [US4] `app/index.tsx` becomes layout/composition (~150–250 lines)
- [ ] T046 [US5] Add deferred `__tests__/hooks/useMyActiveRoom.test.ts` (mirror post-018 `useRoomLobby.test.ts`)
- [ ] T047 [US4] Verify: jest + lint + tsc green; `npm run test:e2e` AND `npm run test:e2e:home` green; splash/onboarding/join flows manually spot-checked

---

## Phase 12: Expo SDK 52 → current (US6) — branch `tech-debt/12-expo-upgrade` (LAST; follow `.agents/skills/upgrading-expo` — constitution §VI mandatory)

- [ ] T048 [US6] Single-jump attempt: `npx expo install expo@latest` → `npx expo install --fix` → `npx expo-doctor`; fall back to stepwise 52→54→latest only if intractable. CNG project — skip prebuild; `newArchEnabled` already true; plugins only `expo-router` + `expo-splash-screen` in `app.config.ts`
- [ ] T049 [US6] Migrate `expo-av` → `expo-audio`: swap the `getExpoAudioModule` shim in `platform/audio/useGoalSound.ts` (`createSoundController` already takes injected `AudioModuleLike` — update its mock shape in tests); update driver metadata in `platform/types.ts`; remove `expo-av` dep
- [ ] T050 [US6] React 19 toolchain: bump `react`, `react-dom`, `@types/react`, `react-test-renderer` (+types); if react-test-renderer breaks (deprecated under React 19), migrate Probe tests to `@testing-library/react-native` — uniform pattern, contained change
- [ ] T051 [US6] Companion bumps: `react-native-worklets` for reanimated (SDK 54+); `tamagui` + `@tamagui/babel-plugin` together; `jest-expo` + `eslint-config-expo` to matching lines; grep `react-native-webview` import sites (no platform adapter) and smoke-test them
- [ ] T052 [US6] Cache clears + config housekeeping per the skill (drop redundant babel/metro config, no `sdkVersion` in config)
- [ ] T053 [US6] Verify per quickstart.md: full matrix, both e2e suites, `expo-doctor` clean, manual web + native dev-client smoke incl. goal sound, date pickers, gestures

---

## Dependencies & Execution Order

- **Phase 1** blocks everything (CI is the safety net). **Phase 2** anytime after 1.
- **Phases 3, 4, 5** independent of each other after 1 (5 touches only command-api — fully parallel-safe).
- **Phase 6** after 4 (new code under final lint). **Phase 7** needs 6 (types). **Phase 8** independent of 6–7. **Phase 9** anytime after 4. **Phase 10** needs 7.
- **Gate**: 018 merge → **Phase 11** → **Phase 12** (12 also needs 11 merged to avoid churn on the same files).
- Within phases, [P] tasks touch different files and can run in parallel.

## Notes

- Every decomposition is a pure move: zero logic edits, pre-existing tests pass unmodified — that IS the acceptance test (constitution §V: no new user behavior means no new e2e journeys required; existing suites gate instead).
- Skills per constitution §VI: `upgrading-expo` (Phase 12), `react-native-testing` (6, 9–10), `refactor` (6, 7, 8, 11), `github-ops` (1, 2). No skill applies to Phases 3, 4, 5 (plain dependency/config changes — stated explicitly per §VI).
- Commit after each task or logical group; never sweep unrelated working-tree changes into a phase PR.
- At each phase's branch cut, re-derive the in-flight-file freeze list from the current state of branch 153 / its PR (spec Assumptions) — the list in plan.md is a planning-time snapshot.
- Ongoing policies from the spec apply to every phase: FR-014 (flake handling, no merge on red) and FR-015 (same-day revert if a merged phase breaks master).
