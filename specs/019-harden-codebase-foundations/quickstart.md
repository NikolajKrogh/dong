# Quickstart: Harden Codebase Foundations — Verification Guide

**Feature**: 019-harden-codebase-foundations

How to validate each phase end-to-end. Every phase must leave the full relevant matrix green before its PR merges.

## Prerequisites

- Node 20+, `npm ci` run at repo root
- Docker Desktop running (DB phases only)
- JDK 17 (command-api phase only)
- Every phase branches from `origin/multiplayer`: `git fetch origin && git checkout -b <branch> origin/multiplayer` (local master is stale — never branch from it)

## Standard command matrix

```powershell
# Client unit + lint (Phases 1, 3, 4, 6–11)
npm run lint
npm run test:ci          # same script CI runs (FR-003); pre-Phase-1 fallback: npx jest --ci
npx tsc --noEmit

# Database (Phase 1)
npm run db:start
npm run db:test          # 33 pgTAP files, all must pass
npm run db:stop

# E2E (Phases 2, 7, 11, 12) — boots Expo web itself, no backend needed
npm run test:e2e
npm run test:e2e:home    # home-shell flows (Phase 11 especially)

# command-api (Phase 5)
$env:SUPABASE_JWT_SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long"
$env:SUPABASE_URL        = "http://localhost:9"
cd command-api; .\mvnw.cmd clean verify
```

## Per-phase acceptance checks

Manual checks below are pass/fail against the stated expected outcome — record the observed outcome so a second person reaches the same verdict. Per SC-007, behavior preservation is claimed only for e2e-covered journeys plus these manual checks; anything covered by neither is documented residual risk.

| Phase | Beyond the standard matrix, verify |
|---|---|
| 1 CI | Both new workflows green on the PR; a deliberately broken test on a scratch branch turns `client-ci` red AND blocks merge (required status checks configured per FR-013); docs-only commit skips all heavy workflows; `git ls-files test-results/` returns nothing. |
| 2 e2e CI | Workflow green; on induced failure, `playwright-report/` uploads as artifact. |
| 3 axios | `git grep -E "axios|node-fetch" -- ':!package-lock.json'` → no hits; setupGame team pickers still populate (manual web check: `npx expo start --web`, setup flow). |
| 4 ESLint 9 | `npm run lint` picks up `eslint.config.js` (delete legacy files first so fallback is impossible); zero errors. |
| 5 Boot 3.5 | `mvnw clean verify` green; run the app and check `http://localhost:8080/swagger-ui` and `/v3/api-docs` serve; jacoco check still passes at 0.60 floor. |
| 6 ESPN | New `__tests__/utils/espnParsing.test.ts` green; characterization fixtures cover own goals, penalties, cards, missing scorers, missing statistics; live scores render identically (manual: gameProgress screen with a live match or fixture-fed unit assertions). |
| 7 gameProgress | ALL pre-existing gameProgress tests pass **unmodified**; quick-actions modal opens, tabs, animates (manual web check). |
| 8 accountAuth | `__tests__/hooks/useAccountAuth.test.ts` passes **unmodified** — this is the acceptance criterion. |
| 9–10 hook tests | Each new test file green in isolation: `npx jest __tests__/hooks/<file> --ci`; no fake-timer test uses real waits. |
| 11 home (post-018) | First confirm gate: `git log origin/multiplayer --oneline | head` shows 018 merged and `git diff origin/multiplayer -- app/index.tsx` clean before starting. Then standard matrix + `test:e2e:home`. |
| 12 Expo (post-018) | `npx expo-doctor` clean; full matrix incl. both e2e suites; manual smoke: `npx expo start --web` and a native dev-client build; goal sound plays (expo-audio migration); date pickers, gestures, animations, webview screens spot-checked (webview has no platform adapter). |

## Definition of done (feature level)

- All 12 phase PRs merged; CI (client, DB, e2e, java) green on master.
- SC-001…SC-007 from [spec.md](./spec.md) hold; hook coverage 21/21; `expo-av` gone; Boot on 3.5.x; ESLint 9; zero `any`-typed ESPN parse paths.
