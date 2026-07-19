# Implementation Plan: Harden Codebase Foundations

**Branch**: `019-harden-codebase-foundations` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-harden-codebase-foundations/spec.md`

## Summary

Remediate the eight highest-priority findings of the 2026-07-19 tech-debt audit across all three subsystems: add CI for the Expo client and Supabase DB (only command-api has CI today), move dependencies onto supported lines (Spring Boot 3.5, ESLint 9, current TS, drop axios/node-fetch), consolidate the triplicated `any`-typed ESPN parsing into one typed tested module, fully decompose four god files along their natural seams, back-fill unit tests for the 11 untested hooks, and finally upgrade Expo SDK 52 → current. Delivery is **12 sequential PR-sized phases** (mapped to tasks.md), each branched from `origin/multiplayer` and independently revertible, with a hard gate: the `app/index.tsx` decomposition and the Expo upgrade wait until feature 018 (`153-configure-start-game`) merges. Zero end-user behavior change; behavior preservation is proven by pre-existing tests passing unmodified plus the new CI.

## Technical Context

**Language/Version**: TypeScript 5.3 → current 5.x (client); Java 17 (command-api); SQL/pgTAP (supabase)

**Primary Dependencies**: Expo SDK 52 → current (React Native 0.76 → matching, React 18.3 → 19 in final phase), Tamagui, Zustand, Supabase JS; Spring Boot 3.3.5 → 3.5.x, springdoc 2.6 → 2.8.x, jjwt 0.12.6 (unchanged); GitHub Actions

**Storage**: No schema changes. Supabase Postgres untouched; pgTAP suite (33 files) gains a CI runner.

**Testing**: Jest (jest-expo preset, react-test-renderer Probe pattern — NOT `renderHook`), Playwright BDD (self-boots Expo web :8093, all backends mocked via `page.route()`), pgTAP via `npx supabase test db`, JUnit via `mvnw verify`

**Target Platform**: Expo web + native (CNG project, no committed native dirs); command-api on JVM 17; CI on `ubuntu-latest`

**Project Type**: Polyglot monorepo (mobile/web app + Java service + SQL)

**Performance Goals**: CI wall-clock ≤ ~10 min per workflow; pgTAP job dominated by Supabase stack boot (~2 min health timeout configured)

**Constraints**: One PR per phase off `origin/multiplayer` — the de facto trunk (see research.md D10: `origin/master` lacks `supabase/` and `command-api/` entirely and is 19 commits behind); phases 1–10 MUST NOT touch files in flight on branch 153 — snapshot below, re-derived at each branch cut per spec Assumptions (`app/lobby/[sessionId].tsx`, `hooks/useRoomLobby.ts`, `hooks/useRoomConfigure.ts`, `components/lobby/ConfigureMatchesModal.tsx`, `utils/supabaseClient.ts`, `utils/commandApiClient.ts`, `types/room.ts`, `e2e/steps/browser-flow.helpers.ts`, `playwright.config.ts`, `app/index.tsx`, command-api command/idempotency/security sources); no behavior changes anywhere

**Scale/Scope**: ~30k lines client TS, 49 Java files, 35 migrations; 12 phases / ~50 tasks

## Constitution Check

*GATE: evaluated pre-Phase-0 and re-checked post-design — PASS (no violations, no Complexity Tracking entries).*

| Principle | Assessment |
|---|---|
| I. Cross-Platform First | PASS — no user-facing behavior change; all refactors preserve web/native parity; the only platform-sensitive change (`expo-av` → `expo-audio`) happens inside the sanctioned `platform/audio/` adapter. |
| II. Server-Authoritative Shared State | PASS — no shared-state paths touched; command-api upgrade is dependency-only. |
| III. Event-Backed Game History | PASS — no schema or event changes; pgTAP suite gains CI enforcement (strengthens this principle). |
| IV. Supabase-First, Java by Exception | PASS — no new endpoints or CRUD layers anywhere. |
| V. Story-First Delivery With Required Coverage | PASS — stories are independently deliverable PRs; unit tests accompany every extraction; no substantial UI change, so no *new* e2e journeys are required, but existing e2e suites become CI gates (exceeds requirement). |
| VI. Skill-First AI Execution | PASS — applicable skills identified: `.agents/skills/upgrading-expo` (mandatory for Phase 12), `react-native-testing` (hook back-fill), `github-ops` (workflows), `refactor` (decompositions). Where no skill applies (e.g., pom upgrades) that is stated in tasks. |

## Project Structure

### Documentation (this feature)

```text
specs/019-harden-codebase-foundations/
├── plan.md              # This file
├── research.md          # Phase 0 output — audit findings + upgrade/CI decisions
├── data-model.md        # Phase 1 output — type relocations only (no DB entities)
├── quickstart.md        # Phase 1 output — per-phase verification commands
└── tasks.md             # Phase 2 output — 12 phases mapped to stories US1–US6
```

`contracts/` is intentionally omitted: this feature exposes no new external interface (no endpoints, schemas, or public APIs). The one interface-adjacent guarantee — import-path stability during decomposition — is captured as re-export requirements in tasks.md.

### Source Code (repository root)

```text
.github/workflows/
├── java-ci.yml              # existing — convention template
├── client-ci.yml            # NEW (Phase 1): lint + jest --ci
├── db-ci.yml                # NEW (Phase 1): supabase start + pgTAP
└── e2e-ci.yml               # NEW (Phase 2): Playwright + self-booted Expo web

command-api/pom.xml          # Phase 5: Boot 3.5.x, springdoc 2.8.x, logstash 8.x

eslint.config.js             # NEW (Phase 4): flat config; .eslintrc.js/.eslintignore deleted

utils/
├── espnParsing.ts           # NEW (Phase 6): typed parsers from useLiveScores
├── svgArc.ts                # NEW (Phase 7): polarToCartesian, describeArc
├── accountAuthRoutes.ts     # NEW (Phase 8): route/URL builders from useAccountAuth
├── accountRepository.ts     # NEW (Phase 8): Supabase persistence fns
└── homeStats.ts             # NEW (Phase 11): getTotalDrinks, getTopDrinker

types/matchScores.ts         # NEW (Phase 6): MatchWithScore, GoalScorer, MatchStatistics

hooks/
├── gameProgress/            # NEW (Phase 7): pure reducers/helpers from controller
├── useGoalToastQueue.ts     # NEW (Phase 7)
├── useMatchQuickActionsAnimations.ts  # NEW (Phase 7)
├── useAccountSettingsSync.ts          # NEW (Phase 8)
└── useHomeRoomActions.ts    # NEW (Phase 11, post-018)

components/gameProgress/MatchQuickActionsModal/   # NEW (Phase 7): index.tsx, StatProgressBar, PossessionCircle, styles, types
components/home/             # NEW (Phase 11): HomeSplash, CurrentGameCard, HistoryStatsCard

__tests__/hooks/             # Phases 9–11: 11 new hook test files
__tests__/utils/             # Phases 6–7, 11: espnParsing, svgArc, homeStats tests
```

**Structure Decision**: All new modules follow existing homes — pure logic in `utils/`, hooks in `hooks/`, components in domain folders following the sibling `MatchesGrid/` folder pattern, shared types in `types/`. No new top-level directories.

## Phase Sequencing (execution order and gates)

1. **P1 Client+DB CI** → 2. **P2 e2e CI** → 3. **P3 axios/node-fetch removal** → 4. **P4 ESLint 9 + TS** → 5. **P5 Spring Boot 3.5** (independent, may run parallel to 3–4) → 6. **P6 ESPN consolidation** → 7. **P7 gameProgress decomposition** (needs P6 types) → 8. **P8 useAccountAuth split** → 9. **P9 hook tests trivial/medium** → 10. **P10 hook tests complex** (needs P7) → **=== GATE: feature 018 merged ===** → 11. **P11 app/index.tsx decomposition + useMyActiveRoom test** → 12. **P12 Expo SDK upgrade** (last; requires P11 merged; follow `.agents/skills/upgrading-expo`). Gate fallback and freeze-list freshness rules: see spec.md Assumptions.

Full per-phase detail (branches, exact edits, risks) lives in [tasks.md](./tasks.md); verification commands in [quickstart.md](./quickstart.md); decision rationale in [research.md](./research.md).

## Complexity Tracking

No constitution violations to justify.
