# Tasks: Harden Codebase Foundations

**Input**: Design documents from `/specs/019-harden-codebase-foundations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Grouped by user story (US1–US6). Each "Phase" below is one PR branched from `origin/multiplayer` (`git fetch origin && git checkout -b <branch> origin/multiplayer`). Verification commands per phase: see [quickstart.md](./quickstart.md). **Gate**: Phases 11–12 start only after feature 018 (`153-configure-start-game`) merges. Phases 1–10 must not touch the in-flight files listed in plan.md Technical Context.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable within its phase (different files, no dependencies)

---

## Phase 1: Client + DB CI, repo hygiene (US1) 🎯 MVP — branch `tech-debt/01-client-db-ci` — ✅ IMPLEMENTED locally 2026-07-19 (commit d1fa91e on `tech-debt/01-client-db-ci`, based off `origin/multiplayer` per the D10 trunk correction; not yet pushed/PR'd — pending user go-ahead)

- [x] T001 [US1] Add `"test:ci": "jest --ci"` script to `package.json` (keep `"test": "jest --watchAll"` for local dev)
- [x] T002 [P] [US1] Create `.github/workflows/client-ci.yml` per the FR-002 closed convention list (pinned `actions/checkout@v4.1.7` + `persist-credentials: false`, pinned `actions/setup-node@v4.0.4` with `cache: npm`, `permissions: contents: read`, no secrets); triggers push/PR with `paths-ignore: ["command-api/**", "supabase/**", "specs/**", ".agents/**", "*.md"]` plus a workflow comment noting that new top-level non-client dirs must be appended to the ignore list; steps: `npm ci` → `npm run lint` → `npm run test:ci`. Verified locally (see below); `npx tsc --noEmit` step omitted (not yet run clean repo-wide, left for a later phase to confirm before adding)
- [x] T003 [P] [US1] Create `.github/workflows/db-ci.yml` per the FR-002 convention list: paths `supabase/**` + workflow file; `npx supabase start` → `npx supabase test db` → `npx supabase stop` under `if: always()` (Docker preinstalled on ubuntu-latest; ports/timeouts already in `supabase/config.toml`; partial suite execution = red run per spec Edge Cases)
- [x] T004 [P] [US1] Add `test-results/` and `playwright-report/` to `.gitignore`; `git rm -r --cached test-results/` (one committed Playwright PNG) — done
- [x] T005 [P] [US1] Fix stale plan pointer in `CLAUDE.md` SPECKIT block — de-pinned to "highest-numbered specs/ directory" wording (done on the Phase 1 branch; note this branch's own copy of CLAUDE.md, edited separately during 019 spec authoring on `refactoring`, still points at 019 pinned — the two are reconciled whichever branch merges last)
- [ ] T006 [US1] Configure `client-ci` and `db-ci` as required status checks on `master`/trunk branch protection (FR-013). **Blocked on repo-admin access + explicit user authorization** (branch protection is shared-infrastructure config, not something to change unilaterally) — documented as a handoff item: required check names are exactly `build` (client-ci job id) and `pgtap` (db-ci job id) once the workflows are pushed. Verified locally instead: `npm run lint` clean, `npm run test:ci` → 63 suites/271 tests green, `npx supabase start && npx supabase test db` → 32 files/339 tests PASS, `npx supabase stop` clean. Induced-failure and required-check-blocks-merge demonstration still pending push + branch protection.

**Checkpoint**: CI workflows exist and are locally verified; not yet live on GitHub (unpushed) and not yet wired as required checks (T006 handoff).

---

## Phase 2: Playwright e2e CI (US1) — branch `tech-debt/02-e2e-ci`

- [ ] T007 [US1] Create `.github/workflows/e2e-ci.yml`: `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:e2e`; upload `playwright-report/` artifact on failure. No backend services (Playwright self-boots Expo web :8093, backends mocked in `e2e/steps/browser-flow.helpers.ts`). If Expo boot needs a longer timeout in CI, use env override — do NOT edit `playwright.config.ts` (in flight on 153)
- [ ] T008 [US1] Verify: job green on PR; artifact uploads on induced failure. Once stable across a few PRs, add `e2e-ci` to the required status checks (FR-013)

---

## Phase 3: Remove axios + node-fetch (US2) — branch `tech-debt/03-remove-axios-node-fetch`

- [ ] T009 [US2] Replace `axios.get` in `hooks/useTeamData.ts` (import line 2, call ~line 56 inside `Promise.all`) with `fetch` + explicit `if (!res.ok) throw` + `res.json()` — must replicate axios's reject-on-non-2xx so error states are identical
- [ ] T010 [US2] Remove `axios` and `node-fetch` from `package.json` dependencies; refresh lockfile
- [ ] T011 [US2] Verify: `git grep -E "axios|node-fetch" -- ':!package-lock.json'` clean; lint + jest green; setupGame team pickers populate on web

---

## Phase 4: ESLint 9 flat config + TypeScript bump (US2) — branch `tech-debt/04-eslint9-ts5x` (no skill applies — plain devDependency/config migration; stated per §VI)

- [ ] T012 [US2] Bump devDeps in `package.json`: `eslint` → ^9, `eslint-config-expo` → ^9, `typescript` → current 5.x. Keep `@types/react` at ~18.3 (React 19 waits for Phase 12). Drop direct `eslint-plugin-react-native` dep if only transitively required; otherwise wire into flat config
- [ ] T013 [US2] Create `eslint.config.js` from `eslint-config-expo/flat`; fold `.eslintrc.js` `ignorePatterns` + all 15 `.eslintignore` entries into `ignores`; delete `.eslintrc.js` and `.eslintignore`
- [ ] T014 [US2] Fix (or per-rule disable, documented in config) any new violations; verify sole existing suppression in `utils/teamLogos.ts` still parses; lint + jest + tsc green

---

## Phase 5: Spring Boot 3.3.5 → 3.5.x (US2) — branch `tech-debt/05-spring-boot-3.5` (parallel-safe with Phases 3–4; no skill applies — plain Maven upgrade)

- [ ] T015 [US2] In `command-api/pom.xml`: parent → latest 3.5.x; `springdoc.version` 2.6.0 → 2.8.x; `logstash.version` 7.4 → 8.x; remove `maven-compiler-plugin` 3.10.1 pin incl. `fork`/`executable=javac` override (Boot parent manages it). Leave jjwt/caffeine/jacoco/dependency-check
- [ ] T016 [US2] Verify per quickstart.md: `mvnw clean verify` green (env vars set), `/swagger-ui` + `/v3/api-docs` serve, jacoco 0.60 floor holds
- [ ] ~~T017~~ **DEFERRED — not part of the Phase 5 PR.** Relocated to Phase 11 (see T041a below): after feature 018 merges, re-run `mvnw verify` on master since 018's new command-api handlers only compile under 3.5 once both have landed. Left as a strikethrough placeholder here so Phase 5's own checklist doesn't carry a weeks-open checkbox.

---

## Phase 6: ESPN parsing consolidation + dead code (US3) — branch `tech-debt/06-espn-parsing` (skills: `react-native-testing` for T018's fixture tests, `refactor` for the T019/T020 moves)

- [ ] T018 [US3] Write fixture-based **characterization tests first** in `__tests__/utils/espnParsing.test.ts` against current `processApiMatch`/`parseStatistics`/`extractMatchId` behavior in `hooks/useLiveScores.ts`; fixtures must cover own goals, penalties, red/yellow cards, missing `athletesInvolved`, missing statistics, plus malformed inputs (empty `competitions`, missing `status`, malformed event) asserting the current `null` return
- [ ] T019 [US3] Create `utils/espnParsing.ts`: move the three parsers, typed against `types/espn.ts` (extend types where parsers read missing fields — no `any`); `useLiveScores.ts` imports them and shrinks to fetch/poll orchestration
- [ ] T020 [US3] Move `MatchWithScore`/`GoalScorer`/`MatchStatistics` to `types/matchScores.ts`; keep re-exports in `useLiveScores.ts`; migrate imports in `components/gameProgress/MatchQuickActionsModal.tsx`, `components/gameProgress/MatchesGrid/types.ts`, `MatchesGridContainer.tsx`, `hooks/useGameProgressController.ts` (none in-flight)
- [ ] T021 [P] [US3] Re-verify with grep, then delete: `extractTeamsFromESPNEvent` from `utils/matchUtils.ts` + its cases in `__tests__/utils/matchUtils.test.ts`; the `useTeamFiltering` hook from `hooks/useTeamFiltering.ts` — relocate still-used `filterMatchesByDateAndTime` to `utils/` with re-export (consumer: `components/setupGame/MatchList.tsx:20`); fix stale doc comment at `MatchList.tsx:66`
- [ ] T022 [US3] Verify: jest + lint + tsc green; characterization tests unchanged and green after the move

---

## Phase 7: gameProgress decomposition (US4) — branch `tech-debt/07-gameprogress-decomposition` (needs Phase 6; use `refactor` skill)

- [ ] T023 [US4] `hooks/useGameProgressController.ts`: move 7 pure pieces (`gameProgressUiReducer`, `toastQueueReducer`, `migrateLegacyMatch`, `calculateToastScoreDisplay`, `applyHomeGoalUpdate`, `applyAwayGoalUpdate`, `updateMatchForGoal` + their types) to `hooks/gameProgress/` modules; extract toast subsystem as `hooks/useGoalToastQueue.ts`; controller keeps identical public signature
- [ ] T024 [US4] `components/gameProgress/MatchQuickActionsModal.tsx` → folder `components/gameProgress/MatchQuickActionsModal/` per sibling `MatchesGrid/` pattern: `index.tsx` (shell), `StatProgressBar.tsx`, `PossessionCircle.tsx`, `styles.ts` (~370-line `createStyles`), `types.ts`; extract `hooks/useMatchQuickActionsAnimations.ts` (8 `Animated.Value` refs); folder `index.tsx` preserves the import path
- [ ] T025 [P] [US4] Create `utils/svgArc.ts` (`polarToCartesian`, `describeArc`) + `__tests__/utils/svgArc.test.ts`
- [ ] T026 [US4] Minimal unit tests for the moved reducers/helpers (behavior-preservation evidence; full coverage in Phase 10)
- [ ] T027 [US4] Verify: ALL pre-existing gameProgress tests pass **unmodified**; lint + tsc green; local `npm run test:e2e`; manual modal check on web. Rule: pure moves, zero logic edits

---

## Phase 8: useAccountAuth decomposition (US4) — branch `tech-debt/08-account-auth-decomposition`

- [ ] T028 [US4] Split `hooks/useAccountAuth.ts`: route/URL builders → `utils/accountAuthRoutes.ts`; Supabase persistence (`bootstrapAccountRow`, `saveAccountDisplayName`, `loadAccountSyncedSettings`, `saveAccountSyncedSettings`) → `utils/accountRepository.ts`; settings-sync effect → `hooks/useAccountSettingsSync.ts`; `useAccountAuth.ts` keeps `AccountAuthProvider` + auth actions and re-exports every symbol the existing test imports (new modules import `utils/supabaseClient` but do not modify it — no 153 conflict)
- [ ] T029 [US4] Verify acceptance criterion: `__tests__/hooks/useAccountAuth.test.ts` passes **unmodified**; jest + lint + tsc green

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
