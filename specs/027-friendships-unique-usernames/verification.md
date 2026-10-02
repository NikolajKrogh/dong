# Implementation verification

## Baseline — 2026-09-30 (T001)

- Branch: 188-friendships-unique-usernames. Prior-schema/source revision: dbbb72d4da78c1875c35ef5383f3b8a2fd4516e9.
- Pre-existing edits: .specify/feature.json, AGENTS.md, CLAUDE.md, and untracked feature 027 artifacts. Preserved.
- Node 26.3.1; npm 11.16.0; Supabase CLI 2.118.0; Docker engine 29.5.3. Docker requires execution outside the sandbox. Existing DONG and TrackMate stacks were not reset.
- TypeScript: exit 1, 84 existing diagnostics (baseline-typecheck.log).
- Lint: exit 0, 0 errors and 407 warnings (baseline-lint.log).
- Jest: all 119 suites / 709 assertions pass, process exit 1 from late PortalProviderComponent updates after test completion (baseline-tests.log). This is not a green suite exit.
- Ignore verification: dependencies, build outputs, local environment files, logs, test artifacts and Java target ignored; ESLint excludes generated/build outputs. No npmignore needed for private package; no Dockerfile/Prettier config found.
- Skills loaded: speckit-implement, supabase, refactor, systematic-debugging. Follow incremental migration workflow in the approved plan; no hosted schema edits.

## Artifact corrections

- Cancel UI now follows its command integration (T030–T032).
- T035 is pure model coverage; T039 owns explored executable menu/dialog/focus tests.
- SC-006 references the reproducible per-platform timing protocol in quickstart.md.

## Setup (T002)

Installed exact @tanstack/react-query 5.104.0, expo-network 57.0.1 (Expo bundled version), and Supabase CLI 2.118.0. Node 26.3.1 is pinned in .nvmrc/package engines and satisfies installed React Native engines. npm install completed; no audit-force changes. Query/connectivity use remains pending.

## Transport and generated contracts (T004–T005 complete)

- Extracted configuration/auth transport into lib/supabase.ts with createClient<Database>. Updated transport imports and test mock boundaries; gameplay/guest/import command factories remain in utils/supabaseClient.ts.
- The shared client and domain factories now use the generated database schema. Existing JSON consumers reject scalar, null and error-envelope responses; the manual-match RPC argument nullability is documented in a narrow overlay because CLI generation omits that detail. Supabase Edge Functions have their own Deno check.
- Baseline repair gate: `npm run typecheck` exit 0; `npm run typecheck:edge` exit 0 for all three Edge Functions; `npm run test:ci -- --runInBand` exit 0 with 119 suites / 709 tests. Jest renderer cleanup waits for Tamagui portal unmounts. `npm run lint` exit 0, 0 errors / 407 warnings. `git diff --check` exit 0.
- The existing local DONG stack is at migration 042, so an isolated `dong-feature027` stack on port 56322 was built from all repository migrations. `npx supabase test db --workdir .local-db-validation` passed 54 files / 809 assertions there; no existing stack was reset. The isolated directory is ignored.
- `types/database.types.ts` was regenerated from that fully migrated local schema. With `DONG_DB_WORKDIR=.local-db-validation`, `npm run db:types:check` exits 0 without changing the tracked file. `scripts/db-types.mjs` validates generator output before writing. A deliberate stale-types negative gate remains T056.

## Disposable database and Unicode source (T003, T006–T007, T010)

- T003 inventory is in `removal-ledger.md`; candidates remain pending dynamic/native build checks before deletion.
- `npm run db:test:upgrade` guards project ID `dong-feature027` and port 56322, resets to prior revision `20260928163507`, applies pending migrations, runs pgTAP, then clean-rebuilds and runs pgTAP again. Both runs passed 55 files / 811 assertions. The feature fixture contains 104 local authenticated accounts, 30 `Scout` prefix matches, distinct actors and three Unicode names. Existing DONG and TrackMate stacks were untouched.
- `npm run db:test:concurrency` passed using three independent PostgreSQL connections. The observer saw the second connection waiting on an advisory lock before the first committed; no timing-only sleep determines race order. Username/social conflict cases will be added under T017/T026/T033/T040.
- Unicode 16.0.0 `UnicodeData.txt` SHA-256 `ff58e5823bd095166564a006e47d111130813dcf8bf234ef79fa51a870edb48f` was downloaded from Unicode, Inc.; license and source metadata are tracked. `node scripts/generate-username-ranges.mjs --check` and its two focused Jest tests pass, including First/Last expansion.
- Optional before/after implement Git commit hooks were not executed. No commit, hosted mutation, database reset, or device interaction performed.
- Raw *.log files are ignored local diagnostics; this tracked summary preserves the results without shipping logs or credentials.

## Final implementation and warning cleanup — 2026-10-01

Implemented unique usernames with database enforcement and account-owned rename commands; private friendship discovery/requests/decisions/cancellation/unfriend/block commands; Settings → Profile → Friends navigation; secondary block management; account-generation-isolated Query lifecycle; paged cloud history; and importer/profile/demo-handler retirement. The Home screen design is unchanged. Five incremental migrations were applied only to the disposable feature database and generated contracts were refreshed. No hosted migration or Edge Function deployment was performed.

The user requires warning-free code, including existing findings. Removed the Knip baseline/custom ratchet, fixed lint findings and unused exports/dependencies, corrected React state/ref lifecycle findings, repaired unit renderer cleanup, replaced deprecated Java mock annotations and removed compiler/VM warnings. `eslint . --max-warnings 0` and native `knip` now enforce zero findings. Narrow documented exceptions cover asset/module loading, Jest mock ordering and framework lifecycle false positives; they do not grandfather existing defects. Runtime warning logs for deliberately simulated API failures remain enabled.

| Final check | Result | Local evidence |
|---|---|---|
| `npm run test:unit -- --detectOpenHandles` | PASS: 74 suites, 513 tests; clean exit, no unexpected console/warning output | `.local-db-validation/unit-final-clean.log` |
| `npm run lint` | PASS: zero errors/warnings | `.local-db-validation/lint-final-clean.log` |
| `npm run typecheck` | PASS: zero diagnostics | `.local-db-validation/types-final-clean.log` |
| `npm run check:unused` | PASS: zero issues, no baseline exemption | `.local-db-validation/knip-final-clean.log` |
| `npm run typecheck:edge` | PASS: Deno checks | `.local-db-validation/edge-typecheck-final.log` |
| Maven `-Dtest=CommandDispatcherTest,StartGameCommandHandlerTest,PersistentIdempotencyServiceTest test` | PASS: 32 unit tests, BUILD SUCCESS; no compiler/VM warnings | `.local-db-validation/java-unit-final-clean.log` |

Java uses the workspace-local Maven repository. All Java test sources compiled, but HTTP/integration test execution was excluded. Three deliberate production WARN logs in simulated idempotency failure cases are expected error reporting. npm's upgrade notices are tool notices, not code warnings.

Generated-contract drift verification passed against the disposable schema. The boundary-import, unused-file and stale-generated-contract negative gates each failed as intended, and temporary fixtures were removed/restored. CI configuration was statically parsed; hosted CI was not executed.

React Doctor was run as an advisory audit. After excluding generated build/cache output it still reports heuristic findings (including historical migration RLS detection, vendor skill scripts, component complexity and style preferences). Material findings in audio initialization and regex escaping were fixed. Its report is not zero and does not establish vulnerabilities; strict ESLint/Knip/compiler results above are the warning-free acceptance gates. Existing migration history and the approved Home design were preserved.

### Execution limits

The earlier baseline/setup database results above predate the user's unit-only restriction. Under that restriction no web/browser, Android, ARTEMIS or E2E checks were run; no feature SQL integration, upgrade, concurrency or Java integration checks were run. Updating their fixtures is not passing evidence. Feature-specific independent-connection race scenarios remain unbuilt; the concurrency runner currently proves only a lock-wait barrier. Deferred tasks stay unchecked in `tasks.md`. Database authorization/concurrency correctness, platform runtime behavior and native dependency packaging remain unverified.

Changes are uncommitted. The optional after-implementation Git hook was announced, not executed.

Final whitespace review: git diff --check passed after removing trailing whitespace and restoring regenerated Tamagui cache files. Lint and Knip were rerun after artifact/configuration cleanup and passed. No user-authored baseline edits were reverted.

## Disposable file cleanup — 2026-10-02

Removed `.nvmrc` and the generated root `deno.lock`. Node stays pinned once in `package.json` (`engines.node`); both CI workflows now read that file. Edge type checking uses `--no-lock`, so it does not recreate the root lockfile. Removed 77 one-off logs/reports/repair scripts, then deleted the entire disposable `.local-db-validation` directory, including caches and mirrored database configuration/migrations/tests. The existing `scripts/test-db-upgrade.mjs` recreates its configuration and mirrors from tracked sources when explicitly run. Ignore rules prevent this workspace and an accidental root Deno lockfile from entering a future commit.

Kept `scripts/data/unicode-16.0.0/UnicodeData.txt` and `LICENSE.txt`: these are pinned source input and licensing for the username category generator, not temporary diagnostic files. Its two unit tests passed, including checksum-backed regeneration. Deno checks passed with no lockfile; both CI YAML files parse and point to the package's Node version; `git diff --check` passed. Web, Android, E2E and database execution remained skipped. Deleting this directory does not remove Docker-managed containers/volumes or change the hosted database.

Earlier local log paths in this report describe historical evidence locations; those scratch logs have now been deleted. The tracked results above remain the implementation record.


## Tooling scope correction — 2026-10-02

At the user's request, removed the added upgrade runner, dependent generic concurrency-barrier runner, their package commands and CI steps, and the unused development-only pg dependency. Existing db:start/db:reset/db:test and generated-type checks remain. No additional database test runner is required. Restored .gitignore byte-for-byte to HEAD; this change contains no .gitignore edits. Earlier references to a recreated/ignored scratch workspace are historical and superseded. Upgrade/race execution remains unverified.

## Startup repair and development rollout — 2026-10-02

The supplied startup log exposed two independent blockers: `Cannot find native module 'ExpoNetwork'` during root-layout import, and PostgreSQL 42703 (`accounts.username` missing). Expo Router's missing-default-export/ErrorBoundary messages followed the failed root import; the layout itself already exports a component.

Changed native connectivity to check the optional module through the existing Expo public API before lazily importing expo-network. Older development binaries now retain Query's default online state rather than crashing during route import. They still handle request failures/focus refresh; native connectivity notifications require a rebuilt development binary. Added a unit regression for the missing-module case. Three connectivity unit tests and client typecheck pass. No device/browser/E2E journey was executed.

The user explicitly authorized development-database migrations and library installation. Confirmed `.env.local` and CLI link target `qccvlhblytuedgmlqfef`; inspected migration history and a dry run listing exactly the five feature migrations. Normalized the existing test account `DONG Web Host` to `DONG_Web_Host` using an exact account/name guard and uniqueness check, preserving its ID and history. Applied all five migrations via linked `db push --skip-vault --yes`. Remote read-only verification confirms four accounts/four unique username keys, the username column present, old name column absent, rename RPC and social RPCs present, and matching migration history. Final dry run reports upToDate=true with no pending migrations. Deployed the reviewed delete-account Edge Function to the same project via the API bundler. This supersedes earlier statements that no hosted rollout had occurred.

The log also contains style/package/Tamagui deprecation warnings; these are separate from the two startup blockers and are not evidence of warning-free runtime behavior. No `.gitignore` edit or disposable DB runner was reintroduced.

Final startup-repair checks: lint, Knip and `git diff --check` passed. React Doctor was attempted but its temporary npm installation lacked an oxlint native binding; exit 1 and incomplete results, so its "No issues found" message is not accepted as a passing audit. No app-runtime claim is made from unit/static checks. Restart Metro with `npm start -- --clear` and reload the development client after receiving the code/schema updates.
