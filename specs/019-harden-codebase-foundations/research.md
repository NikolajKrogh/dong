# Research: Harden Codebase Foundations

**Feature**: 019-harden-codebase-foundations | **Date**: 2026-07-19

Consolidated findings from the tech-debt audit and three targeted codebase explorations (CI/test infrastructure; ESPN parsing + hook-test patterns; god files + upgrade surface). All NEEDS CLARIFICATION items resolved — user decisions recorded below.

## D1. CI scope and shape

- **Decision**: Three separate workflow files (`client-ci.yml`, `db-ci.yml`, `e2e-ci.yml`), e2e shipped as a fast-follow after lint+Jest+pgTAP are green on master. Mirror `java-ci.yml` conventions: pinned action versions, `persist-credentials: false`, path filtering. Add `"test:ci": "jest --ci"`; keep `"test": "jest --watchAll"` for local dev.
- **Rationale**: `jest --watchAll` hangs CI. Separate files = independent revertibility (user decision). Path filters keep docs-only PRs cheap. `jest.setup.ts` was audited — pure mocks, nothing CI-hostile.
- **Key finding**: the Playwright suite needs **no backend** in CI — `playwright.config.ts` self-boots Expo web on :8093 and `e2e/steps/browser-flow.helpers.ts` mocks every Supabase/command-api call via `page.route()`. The e2e job is only Node + `npx playwright install --with-deps chromium`.
- **DB job**: `npx supabase start` (Docker preinstalled on ubuntu-latest; non-default 553xx ports and 2m health timeout already in `supabase/config.toml`) → `npx supabase test db` (33 pgTAP files) → always-run `supabase stop`. No secrets required.
- **Alternatives considered**: one monolithic workflow (rejected: revert granularity); running e2e against a real local Supabase (rejected: unnecessary — mocks already in place).

## D2. Spring Boot 3.3.5 → 3.5.x

- **Decision**: Bump parent to latest 3.5.x; co-bump `springdoc` 2.6.0 → 2.8.x and `logstash-logback-encoder` 7.4 → 8.x; remove the `maven-compiler-plugin` 3.10.1 pin (incl. `fork`/`executable=javac` override) and let the Boot parent manage it. Leave jjwt 0.12.6 and caffeine 3.1.8.
- **Rationale**: 3.3.x OSS support ended mid-2025 — the JWT-validating service must stay patchable. springdoc 2.6 targets Framework 6.1 (Boot 3.3) and is the highest-risk pin; Boot 3.5 ships Logback 1.5 which predates logstash-encoder 7.4. Code audit found no blockers: security config is already lambda-DSL `SecurityFilterChain` (no `WebSecurityConfigurerAdapter`), HTTP via `RestClient`, jjwt on the modern 0.12 API.
- **Alternatives considered**: stop at 3.4.x (rejected: shorter support runway for the same effort).

## D3. ESLint 8 → 9 + TypeScript bump

- **Decision**: `eslint` ^9 + `eslint-config-expo` ^9 with a new flat `eslint.config.js`; fold `.eslintrc.js` (`ignorePatterns: ['/dist/*']`) and all 15 `.eslintignore` entries into `ignores`; delete both legacy files. TypeScript → current 5.x. **Hold `@types/react` at ~18.3** until the Expo/React 19 phase.
- **Rationale**: ESLint 8 EOL since Oct 2024; `eslint-config-expo` 9 is the flat-config line `expo lint` expects under ESLint 9. Migration risk measured: exactly **one** `eslint-disable` comment in all source (`utils/teamLogos.ts`). tsconfig extends `expo/tsconfig.base` with `strict` already on — TS bump low-risk.
- **Alternatives considered**: `ESLINT_USE_FLAT_CONFIG=false` compatibility mode (rejected: postpones the same migration).

## D4. axios / node-fetch removal

- **Decision**: Replace the single `axios.get` in `hooks/useTeamData.ts` with `fetch` + explicit `res.ok` check; remove both deps.
- **Rationale**: axios is used in exactly one file (repo-wide grep), no interceptors/instances; node-fetch has zero usages. The fetch version must replicate axios's reject-on-non-2xx and JSON parsing to keep error states identical.

## D5. ESPN parsing consolidation

- **Decision**: Move `processApiMatch`, `parseStatistics`, `extractMatchId` from `hooks/useLiveScores.ts` into new `utils/espnParsing.ts`, typed against `types/espn.ts` (extending the types where parsers read missing fields). Move `MatchWithScore`/`GoalScorer`/`MatchStatistics` to `types/matchScores.ts` with re-exports from `useLiveScores.ts`. **Write characterization tests against current behavior before moving any code.** Delete dead code: `extractTeamsFromESPNEvent` (utils/matchUtils.ts) and the `useTeamFiltering` hook — both confirmed to have no production consumers — while relocating the still-used `filterMatchesByDateAndTime` (consumed by `components/setupGame/MatchList.tsx:20`).
- **Rationale**: Three parsers existed for three data sources; only the live-score path actually parses ESPN untyped. `useTeamData` parses openfootball JSON (not ESPN — needs only D4), `useMatchData` already goes through the command-api proxy. `types/espn.ts` is mostly complete but bypassed by `any` at the two call sites.
- **Fixture coverage required**: own goals, penalties, red/yellow cards, missing `athletesInvolved`, matches without statistics (all read by `processApiMatch`).

## D6. God-file decomposition (user decision: FULL decomposition)

- **Decision**: Three PRs along explored seams, behavior-preserving pure moves only:
  - `useGameProgressController.ts` (603): 7 pure reducers/helpers → `hooks/gameProgress/`; toast subsystem → `useGoalToastQueue`; controller keeps identical public signature.
  - `MatchQuickActionsModal.tsx` (1424): folder module per the sibling `MatchesGrid/` pattern (`index.tsx` shell, `StatProgressBar`, `PossessionCircle`, ~370-line `styles.ts`, `types.ts`); SVG math → `utils/svgArc.ts`; 8 `Animated.Value` refs → `useMatchQuickActionsAnimations`.
  - `useAccountAuth.ts` (786, has tests): route/URL builders → `utils/accountAuthRoutes.ts`; Supabase persistence → `utils/accountRepository.ts`; settings-sync → `useAccountSettingsSync`; **acceptance criterion: existing test file passes unmodified** (re-export every symbol it imports).
  - `app/index.tsx` (954): **post-018 gate** — helpers → `utils/homeStats.ts`, in-file components → `components/home/`, room orchestration → `useHomeRoomActions`; screen becomes layout.
- **Rationale**: seams verified by exploration (helpers already exported in useAccountAuth; reducers already isolated at top of controller; sibling folder pattern exists). Ordering: after D5 (types move first), before complex hook tests (test small pieces, not monoliths).

## D7. Hook test back-fill pattern

- **Decision**: Follow the repo's established pattern exactly: **react-test-renderer + Probe component + `TestRenderer.act`** (reference: `__tests__/hooks/useRoomLobby.test.ts`, `useHostRoomCreate.test.ts`). Mock seam = `jest.mock` the RPC-client factories in `utils/supabaseClient` and `expo-router`; RN/Animated mocks from `test-utils/platform.ts`. Two tiers: trivial/medium first (useTeamLogo, usePlayerSuggestions, usePersistedTeamLogos, useLeagueLogo, useMatchListFilters), complex after decomposition (useLegacyHistoryImport, useMatchProcessing with `jest.useFakeTimers` + `advanceTimersByTime`, gameProgress pieces). **`useMyActiveRoom` deferred to post-018** — its mock seam and reference test are both in flight on branch 153.
- **Rationale**: `@testing-library/react-native`'s `renderHook` is NOT the repo convention (verified: never imported by an actual test). Consistency beats preference; a wholesale migration may come free with React 19 (see D8 risk).

## D8. Expo SDK 52 → current (user decision: after 018 merges, last phase)

- **Decision**: Follow `.agents/skills/upgrading-expo`. Attempt single jump (`npx expo install expo@latest` → `--fix` → `expo-doctor`); fall back to stepwise 52→54→latest only if intractable. CNG project — skip all prebuild steps. Known work: `expo-av` → `expo-audio` (blast radius contained in `platform/audio/useGoalSound.ts`'s `getExpoAudioModule` shim — `createSoundController` takes an injected `AudioModuleLike`; also update `platform/types.ts` driver metadata); React 19 bumps (`react`, `react-dom`, `@types/react`, `react-test-renderer`); `react-native-worklets` for reanimated on SDK 54+; `tamagui` + `@tamagui/babel-plugin` together; `jest-expo`/`eslint-config-expo` to matching lines; `react-native-webview` has **no adapter** — grep import sites and smoke-test.
- **Risk accepted**: react-test-renderer is deprecated under React 19; if broken, migrate Probe tests to `@testing-library/react-native` (uniform pattern = contained change).
- **Rationale for last**: highest churn; every earlier phase (CI, tests, decomposition) reduces its risk; single-PR revert if it goes badly.

## D10. Trunk branch correction (supersedes original D9 assumption)

- **Decision**: Every phase branches from `origin/multiplayer`, not `origin/master`.
- **Rationale**: empirically verified while attempting to cut the Phase 1 branch: `origin/master` (confirmed as the repo's default HEAD branch) contains no `supabase/` or `command-api/` directory at all — `git ls-tree origin/master` shows neither, and its `package.json` lacks `db:*`/`test:e2e` scripts. `git log origin/master..origin/multiplayer` shows 19 unmerged commits spanning platform abstractions, the Supabase schema/RLS, the Java command-api bootstrap, the ESPN proxy, and host/room features through PR #167. `origin/multiplayer` is where all real feature work has actually landed; `origin/master` is not merely stale, it predates two of the three subsystems this feature exists to remediate. The original plan's "local master is stale" note undersold this — it read as ordinary lag, not a missing-subsystem gap.
- **Impact**: FR-012 and every phase's branch-cut instruction (plan.md, tasks.md, quickstart.md) were corrected from `origin/master` to `origin/multiplayer`. No other phase content changes — the file paths, seams, and task breakdown were derived from the actual working tree (which already reflected `multiplayer`), not from `origin/master`, so they remain valid.
- **Follow-up (out of scope for this feature)**: whether/when `master` should be fast-forwarded or `multiplayer` merged into it is a repository-management decision for the user, not something this feature's phases should attempt.

## D9. Delivery & git strategy (user decisions)

- One PR per phase, branched from `origin/multiplayer` (**local master is stale** — verified at PR #148 while 153 contains later merges). Spec/plan artifacts written to working tree without committing (018 work is uncommitted in the same tree). Speckit pointers (`.specify/feature.json`, CLAUDE.md SPECKIT block) switched to 019 per user choice. Optional speckit git auto-commit hooks skipped — the dirty tree must never be swept into a commit.
- Repo hygiene folded into Phase 1: gitignore `test-results/` + `playwright-report/`, `git rm --cached` the one committed Playwright artifact.
