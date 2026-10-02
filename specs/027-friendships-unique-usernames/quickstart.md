# Implementation Validation Quickstart

This guide describes the implementation gate. Foundational scripts and fixtures are now implemented; the remaining feature and final gates are still in progress.

## Prerequisites

- A clean/reviewed checkout with intentional local work preserved, Node matching the project's supported Expo/tooling version, npm, Docker, and the pinned Supabase CLI.
- Local-only credentials/configuration for database/UI verification; no production service-role key in clients.
- A running Java API for the retained match/start-game paths when exercising those journeys.
- For native UI work, `adb devices -l`, choose the user's preferred device when ambiguous, and follow repository ARTEMIS exploration rules before authoring UI tests.
- Verify database UTF8 encoding, PostgreSQL 17, ICU root collation availability/version, and the username corpus in [data-model.md](data-model.md). Do not silently substitute lowercase rules.

## Existing Commands

Run from `C:\src\dong` after implementation, with Docker ready:

```powershell
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run test:ci -- --runInBand
npx tsc --noEmit
npm run lint
npm run test:e2e
```

`db:reset` here targets the disposable LOCAL database. Do not add a linked/remote target. E2E requires the configured web server and authenticated fixtures. Run the existing Maven verification in `command-api/` after any Java echo-handler cleanup. Web/native build commands and device validation must follow the existing Expo configuration; a successful typecheck is not native build evidence.

## Scripts to Add in Slice A/F

| Planned script | Required behavior |
|---|---|
| `db:types` | Generate public client types from the tested local schema with the pinned CLI into `types/database.types.ts` |
| `db:types:check` | Generate into a temporary file and fail on semantic/unexpected output drift; never mutate tracked types in CI |
| `typecheck` | Non-emitting TypeScript check |
| `check:unused` | Knip with Expo/routes/config/tests/native usage accounted for; no automatic deletion |

`db:types`, `db:types:check` and `typecheck` are implemented. Use the existing local Supabase start/reset/test commands. The additional feature-specific upgrade and generic lock-barrier runners were removed at the user's request; upgrade and race verification remain unverified.

Discover pinned CLI syntax through `--help` rather than copying unverified latest commands. Pin the CLI/runtime in CI and local setup. For concurrency use the local stack's existing PostgreSQL client where available; only add a dev driver if the runner actually needs it.

## Acceptance Runs

**Visual/navigation gate:** Compare against [v4](mockups/05-profile-friends-workflow-v4.png) and [workflow notes](mockups/README.md). On web and native, verify Home remains unchanged, including the active-game variant. Navigate through Settings → Profile & username → Friends. Verify only Friends/Requests tabs, search above them, and Blocked accounts under header More options. Check keyboard access/focus restoration on web and usable touch targets on native. Confirm earlier mockup Home modifications were not implemented.

1. **Identity:** A and B concurrently claim equivalent names; exactly one wins. Try direct writes, stale clients, case-only self-renames, and composed/decomposed accents. Verify 3/30-code-point boundaries succeed, 2/31 fail, Unicode letters/numbers/underscores succeed, and internal spaces, other punctuation, controls, and format characters fail. Regenerate the pinned Unicode range artifact and require no diff; verify its source checksum and Nd/Nl/No plus supplementary-letter cases. Verify blocked old column paths fail clearly and account IDs/snapshot names stay stable.
2. **Requests:** A searches B's username prefix and selects B. Verify two-character queries return nothing, three-character queries match, underscores are literal, and self/blocked accounts are excluded before the 20-result cap. Verify deterministic ordering, the Greek prefix example in data-model.md, and the cap with more than 20 eligible accounts. A sends, retries with the same operation ID, and observes outgoing/incoming state. Run simultaneous opposite sends; only one pending generation exists. Reuse an operation ID with different input and confirm rejection.
3. **Decisions:** B accepts or declines; A and B refresh/reopen. Third-party C and sender A cannot respond as B. After decline, either participant can immediately send a fresh operation that creates a new pending generation. Replaying the original send cannot create a new request, and an old decision cannot mutate the new generation. A block prevents fresh requests. On web and native, cancel an outgoing request and unfriend an accepted friend; verify both lists after refresh, friendship-only access revocation, retained game history, and fresh requests remaining possible. Race cancel with acceptance: if acceptance wins, stale cancellation conflicts rather than unfriending. Retry old cancel/unfriend operations after a new generation and confirm it remains unchanged.
4. **Blocking:** Race block against send and accept on independent connections. Verify no active relationship survives a committed block. Exercise two opposite blocks, own-block removal, stale unblock generation, and delayed replay after reblock. Verify friend-only access is revoked but room-member history remains valid.
5. **Identity transitions:** Delay A's history/search query and mutation callback, switch to B, and release the delayed work. No A data or callbacks affect B. Repeat expiry, deletion, sign-out/sign-in, same-account token refresh, native focus/reconnect, and paginated cancellation.
6. **Retirement:** Confirm preferences no longer expose history import, old active import functions/ledger are removed, and no history query calls import-link RPCs. Existing local history and canonical completed/early-leave cloud history still work.
7. **Workflow:** Deliberately change a schema contract without regenerating types and make a forbidden cross-feature import on a disposable branch; both checks fail. Restore intentional errors. Rebuild empty DB and upgrade prior schema; run all required role and regression checks.
8. **Packages/builds:** Review Knip findings against native peers/configuration/dynamic usage. After removal, validate web export and Android build/runtime, plus actual Java commands. Record exact files/dependencies removed and replacement paths.

9. **Refresh policy:** With Friends open on B, A sends or changes a relationship. Verify B obtains current state on manual refresh, leaving and returning to Friends, and foregrounding the app while Friends is active, including returns within cache stale time. No automatic live-update or elsewhere-indicator expectation. A's confirmed actions update A's initiating view.

## SC-006 Performance Protocol

- Use 100 named test accounts, including at least 25 matching one prefix. Record the fixture revision and relationship states.
- Measure web and physical Android separately against the same database. Record device/browser, build, database region, network type and any throttling; retain these conditions across comparison runs.
- For each platform and operation type, perform five warm-up operations, then collect 40 searches and 40 manual refreshes using a recorded, repeatable query sequence. Measure actual server reads, not cache-only results.
- Start timing at server-request dispatch and stop when completed results render. Exclude typing debounce. Use a monotonic clock and record individual durations.
- Report search and refresh separately for each platform. Sort successful durations and calculate nearest-rank p95 (rank ceiling(0.95 × successful count)); each group must be at most two seconds. Report attempted/successful/failed counts and errors separately; failed operations never count as successful fast responses. A group with failures requires recovery verification and a complete successful repeat before claiming the performance gate passed.
- Check initial loading and failed-request recovery separately; preserve those results alongside timing evidence in verification.md.

## Rollout and Recovery

- Preflight existing test names and dependencies. Report collisions/invalid test data and stop; explicitly correct/reseed disposable data rather than invent a production rename flow.
- Keep incremental migrations and previous-version fixtures. Do not rewrite old migrations to make the new schema appear historical.
- Before later linked deployment, inspect migration history read-only and review the dry-run. Do not fetch migrations into the working checkout or blindly repair history.
- Coordinate the test app/schema cutover for renamed fields and retired importer endpoints. Deploy any changed Edge Function separately from database migrations.
- Failed migration/upgrade: restore the local test environment or use a reviewed forward repair. Document hosted recovery against the actual environment before deployment; this plan grants no blanket hosted reset action.
- Archive obsolete migration history only in a separately designed prelaunch baseline operation, not in this feature.

## Evidence to Record

Record command results, schema/type drift status, role tests, concurrency outcomes, removal ledger, and two-user state checks. Distinguish unit/mocked web results, real persisted two-account results, Android build, and physical-device behavior. A documentation or static review cannot mark these runtime gates complete.

## Current execution exception — 2026-10-01

The user requested unit tests only and explicitly skipped web, Android and E2E execution. Final local gates: 513 client unit tests, 32 Java unit tests, zero lint/Knip findings and clean TypeScript/Deno checks. Non-unit protocols above remain future verification steps, not completed evidence. See verification.md and the unchecked tasks for the remaining gates. Apply incremental migrations and explicitly deploy the changed delete-account Edge Function only as part of a separately verified rollout; neither has been deployed to the hosted project in this implementation.
