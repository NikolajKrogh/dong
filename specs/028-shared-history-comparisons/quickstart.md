# Quickstart Validation

Validation guide and implementation evidence. The execution record below distinguishes completed checks from unverified runtime scenarios.

User-approved exception (2026-10-09): do not author or run any E2E tests for this feature on web, Android or iOS. Unit/component, hook/repository and pgTAP tests remain required. This explicitly departs from Constitution V; do not claim full E2E compliance. No mandatory manual journey or mobile harness replaces the removed E2E gate.

## Setup and checks

Use package.json Node, lockfile, Docker/local Supabase, two registered accounts A/B and unrelated C. Commands from repo root; local reset only, never hosted:

```powershell
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
npm run db:types:check
npm run typecheck
npm run test:ci -- --runInBand
npm run lint
npm run check:unused
npm run auth:env
npm run web
```

Create migration during implementation with npm run db:new-migration -- shared_history_comparisons. Also upgrade a separate disposable local pre-feature baseline, preserving seeded results, and rerun tests. No applied migration edits.

## Known results

A/B friends. Shared G1 A=4 B=2; completed shared G2 A left with 2 B=4; separate completed G3 A=6; separate completed G4 B=3. A overall=3 games/12 drinks/average 4; B=3/9/3. Shared=2 games, each 6/average 3; higher counts 1 each, ties 0. G2 visibly labels A Left early. Shared timeline only G1/G2. A cannot inspect G4; B cannot inspect G3.

Add ongoing, local, imported legacy cloud (including zero-match provenance), repeated departure records, same-name guests and pre-start leavers; no extra contributions. Repeat zero/tie/no-shared, rename/reuse, guest registration and second-device checks.

## Permissions and races

Unfriend/block both directions after reads and between pages; no new social payload, unblock alone grants nothing. Cached-data offline open/refresh/return/foreground hides data then shows connection Retry. Pending permission checks also hide data. Delayed requests across sign-out/account-switch/rapid target navigation never update wrong view. Confirm same-client social mutations invalidate affected data. Test raw grants/helpers/table reads separately; personal history remains independently available.

## Performance and recovery

SC-005: 100 shared completed games plus separate games, 20 opens on web and 20 native. Time opening action to full summary/first page displayed; >=19/20 within two seconds per platform on healthy network. Record cold/warm, build/device/network and failures separately; EXPLAIN (ANALYZE, BUFFERS) measures indexes/joins. Larger fixtures test complete aggregates/paging without adding an acceptance threshold.

Before hosted rollout inspect linked migration history and check CLI help then db push --dry-run. Schema first, client second. Client rollback/revoke new RPC EXECUTE if failure; forward corrective migration, never hosted reset or result deletion. Report unit/component, pgTAP, hosted and timing evidence separately; no E2E execution is required or authorized.

## Implementation execution record — 2026-10-09

Branch `feat/shared-history-comparisons` starts at `multiplayer` commit `b718877`. The previous `189-shared-history-comparisons` branch was diverged and was not reset or overwritten. Initial work consisted of feature artifacts and managed context pointers; those are retained. Node `v26.3.1`, npm `11.16.0`; existing installed dependencies and lockfile were reused without dependency updates. Baseline TypeScript passed. CodeGraph was used for indexed code; SQL and unindexed files were located directly. Existing ignore/config patterns were inspected; no new publishing or infrastructure setup was necessary.

`SOCIAL_MIGRATION = supabase/migrations/20261009192736_shared_history_comparisons.sql`, generated with `npm run db:new-migration -- shared_history_comparisons`.

### Implemented behavior

History Players discovers registered co-players from recorded account links, sorts recent participants first, and shows current relationship actions. Friends, game participants and Players open `/history-comparison/[accountId]` with a safe History/Friends origin. Personal local/nonfriend comparisons remain available. Unsupported historic departure captures without account links remain session identities; names are never used to invent links. Completed canonical results retain account links and frozen early-leaver drinks.

The comparison bundle returns all-time overall aggregates, shared aggregates and a bounded shared-game page. Separate-game identifiers, dates and drill-down data are absent from the overall aggregates. Shared games/timeline use authorized keyset pages, precise numeric totals and departure labels. Guest details remain snapshots. No polling, offline social cache, new dependency, Java API, source-result rewrite or hosted change was introduced.

Every opening, refresh, return and foreground check hides private payload before the request. Query observers exist only while mounted and do not render cached data. Same-client confirmed friendship mutations invalidate displayed social data; each RPC and page rechecks accepted friendship and bilateral blocks. Account/display generations and AbortSignal fence delayed requests and page failures.

### Completed checks

| Check | Result / evidence |
|---|---|
| `npm run test:ci -- --runInBand --silent --detectOpenHandles` | 128 suites, 774 tests passed in the normal full command. Final parser and cancellation regressions separately passed 18 focused tests (including a new deleted-participant test). Includes 10 social lifecycle tests, malformed transport, route shortcuts, overall/shared rendering and existing personal/Friends regressions. |
| `npm run typecheck` | Passed after final test typing correction; no baseline exemption. |
| `npm run lint` | Passed with zero warnings. |
| `npm run check:unused` | Passed with no exclusions added. |
| `git diff --check` | Passed. |
| New social pgTAP | 49 assertions across foundation/discovery/comparison/revocation; passed on clean schema and pre-feature upgrade clone. |
| Selected existing + new pgTAP | 12 suites, 175 assertions passed: 040, 070, 080, 090, 100, 110, 313, 314 and four social_history suites. |
| Generated database types | Generated from the tested disposable clean schema; drift check passed using `DONG_DB_URL` below. |
| Clean installation | All ordered repository migrations applied with transaction/ON_ERROR_STOP to a disposable public/private schema, then local seed. |
| Seeded upgrade | Six canonical sessions and ten participants survived unchanged; recorded drink sum 381.0. A's eligible overall stats remained 3 games / 12 drinks / average 4. |
| Migration origin stop | Rollback-only unknown-code fixture raised `social_history_origin_preflight_failed` and reported exact conflicting session ID `28000000-0000-4000-8000-000000000001`. |
| Larger fixture | 107 shared games returned complete totals, first page bounded independently, timeline capped at 100 with next cursor. |
| Local SQL EXPLAIN | 107-shared-game fresh fixture: bundle 161.170 ms, aggregate 80.142 ms, first cursor selection 72.720 ms. These include no network/render time. No new indexes were justified by the 100-game requirement. |

The full Jest runs printed passing summaries but remained alive with an open-handle warning; detectOpenHandles also passed and eventually exited with code 0 without identifying a handle. The normal full run printed its open-handle warning; the cause of that shutdown delay remains unresolved. Focused final runs exited normally. These are unit/component/hook tests, not E2E evidence. Standalone cloned database triggers emitted optional Realtime publication warnings; no hosted broadcasts were validated.

Disposable databases on the existing local `supabase_db_dong-feature027` container: `dong_feature028_clean`, `dong_feature028_work`, `dong_feature028_upgrade`, plus an unused partial `dong_feature028` restoration. Only these newly-created database schemas were mutated. The original `postgres` database, unrelated containers and hosted project were not reset. The tested schemas include the repository's receipt/bootstrap migrations that the original container lacked.

```powershell
$env:DONG_DB_URL='postgresql://postgres:postgres@127.0.0.1:56322/dong_feature028_clean?sslmode=disable'
npm run db:types:check
Remove-Item Env:DONG_DB_URL
```

`DONG_DB_URL` is an optional explicit local generation/check target; without it, scripts keep using `--local`. Keep this override limited to disposable databases. SQL assertions were run with container `psql -U supabase_admin -v ON_ERROR_STOP=1` (the disposable schema owner); harness output was also checked for `not ok` because assertion failures alone do not change psql's exit status.

### Unverified gates and rollout

T029 is incomplete: 20 authenticated opens on web/native, healthy-network cold/warm rendering and the 95%/two-second outcome are unmeasured. T030's automated gate passes; actual focus, touch, narrow/wide visual accessibility, authenticated web/native journeys and second-device parity remain unverified. ARTEMIS diagnosed the attached Android device as locked; no mobile automation was launched. Expo typed routes include the new destination; this is compilation evidence only.

React Doctor was not executed: initial npm cache permission failure was followed by automatic approval review rejecting fetching/executing an untrusted external package. Lint, types, Knip and Jest continued independently. No E2E tests were authored or run under the user's explicit exception.

No hosted deployment, push, PR or commit occurred. Before rollout inspect linked migration history and review a dry-run, including the preflight's conflicting-origin report. Deploy schema before client. If a private-read defect appears, revoke authenticated EXECUTE on the four new public/private entrypoints, return clients to the previous version and use a forward corrective migration; preserve games, participants and recorded snapshots. Do not reset hosted data.

### Requirement audit

FR-001–FR-019 are implemented through the contextual entry points, canonical SQL projection, per-read friend/block checks, aggregate-only overall contract, preserved personal details and fresh-check client gates. Unit/pgTAP evidence covers these boundaries and edge cases. SC-003, SC-004 and SC-006 have automated local evidence; this does not assert live hosted parity. SC-001 navigation and SC-002 arithmetic have unit/database evidence but authenticated web/native and second-device acceptance remain unverified. SC-005 remains unverified beyond the local query timings above. T032 records that distinction rather than claiming complete runtime acceptance.

The scoped code-review manifest and rationale are recorded in [refactor-review.md](refactor-review.md). An attempted fixture rerun as the non-owner postgres role stopped at account_blocks permissions after RESET ROLE; rerunning as the schema-owner harness role passed all 49 assertions. Each tested authorization scenario explicitly switches to authenticated/anonymous roles independently of that fixture setup role.

The final normal Jest process was stopped after its 128-suite/774-test passing summary because it remained alive with the open-handle warning; this is not recorded as exit-code-0 evidence. The earlier detectOpenHandles run exited 0 with 773 passing tests, and the final focused transport/account-scope run exited 0 with 18 passing tests.


### Android cloud-history correction — 2026-10-10

The connected CLT-L29 phone showed the cloud-history failure while web worked. React Native's installed setUpXHR.js initializes AbortSignal from abort-controller; that implementation has aborted but lacks throwIfAborted and reason. The personal loader invoked throwIfAborted before any request, causing TypeError and the generic history error. Shared reads used the same unsupported method.

Added platform/abort.ts, which checks aborted and preserves an available reason or throws an AbortError, and used it in both repositories. Personal pagination also checks cancellation immediately after each returned page. Regression tests remove throwIfAborted/reason to model the native signal: four new cases failed before the fix, then all 32 focused repository/lifecycle tests passed. TypeScript/lint/unused checks passed. No new dependency or schema change is involved.

Physical-device evidence: ARTEMIS observed the current history failure on WCR0218C11000221, then the existing Retry cloud history action was used after the source update. A second ARTEMIS observation showed the error/Retry removed and a cloud record for test/Web with 11 matches and 1.0 drink, replacing the local-only TestOne/TestTwo zero-match display. This verifies this specific History read on the phone; it does not complete friend comparison, second-device/layout or performance gates. No E2E test was authored or run, and no sign-out/data reset was required.

### Approved dashboard refinement — 2026-10-10

History → Stats is now the primary statistics destination. Your own completed-online totals remain at the top; accepted friends have automatically loaded aggregate summaries; one row expands inline into aligned overall and shared-total tables. No individual games, drink winners or timelines appear in this dashboard. Games/Players preserve recorded details/local history and existing direct comparison URLs remain compatible. Friends shortcuts and participant actions open the appropriate expanded Stats row. All-time scope, early-leaver counting, current friendship/block checks, fresh permission gating and account cancellation remain enforced. The Friends heading also covers accepted friends with zero shared completions.

Added get_personal_history_stats() with no target argument. Its private implementation derives the actor from auth and uses the existing completed-online participant projection; it needs no friendship and exposes only actor aggregates. Public wrapper is security invoker, private implementation is security definer with empty search_path, and PUBLIC/anon execution is revoked. The not-yet-deployed feature migration was extended before its first rollout; generated types came from the disposable tested schema.

Local verification: 59 pgTAP assertions passed across foundation (16), comparison (15), discovery (9), revocation (9), and personal aggregates (10). Generated schema drift check passed. Focused component/repository/hook tests cover automatic summaries, inline expansion, pending/error privacy, personal totals without friends, empty-history Stats access and account changes. Full Jest suite: 129 suites / 789 tests passed on rerun with --forceExit (the existing runner retains handles); the first run had one unrelated useTeamLogo asynchronous timing failure, which passed in isolation and the rerun. TypeScript/lint/Knip checks are recorded after final source changes. React Doctor remains unavailable under the earlier automatic approval rejection; no new package download was attempted. No E2E was authored or run.

Hosted rollout explicitly approved by the user in this session. Dry-run listed only 20261009192736_shared_history_comparisons.sql; migration push succeeded without seeds or role updates. Hosted catalog inspection verified the new functions, empty search_path and authenticated-only grants. Subsequent dry-run returned upToDate true with no pending migrations. No hosted game records were reset or changed.

Android observation: on WCR0218C11000221, the missing-function failures were visible before rollout; Retry your stats and Retry Qwerty after rollout loaded personal 2 games / 3.0 drinks / 1.5 per game and Qwerty overall 3 games / 6.0 drinks with 0 games together. This verifies authenticated hosted aggregate reads on that phone. It does not prove iOS, desktop layout, second-device parity or the unmeasured performance gate.

Final dashboard checks: TypeScript, ESLint, Knip and git diff --check completed successfully after source changes. ARTEMIS verified expansion into the aligned You/Qwerty overall table and a scroll to the shared section: zero shared games/drinks, unavailable averages, and the explicit no-completed-games message. Accepted friends with no shared completions are labelled under Friends rather than claiming they have played together. Optional Spec Kit commit hooks were skipped; no commit or PR was requested.
