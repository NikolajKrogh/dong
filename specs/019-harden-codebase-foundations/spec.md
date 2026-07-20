# Feature Specification: Harden Codebase Foundations

**Feature Branch**: `019-harden-codebase-foundations`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Tech-debt remediation: CI for client and DB, dependency upgrades (Spring Boot 3.5, ESLint 9, Expo SDK), ESPN parsing consolidation, god-file decomposition, hook test back-fill"

> Origin: a repo-wide tech-debt audit (2026-07-19) scored eleven findings; the eight highest-priority items were approved for remediation. This feature changes no end-user behavior — every story is a developer/operations journey whose acceptance criteria are behavior-preservation plus a new automated guarantee.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every pull request is automatically verified (Priority: P1)

As a contributor, when I open a PR touching the Expo client or the Supabase schema, CI runs the same checks the constitution requires me to run locally (lint, Jest unit tests, pgTAP), so regressions cannot merge unnoticed. Today only `command-api/` has CI.

**Why this priority**: Highest audit score (40). Every other story in this feature relies on CI to prove behavior preservation.

**Independent Test**: Open a PR with a deliberately failing unit test → the client workflow goes red. Open a PR with a failing pgTAP assertion → the DB workflow goes red.

**Acceptance Scenarios**:

1. **Given** a PR that modifies client source, **When** CI runs, **Then** ESLint and the full Jest suite execute in non-watch mode and gate the merge.
2. **Given** a PR that modifies `supabase/**`, **When** CI runs, **Then** the local Supabase stack boots and all pgTAP tests execute and gate the merge.
3. **Given** a PR that modifies only `command-api/**`, **When** CI runs, **Then** the client and DB workflows are skipped (path filters) and the existing Java workflow still runs.

> **Scope note**: a fourth acceptance scenario originally covered a follow-up CI job running the Playwright e2e suite. That was attempted and abandoned — see research.md D11. Three fix attempts each surfaced a different real problem (a dev-server memory leak too large to fix by raising heap limits, then a dev-vs-production behavioral regression once the leak was worked around), and continuing would have meant debugging application behavior rather than authoring CI. The Playwright suite itself is untouched and still runs via `npm run test:e2e` locally/manually; there is simply no CI automation for it in this feature.

---

### User Story 2 - The toolchain sits on supported dependency lines (Priority: P2)

As a maintainer, the security-sensitive Java service runs on a supported Spring Boot line (3.5.x, not EOL 3.3.x), linting runs on supported ESLint 9, TypeScript is current 5.x, and unused HTTP libraries (axios, node-fetch) are gone from the dependency tree.

**Why this priority**: EOL frameworks stop receiving patches; the JWT-validating command-api is exactly the component that must stay patchable. Cheap to fix (audit scores 30/25/15).

**Independent Test**: `.\mvnw.cmd clean verify` passes on Boot 3.5.x; `npm run lint` passes under ESLint 9 flat config; `git grep` finds no axios/node-fetch imports.

**Acceptance Scenarios**:

1. **Given** the upgraded pom, **When** `mvnw clean verify` runs, **Then** all tests pass and `/swagger-ui` and `/v3/api-docs` still serve.
2. **Given** the flat ESLint config, **When** `npm run lint` runs, **Then** it completes with zero errors and the legacy `.eslintrc.js`/`.eslintignore` are deleted.
3. **Given** the dependency cleanup, **When** `hooks/useTeamData.ts` fetches league data, **Then** it uses `fetch` with explicit non-2xx handling and behaves identically to the axios version (same success/error states).

---

### User Story 3 - ESPN payload parsing lives in one typed module (Priority: P3)

As a developer, when ESPN changes its payload shape I fix one typed parser with unit tests, not three `any`-typed copies scattered across hooks and utils. Dead parsing code is deleted.

**Why this priority**: Correctness risk (audit score 24) — the live-score path is parsed untyped and untested today.

**Independent Test**: `__tests__/utils/espnParsing.test.ts` exercises the parser against recorded fixtures; deleting a field from a fixture fails a test, not production silently.

**Acceptance Scenarios**:

1. **Given** the consolidated `utils/espnParsing.ts`, **When** `useLiveScores` polls, **Then** match scores, scorers, cards, and statistics render exactly as before (characterization tests written against pre-move behavior).
2. **Given** the dead-code removal, **When** the build runs, **Then** `extractTeamsFromESPNEvent` and the unused `useTeamFiltering` hook no longer exist, while `filterMatchesByDateAndTime` (still consumed by `MatchList`) keeps working.

---

### User Story 4 - Oversized modules are decomposed along natural seams (Priority: P4)

As a developer, the four god files (`app/index.tsx` 954 lines, `components/gameProgress/MatchQuickActionsModal.tsx` 1424, `hooks/useAccountAuth.ts` 786, `hooks/useGameProgressController.ts` 603) are fully decomposed into focused modules with unchanged public behavior, so features touching home, game progress, or auth stop paying a comprehension tax.

**Why this priority**: Slows all work in those areas (audit score 18) but must follow US3 (shared types move first) and precede the complex half of US5.

**Independent Test**: All pre-existing unit/e2e tests pass **unmodified** after each decomposition PR; extracted pure functions gain direct unit tests.

**Acceptance Scenarios**:

1. **Given** the gameProgress decomposition, **When** the existing gameProgress component tests and e2e flows run, **Then** they pass without edits (import paths preserved via folder `index.tsx` / re-exports).
2. **Given** the `useAccountAuth` split, **When** the existing `__tests__/hooks/useAccountAuth.test.ts` runs unmodified, **Then** it is green.
3. **Given** the `app/index.tsx` decomposition (after feature 018 merges), **When** home flows run (`test:e2e:home`), **Then** splash, onboarding, and room join/host/exit behave identically.

---

### User Story 5 - Previously untested hooks have unit coverage (Priority: P5)

As a maintainer, the 11 untested hooks — `useTeamLogo`, `usePlayerSuggestions`, `usePersistedTeamLogos`, `useLeagueLogo`, `useMatchListFilters`, `useTeamData`, `useLegacyHistoryImport`, `useMatchProcessing`, `useGameProgressController`, `useMyActiveRoom`, and `useTeamFiltering` — have unit tests following the repo's established react-test-renderer Probe pattern, so refactors and upgrades have a safety net. Exception: `useTeamFiltering` is deleted as dead code in Phase 6 (its only live export, `filterMatchesByDateAndTime`, is relocated and tested there) rather than given its own test file — it does not count toward SC-003's denominator.

**Why this priority**: Audit score 24, but the complex tier depends on US4's decomposition to be testable in small pieces.

**Independent Test**: Each new test file runs green in isolation (`npx jest __tests__/hooks/<file>`); the CI from US1 gates them.

**Acceptance Scenarios**:

1. **Given** the trivial/medium tier, **When** Jest runs, **Then** `useTeamLogo`, `usePlayerSuggestions`, `usePersistedTeamLogos`, `useLeagueLogo`, and `useMatchListFilters` each have passing tests.
2. **Given** the complex tier, **When** Jest runs, **Then** `useLegacyHistoryImport` (phase machine + auth gating), `useMatchProcessing` (fake timers), the extracted gameProgress reducers/helpers, and `useGoalToastQueue` each have passing tests.
3. **Given** feature 018 has merged, **Then** `useMyActiveRoom` gains a test mirroring the post-018 `useRoomLobby` test.

---

### User Story 6 - The client runs on a current Expo SDK (Priority: P6)

As a maintainer, the app targets the current Expo SDK (from 52), including the `expo-av` → `expo-audio` migration inside the platform adapter and the React 19 toolchain bumps, so the app stays within Expo's support window and store target-API deadlines.

**Why this priority**: Highest-risk, largest-churn item (audit score 14); deliberately last, gated on feature 018 merging.

**Independent Test**: `npx expo-doctor` reports clean; full local matrix (lint, Jest, tsc, both e2e suites) passes; manual web + dev-client smoke test.

**Acceptance Scenarios**:

1. **Given** the upgraded SDK, **When** a goal is scored in game progress, **Then** the goal sound plays via the migrated `expo-audio` adapter on native and web fallback behavior is unchanged.
2. **Given** the upgraded SDK, **When** the full test matrix and e2e suites run, **Then** all pass.

---

### Edge Cases

- CI on a docs-only PR: path filters must skip both heavy workflows (client-ci, db-ci).
- pgTAP job when Docker/Supabase boot is slow: `health_timeout` is 2m in `supabase/config.toml`; the job must fail loudly, not hang.
- Fetch replacement in `useTeamData`: axios rejects on non-2xx and auto-parses JSON; the fetch version must replicate both or error states change silently.
- Characterization fixtures for ESPN parsing must cover: own goals, penalties, red/yellow cards, missing `athletesInvolved`, matches without statistics, plus malformed-input cases — empty `competitions`, missing `status`, malformed event — asserting the current behavior (parser returns `null`). Nothing is excluded from fixture scope.
- CI infrastructure failure vs test failure: both fail red; only test failures carry the FR-014 one-working-day flake policy. The pgTAP job runs `supabase stop` under `if: always()`; runners are ephemeral, so leaked state after a failed stop is accepted, but a partially executed suite is always a red run.
- `paths-ignore` semantics: the client workflow uses `paths-ignore` (not `paths`), so any newly added top-level non-client directory must be appended to the ignore list or it will (safely) trigger client CI — false runs are accepted, false skips are not.
- Decomposition PRs landing while feature 018 is in flight: the plan's in-flight file list must be respected (re-derived at branch cut per Assumptions); `app/index.tsx` work and the Expo upgrade wait for the 018 merge gate.
- Decomposition verification is web-only (Jest + web e2e) until Phase 12's native smoke test. Acceptable under constitution §I because decompositions are pure moves touching no `platform/` adapter or platform-branching code — any decomposition that would touch platform-sensitive code loses this exemption and requires a native check in its own PR.
- React 19 (Expo phase) deprecates react-test-renderer: if it breaks, the Probe-pattern tests migrate to `@testing-library/react-native` — a contained, uniform change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CI MUST run ESLint and the Jest suite (non-watch) on every PR touching client code, and pgTAP on every PR touching `supabase/**`.
- **FR-002**: CI workflows MUST follow this closed convention list: (a) action versions pinned to exact tags (e.g. `actions/checkout@v4.1.7`) — a conscious choice consistent with the existing `java-ci.yml` convention; SHA-pinning is stricter supply-chain hardening but is out of scope here (raise separately if desired), (b) `persist-credentials: false` on checkout, (c) path filtering so unrelated changes skip the job, (d) a least-privilege `permissions: contents: read` block, (e) no repository secrets referenced (this also keeps fork PRs green; adding a secret later requires a spec amendment). Mirroring anything else from `java-ci.yml` is optional.
- **FR-003**: A `test:ci` script MUST exist; the local `npm test` watch behavior MUST be preserved.
- **FR-004**: `test-results/` and `playwright-report/` MUST be gitignored and the committed artifact removed; the stale `CLAUDE.md` speckit plan pointer MUST be corrected in the same phase (repo hygiene, no independent SC).
- **FR-005**: command-api MUST build and pass all tests on Spring Boot 3.5.x with compatible springdoc (2.8.x) and logstash-logback-encoder (8.x).
- **FR-006**: Linting MUST run on ESLint 9 flat config via `eslint-config-expo` 9; TypeScript target = the latest stable 5.x that `eslint-config-expo` 9 supports at the Phase 4 branch cut; `@types/react` stays 18.x until the Expo phase.
- **FR-007**: `axios` and `node-fetch` MUST be removed from dependencies with fetch replacement in `hooks/useTeamData.ts`. Equivalence criteria: reject on non-2xx status, parse JSON bodies, and preserve the exact user-visible error string (`"Failed to fetch team data"`) and `isLoading`/`isError` state transitions.
- **FR-008**: ESPN parsing MUST be consolidated into one module typed against `types/espn.ts`, covered by fixture-based unit tests. Dead-code deletions MUST be re-verified immediately before deletion via repo-wide grep for each symbol name; any non-test hit cancels that deletion.
- **FR-009**: The four god files MUST be decomposed into focused modules — no file among the decomposition targets and their extracted modules may exceed 400 physical lines (`wc -l`) — with public behavior and import paths preserved (re-exports where needed). The "every pre-existing test passes unmodified" rule applies per decomposition PR (Phases 7, 8, 11) and expires at Phase 12, where a test-harness migration is in scope if React 19 requires it.
- **FR-010**: Of the 11 hooks named in US5, the 10 that survive Phase 6 MUST gain unit tests following the react-test-renderer Probe pattern (mocking the `utils/supabaseClient` RPC factories, `expo-router`, and `fetch` as applicable); `useTeamFiltering` is deleted rather than tested (see US5).
- **FR-011**: The client MUST be upgraded to the current Expo SDK following `.agents/skills/upgrading-expo`, including `expo-av` → `expo-audio` inside `platform/audio/`.
- **FR-012**: Work MUST be delivered as one PR per plan phase, each branched from `origin/multiplayer` and independently revertible; phases touching in-flight 018 files MUST wait for the 018 merge gate.
- **FR-013**: The `client-ci` and `db-ci` jobs MUST be configured as required status checks on trunk branch protection as part of Phase 1 acceptance; the gate MUST be proven once by an induced-failure demonstration on a scratch branch. If the implementer lacks repo-admin rights to configure branch protection, Phase 1 MAY still merge with the workflows green, provided the exact required-check names are documented in the PR description as an explicit handoff item for whoever holds admin rights — FR-013 is then satisfied only once that handoff is actioned. **A third `e2e-ci` job is explicitly OUT OF SCOPE for this feature** (decision recorded in research.md D11, superseding all earlier e2e-ci plans in this document): three separate fix attempts each surfaced a different unresolved problem in making the Playwright suite reliable under CI, and continuing would have meant debugging application runtime behavior rather than authoring a workflow. No e2e CI job ships as part of this feature; `npm run test:e2e` remains a local/manual verification step only.
- **FR-014**: Infrastructure-caused CI failures (Docker daemon, image pulls, registry outages) fail the run red — no automatic retry; re-runs are manual. A test observed to fail intermittently MUST be fixed or skipped-with-linked-issue within one working day; merging on a red required check is never permitted.
- **FR-015**: If a merged phase later breaks `master`, the default remedy is a same-day revert of that phase's PR; fix-forward is allowed only when the fix is demonstrably smaller than the revert.

### Key Entities

No new persisted entities. TypeScript type relocations only (see data-model.md): `MatchWithScore`, `GoalScorer`, `MatchStatistics` move from `hooks/useLiveScores.ts` to `types/`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A PR with a failing unit test, lint error, or pgTAP failure cannot merge (red required check) — previously 0% of client/DB regressions were machine-caught. Verified once by the FR-013 induced-failure demonstration on a scratch branch.
- **SC-002**: command-api runs on a Spring Boot line receiving OSS patches (3.5.x) — currently 3.3.5, past EOL.
- **SC-003**: Every hook file in `hooks/` has a corresponding test file at feature completion. Denominator = hooks existing at completion (21 today, minus the deleted `useTeamFiltering` hook, plus any hooks feature 018 adds at merge).
- **SC-004**: ESPN payload parsing has exactly one implementation with 0 `any`-typed parse paths (down from 3), with fixture tests. Verified by grep: ESPN field access (`competitions[0]`, `homeAway`, `athletesInvolved`) appears only in `utils/espnParsing.ts` and its tests. The openfootball JSON parser in `useTeamData` is not ESPN parsing and is out of scope of this criterion.
- **SC-005**: No file among the decomposition targets and their extracted modules exceeds 400 physical lines (`wc -l`); all pre-existing tests pass unmodified in each decomposition PR (rule expires at Phase 12 per FR-009).
- **SC-006**: `npx expo-doctor` reports no issues on the current SDK; `expo-av` no longer appears in `package.json`.
- **SC-007**: Zero end-user-visible behavior changes, verified via manual/local `npm run test:e2e` runs plus the quickstart manual smoke list (no e2e CI ships in this feature — see FR-013); screens covered by neither are accepted as documented residual risk.

## Assumptions

- Feature 018 (`153-configure-start-game`) merges before the `app/index.tsx` decomposition and the Expo upgrade begin; all earlier phases avoid its in-flight files. **Fallback**: if 018 is delayed beyond ~4 weeks or abandoned, Phases 11–12 unblock by re-baselining against whatever `master` then contains, once the lobby/room files have been stable for a week.
- The in-flight file list in plan.md is a snapshot of branch 153 at planning time; each phase MUST re-derive it from the current state of branch 153 (or its PR) at branch-cut time rather than trusting the snapshot.
- GitHub-hosted `ubuntu-latest` runners (Docker preinstalled) are available for the pgTAP job; per FR-002(e) the client/DB/e2e workflows reference no repo secrets.
- Assumed-compatible third-party versions (springdoc 2.8.x ↔ Boot 3.5, eslint-config-expo 9 ↔ ESLint 9, tamagui ↔ its babel plugin, jest-expo ↔ SDK) are re-resolved at each phase's branch cut to the latest versions documented compatible; any drift from the versions named here is recorded in research.md.
- The Expo upgrade targets the latest stable SDK at the time the Phase 12 branch is cut. The single-jump attempt is timeboxed to one working day; on failure, reset the branch and go stepwise (52→54→latest). A partially upgraded state never merges.

## Traceability

Audit item numbers (1–8) appear only in the origin note above and in research.md; all working references use FR/SC/task IDs.

| FR | Tasks | SC |
|---|---|---|
| FR-001 | T002, T003 | SC-001 |
| FR-002 | T002, T003 | SC-001 |
| FR-003 | T001 | SC-001 |
| FR-004 | T004, T005 | SC-007 |
| FR-005 | T015–T016 (T017 deferred to Phase 11) | SC-002 |
| FR-006 | T012–T014 | SC-007 |
| FR-007 | T009–T011 | SC-007 |
| FR-008 | T018–T022 | SC-004 |
| FR-009 | T023–T029, T041–T045 | SC-005 |
| FR-010 | T030–T040, T046, T054 | SC-003 |
| FR-011 | T048–T053 | SC-006 |
| FR-012 | all phases | SC-007 |
| FR-013 | T006 (e2e-ci: abandoned, T007-T008d document why) | SC-001 |
| FR-014 | T006 (policy; applies ongoing) | SC-001 |
| FR-015 | policy; applies to every merged phase | SC-007 |
