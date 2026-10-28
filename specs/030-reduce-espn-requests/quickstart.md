# Validation guide: shared Match Catalog

This guide is for the implementation produced from [plan.md](plan.md). The proposed catalog endpoints, migrations, fixtures and tests do not exist yet; these commands/scenarios define the expected validation path, not evidence that this feature already passes. Current repository commands and CLI flags were checked during planning.

## Prerequisites

- Node 26.3.1 as specified in `package.json`, npm dependencies, Docker, and the pinned Supabase CLI. Java 17 is needed when the discovery compatibility adapter changes.
- An isolated feature checkout with disposable local Supabase project ID/ports, separate from any valuable/shared local database. Confirm the selected local stack before resetting it. No linked-hosted reset, provider crawl, or source archive is part of validation.
- Controlled ESPN adapter fixtures covering scheduled/live/final/unknown/suspended, valid empty, partial/malformed, 403/404/429/5xx, score decreases, multiple goals between checks, distinct score contexts, roster participation and final scalar statistics. Routine tests must use these fixtures, with production provider routing unavailable to the harness.
- Implementation-time local-only worker/solo grant keys and fixture provider settings kept in an ignored environment file; never committed or printed. Fixture mode must be rejected by production configuration and must not accept caller-controlled provider URLs.
- Before authoring executable mobile interaction tests, use ARTEMIS to explore the app as required by `AGENTS.md`. Run `adb devices -l` and select the user's device if multiple are present. Browser mocks do not establish Android runtime behavior.

## Build and database checks

From the repository root in the isolated disposable checkout:

```powershell
npm ci
npm run db:start
npx supabase status
```

After confirming this is the disposable local stack, apply/reset the implementation's migrations and run its gates:

```powershell
npm run db:reset
npm run db:test
npm run db:types:check
npm run typecheck
npm run typecheck:edge
npm run test:ci -- --runInBand
npm run lint
npm run check:unused
```

Implementation must add the new function entry files to the currently explicit `typecheck:edge` script and provide the controlled provider/concurrency fixtures used below. Update `010_schema.test.sql` and other hard-coded schema assertions when columns change. Do not claim locks/budget correctness from mocked database tests. Distinct concurrent Postgres connections must establish serialization, expired-worker fencing and source-commit/replay behavior.

Serve local Edge functions from another terminal:

```powershell
npx supabase functions serve --env-file supabase/functions/.env.match-catalog.local
```

The environment-file path is a required ignored local setup artifact created during implementation. Function-specific auth configuration must still enforce the worker secret; do not disable authorization globally to make fixtures pass. Use [consumer contracts](contracts/match-catalog.md) and [worker contracts](contracts/worker-and-room-processing.md) for operation payloads/access. Start web with `npm run web`; use the existing authenticated test setup for host/guest room flows.

When Java compatibility changes, from `command-api`:

```powershell
.\mvnw.cmd clean verify
```

After affected BDD journeys/fixtures are implemented and the local web app is ready, run from the repository root:

```powershell
npm run test:e2e
```

Existing repository failures must be recorded with scope/cause; they do not turn an unrun or failing new-feature gate into a pass. No full test run is necessary merely to validate these planning documents.

## Controlled acceptance scenarios

| Scenario and setup | Action / expected result | Criteria |
| --- | --- | --- |
| Shared groups | Seed 100 eligible rooms selecting arbitrary subsets of fixtures in five league/date groups. Trigger simultaneous discovery/solo/worker demand with budgets available. At most five routine attempts per live freshness window; add 100 overlapping consumers and observe zero additional attempts while fresh. Saved reads, broadcasts, reconnects and manual matches cause zero HTTP. | SC-001, SC-002 |
| Kickoff with clients closed | Track a known future kickoff, close all host/guest app connections, run the real scheduler/worker against fixture time progression. Zero recurring pre-kickoff source requests. First check and at least 95% of provider-visible updates meet the 90-second healthy target; include non-zero dispatch/network time and optional work competing before kickoff. | SC-003, SC-004 |
| Ordered room replay | Accept source versions, interrupt before room application, then resume with budget exhausted. All accepted eligible room changes apply once, with provider provenance and no new ESPN attempt. Race assignment/departure/completion with accepted versions and verify correct cutoff/order. A new room's first 2–1 is one 0–0→2–1 snapshot event; completed rooms stay unchanged. | SC-004, SC-006 |
| Concurrent claims/failures | Race real transactions/worker instances, exhaust rolling/day limits, crash after reservation, deliver an expired response, return 429 Retry-After and 403, fail one group/room while another succeeds. Attempts stay bounded, cooldown survives restart, uncertain attempts remain counted, healthy isolated groups progress where provider-wide pause does not apply. | SC-005 |
| Re-entry/freshness | Reopen supported web and Android builds after recorded unattended changes, including interrupted-work recovery. Latest authorized saved state appears within five seconds in the controlled healthy workload, without duplicate consequences. During source failure, saved facts stay visible and last-success time remains accurate. Record source acceptance, room backlog and client recovery timings separately; a hidden replay backlog is not a passing recovery result. | SC-007 |
| Diagnostics/stop | Produce 24-hour attempts/reuse/failures/deferrals by purpose/group using bounded SQL/operator reporting. End/remove all applicable demand and complete allowed final work. Next monitoring pass performs no routine acquisition for that group; retained facts remain readable. | SC-008 |
| Compact details | Feed known/unknown goal identity/roles, source corrections, starters/used/unused substitutes, missing metrics and reported percentages. Preserve existing solo goalscorer and seven-stat controls from saved facts with null-aware presentation and zero read-triggered HTTP. One shared completion response serves all rooms. At most two dedicated completion attempts including retry/ambiguity/confirmation; no player crawl, raw archive or per-poll detail history. | SC-006, SC-009 |
| Retention/capacity | Insert representative compact rows/room fan-out, then exceed configured warning/admission thresholds. Evict disposable data, stop optional collection, reject unsafe new tracking, preserve referenced rosters/history/pending replay, and retain current-window budget evidence. Verify long-running uncertain matches and reschedule overload never silently end active rooms. | SC-010 |

The agreed remediation adds these controlled cases to the rows above:

- Shared-acquisition evidence names supported/migrated builds and reports known residual old-solo traffic or lack of visibility separately; it never treats a backend fence as control over old device code.
- One group's 403 pauses that group while healthy groups progress. A provider-wide throttling or established integration failure may pause the provider with a recorded scope/reason. No diagnostic provider probe is added to discover that scope.
- Force a command's bounded score drain to return HTTP 200 with `{ "ok": false, "code": "room_processing_pending", "retryAfterSeconds": 1 }`. Registered RPC, guest ingress and Java forwarding preserve the same body, committed processing progress and unperformed mutation. At most two automatic original-key/payload retries respect existing stale-precondition conflicts and never cache pending as terminal success or fetch ESPN.
- Capture self-contained saved `history` detail in local solo history, expire the server's unreferenced cache, and demonstrate captured display values persist. Uncaptured expired details remain unavailable. Local history creates no permanent anonymous server pin and contains no tracking credential.
- Race creation retries into one issuance, recover it while unexpired, reject its expired record, purge it, then admit fresh creation using a new server issuance/token and counted allowance. Old tokens stay invalid after purge/recreation and key rotation, including nonce reuse.

For timing-sensitive fixture scenarios, inject controlled policy time into pure functions and use a real disposable database time adapter for transaction tests. Do not change the hosted server clock or substitute arbitrary sleeps for verified readiness. An implementation harness should fail explicitly if a source request escapes the controlled adapter.

## Access and credential validation

Exercise public saved reads/discovery, valid and invalid solo grants, registered host/member, session-scoped guest, and trusted worker independently. Public and participant credentials cannot reserve budgets, claim work, accept observations, select other grants, or call the worker. Provider-origin history remains visible through correct authorized room readers even when participant actor is null; no private room links appear in public catalog results.

Test duplicate creation nonce recovery, immutable issuance identity, changed-body conflict, stale replacement versions, grant expiry/end, cleanup/recreation, key rotation and new-creation limits. Missing signing material fails closed. Verify CORS on normal/error paths without treating it as worker auth. Check default execution grants, RLS/invoker behavior, fixed private search paths and pg_net queue/login-role access. Never output secret headers, nonces or bearer grant content as evidence.

## Actual storage and operating measurements

Measure after representative insertion, not only from JSON/gzip/datum estimates. An operator-only query can sum owned table/index bytes:

```sql
select sum(pg_total_relation_size(c.oid)) as provider_relation_bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private'
  and c.relkind = 'r'
  and (c.relname like 'provider_%'
       or c.relname in ('solo_tracking_grants', 'solo_tracked_matches'));

select pg_database_size(current_database()) as whole_database_bytes;
```

Account separately for feature-attributable Cron history, affected existing room/event indexes and future protected growth. Record whole-project/organization allowance usage, actual observation/roster/room consequence sizes, maintenance/disk headroom, request diagnostics and aggregate cardinality. Check 100-MB feature target, 80% optional/90% new-demand thresholds and at least 50-MB whole-database application headroom. These are safety policies, not proof of indefinite free retention.

Run `EXPLAIN (ANALYZE, BUFFERS)` on bounded representative due/replay/discovery/roster queries in the disposable database. Capture Edge CPU/duration/memory, dispatch jitter, pending-work backlog, invocation totals, Realtime/egress, and seven-day Cron-history growth. Tune batch/admission settings only with repeatable evidence; do not quietly relax the provider budget to make latency pass.

## Hosted rollout gate and evidence

Follow the [cutover contract](contracts/worker-and-room-processing.md). Before a later authorized deployment, inspect remote migration history without overwriting local files, then preview only intended changes:

```powershell
npx supabase db push --linked --dry-run --skip-vault
```

This preview is not deployment or permission to alter unrelated migrations/secrets. The installed CLI help was checked for `--dry-run`, `--linked` and `--skip-vault`; keep Vault provisioning separate. Deploying migrations does not deploy Edge functions. Validate worker credentials/denials, queue privileges, source-owner fencing, configured budgets and client adoption before enabling `match-catalog-monitor`, the one owned 15-second job. An optional live sample must have an explicit small request cap recorded before execution.

Release evidence must identify migrated web/Android bundles and Java/Edge revisions. Old solo builds/tabs can still call ESPN directly; report them separately. Record SC-001–SC-010 results, platform limitations, actual bytes/latency/usage, source outage recovery limits and operator rollback procedure. Pause acquisition rather than re-enable competing legacy fetchers. This planning run performs none of these deployment/device tests.
# Disposable local profile

Run `node scripts/prepare-match-catalog-local.mjs` to copy only migrations, tests, seed and configuration into ignored `.supabase/feature030`. It uses project ID `dong-feature030` and API/database ports 58321/58322; linked-project metadata and credentials are never copied. Re-run after adding migrations/tests. Use `--workdir .supabase/feature030` on local CLI commands and `DONG_DB_WORKDIR` for type generation. Never use `--linked` or a hosted URL for this profile. The ignored `supabase/functions/.env.match-catalog.local` defaults acquisition to disabled; tests inject provider fixtures and must reject outbound ESPN requests. Preparing this profile does not reset or start any database.

The user explicitly excluded new and executed E2E tests. See [verification exception](validation/user-exceptions.md); backend measurements do not establish Android/web journey acceptance.

The installed CLI's explicit external test-directory runner omits sibling `.inc` fixtures. For a fixture-complete local SQL run, bootstrap `pgtap` in schema `extensions` of `supabase_db_dong-feature030`, then use the already installed `public.ecr.aws/supabase/pg_prove:3.36` image on `supabase_network_dong-feature030`, mounting the complete `supabase/tests` directory read-only at `/tests`, and run `pg_prove -h supabase_db_dong-feature030 -U postgres -d postgres /tests/database/*.sql` with the disposable local password. Never point this harness at a hosted URL or another project network.

Before later deployment, follow [runtime database provisioning](validation/runtime-database.md): a dedicated LOGIN role inherits `match_catalog_backend` and has `statement_timeout='10s'` on the login itself. The Edge adapter uses atomic function statements with prepared statements/pipelining disabled, verified remote TLS, and a four-connection per-instance ceiling. Configure the server-only `MATCH_CATALOG_DATABASE_URL`; do not send startup/session timeout settings through transaction pooling or grant the login direct tables/operator access. Verify a fresh target connection and bounded adapter smoke separately from the disposable direct-Postgres tests.

