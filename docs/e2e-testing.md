# Local end-to-end tests

Run the complete browser suite with one command:

```sh
npm run test:e2e
```

Prerequisites: Docker Desktop (Linux containers) or a working Docker Engine, the Node version in package.json, Java 17, and Playwright Chromium. Install dependencies with npm ci and install the browser once with npx playwright install chromium. The runner uses the locked Supabase CLI and Maven wrapper; first startup can download images and Maven dependencies.

The command owns a disposable `dong-e2e` Supabase project under ignored `.supabase/e2e/`, applies the repository migrations, seeds synthetic accounts and football data, starts Edge Functions, Java and Expo, and runs Playwright. It never uses linked project metadata or your development environment files. Test keys stay in the ignored workspace. Only the setup process and local services receive privileged credentials.

Reserved ports: Supabase 60320–60329, Edge inspector 60330, Java 18080, Expo 18093. Occupied ports and concurrent runs fail instead of reusing another application's services. An atomic lock in the operating system temp directory prevents separate worktrees from starting the same Docker project concurrently. The normal development Supabase project and database are not reset. Completion or interruption stops only processes and the stack owned by this run.

## Three happy paths

Each scenario runs once in phone-sized Chromium, with one worker and no retries. The retained journeys include axe accessibility checks; no additional browser test matrix is introduced:

- Solo: configure players and matches, assign, start, record progress, reload, finish and inspect history.
- Multiplayer: a real signed-in host creates a room, a separate guest browser joins, the host starts, both observe score updates, and the game finishes.
- Account: sign in, change username and dark mode, then verify both restore after signing in from a clean browser context.

Tests use real local Auth, database policies/RPCs, Edge Functions, Java and synchronization. External match acquisition and push delivery are disabled; discovery reads seeded fresh football data. No application backend responses or sessions are fabricated.

## Coverage moved out of E2E

Assignment variations and validation remain in assignment/controller/component tests, Edge solver tests and pgTAP. Auth validation and recovery remain in auth form/hook/repository tests. Guest credential storage, lifecycle and redaction remain in guest service, transport and database tests. Canonical gameplay commands and permissions remain in game-progress and database tests. History sorting and calculations remain in history tests.

Old viewport/layout matrices, repeated datasets, mocked service scenarios and empty auth steps are removed. Component tests do not claim to verify real browser layout. Desktop browser behavior, recovery permutations and external push delivery are outside this small E2E suite.

## Failures and CI

CI invokes the same command. Inspect `test-results/` and `playwright-report/` for screenshots, traces and local service logs. Fix the first service/readiness error before changing browser waits. Never point the runner at hosted services to work around a local failure.

If a force-killed process leaves `dong-e2e.runner.lock` in the operating system temp directory, inspect its recorded PID and worktree. Remove that exact lock only after confirming the recorded process is no longer running; the runner never deletes another process's lock automatically.
