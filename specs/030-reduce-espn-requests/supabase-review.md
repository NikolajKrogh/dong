# Supabase platform review

**Checked**: 2026-10-25  
**Status**: Design evidence; no database, job, credential, or function changes made by this review.

The database-led Match Catalog fits the existing Supabase deployment. This review adds deployment and resource constraints to [architecture.md](architecture.md); it does not replace formal planning or claim that autonomous monitoring is implemented.

## Observed hosted capabilities

Read-only queries against the linked DONG project returned:

| Item | Observed state |
| --- | --- |
| `pg_cron` | Installed, version 1.6.4 |
| `supabase_vault` | Installed, version 0.3.1 |
| `pg_net` | Available, version 0.20.0; not installed |
| Current database size | 20,515,987 bytes, about 19.6 MiB |
| Existing Cron jobs | 2 |
| Existing Cron run history | 11,467 rows; 2,023,424 bytes including relation overhead/indexes |

These are a point-in-time snapshot, not a capacity guarantee or an organization-wide usage audit. No secrets, job command text, or personal game data were retrieved. Enabling `pg_net` belongs in the reviewed deployment work; creating another scheduler service is unnecessary.

## Scheduled work and Free-tier usage

Use one global Cron job calling a small private database operation. Formal planning selected a 15-second database-only tick: minute ticks plus a 60-second freshness interval can otherwise slip to nearly 120 seconds depending on dispatch/check completion. It checks indexed due work using database time and invokes the Edge runner through `pg_net` only when eligible. Work includes pending selected-room replay, provider acquisition, and permitted completion enrichment. A retry-only or room-replay pass must remain possible without another ESPN request.

An unconditional once-per-minute Edge invocation would consume 43,200 invocations in 30 days, or 44,640 in 31 days. The due-work check avoids empty invocations. This is an invocation estimate, not an ESPN request count: one worker invocation can process several budgeted request groups. Discovery, continuation, retries, and existing app functions consume additional invocations. Supabase currently includes 500,000 Edge invocations on Free; measure aggregate usage rather than treating the remainder as this feature's private allowance. [Pricing](https://supabase.com/pricing)

The database check is an optimization; the worker still atomically claims work and reserves budget. Two wakeups must not admit two provider acquisitions. If dispatch fails or its result is uncertain, persisted deadlines/claims allow a later pass to recover. `net.http_post` returning a request ID means the request was enqueued, not that the worker succeeded. Track dispatch failure and last successful progress without recording credentials or full provider responses.

A 15-second database tick begins work at the first eligible tick after known kickoff, not an exact second. Live requests retain a 60-second interval from admitted attempt start. Formal timing/capacity settings and reserved live slots are in [research.md](research.md); the 90-second target still requires measurement. No provider request is made merely because a future fixture exists. Do not hold a worker alive waiting for kickoff or assume an Edge background task survives indefinitely. Free workers have a 150-second wall-clock limit and 2 seconds of CPU per request; fetching, parsing, database work, and room replay need bounded batches and durable continuation. [Runtime limits](https://supabase.com/docs/guides/functions/limits)

## Worker authentication and database access

**Implementation update, 2026-10-26:** managed pg_net queue ACLs are a platform constraint, not a per-project revocation control. Keep `net` outside Data API schemas, keep client roles NOLOGIN, and audit/trust custom database logins before enabling monitoring: they can inspect queued headers. The designated worker login already holds privileged provider operations. See [pg-net-security.md](validation/pg-net-security.md) for official guidance and the local API-denial check.

Use separate adapters for participant commands, public discovery, and scheduled worker execution. Closing all clients must not remove the worker's authority, and participant JWTs must not be fabricated for scheduled work.

- Store the server credential in Vault for Cron invocation and in the appropriate server environment; never an Expo public variable, migration literal, source file, or logged request header.
- For the current secret-key model, send the credential in `apikey`, not `Authorization: Bearer`. The new worker should validate it with `withSupabase({ auth: 'secret:<worker-key-name>' }, ...)` or equivalent explicit verification. A named key enables independent rotation; it still has broad backend privileges and is not a narrowly scoped database role.
- If that adapter uses `verify_jwt = false`, application-level secret validation is mandatory before work. Disabling the gateway check by itself is not authentication. A publishable key, allowed browser origin, or hidden function URL cannot authorize privileged monitoring.
- Keep budget, claim, acceptance, and system-provenance operations in an unexposed private schema. Revoke default `PUBLIC` execution and grant worker operations only to the intended backend role. Review owner, explicit grants, and fixed/empty `search_path` for every privileged function.
- Keep security-definer implementations out of exposed schemas. Any required exposed wrappers must preserve validated access and the intended invoker behavior; verify the complete grant path instead of assuming RLS protects function execution.
- Enable RLS on all exposed tables and explicitly grant only the required access. Public compact match facts must not expose private demand, room links, players, assignments, lease tokens, or worker diagnostics. Any exposed views use invoker security where applicable. Shared facts do not require a broad subscription to internal changes.

The current API-key migration documentation explicitly describes secret-key headers and `auth: 'secret'` for backend/`pg_net` calls. Generic scheduling examples using public keys demonstrate scheduling, not authorization for this privileged worker. Existing participant routes retain their user authentication. An app-wide key migration is separate work. [Key and Edge authentication guidance](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)

## Storage and other operational costs

The compact retention policy remains authoritative: shared facts, meaningful gameplay observations, goals, rosters, and final scalar team statistics; no permanent raw archive. Include internal coordination and scheduler overhead in whole-project capacity checks.

Cron's `job_run_details` is not automatically cleaned up, including after a job is removed. The existing history already occupies about 1.9 MiB. Propose a bounded retention period for this feature's job history, initially seven days, with small daily aggregates where useful. Scope cleanup to jobs owned by this feature; do not silently delete the two existing jobs' history. This is separate from protecting referenced gameplay records. Also bound feature dispatch diagnostics and expire obsolete coordination rows. [Cron history behavior](https://supabase.com/docs/guides/cron/quickstart)

Read saved facts through the existing authorized Data API/RPC transport where suitable, rather than invoking an Edge function for each routine read. Send small room invalidations only for meaningful accepted changes; unchanged provider checks need not broadcast new gameplay messages. Measure egress, Realtime messages/connections, database write load, and Edge invocation usage alongside storage. Adding rooms still adds room consequences and authorized client traffic even when it adds no ESPN calls.

Free projects can pause after a week of inactivity and have no uptime SLA. Do not promise uninterrupted operation across a paused project or outage, or rely on scheduler traffic as a documented exemption from pausing. On resumption, replay accepted observations and reconcile available provider data; clearly distinguish missing source history from recovered accepted history. No upgrade or artificial keepalive is introduced. [Free plan conditions](https://supabase.com/pricing)

## Planning and release checks

1. Confirm current hosted state again; create reviewed local migrations, explicit grants/RLS, indexes, generated contracts, and pgTAP coverage. Verify scheduler and worker authentication locally before activation.
2. Exercise real Postgres concurrency, dispatch/worker failure, expired claims, zero-client kickoff, and replay without another provider fetch. Verify unauthorized callers cannot claim budget or accept source observations.
3. Measure batch CPU/duration, due-query plans, rows/index bytes, Cron/dispatch growth, and aggregate service usage with representative room overlap. Validate the 90-second target under those bounded settings.
4. Inspect remote migration history without overwriting local files; require a deployment dry-run containing only intended migrations. Deploy functions separately from database migrations. Provision credentials without committing them, verify denial/success paths, and activate the one owned job only after legacy fetchers are fenced.

The changelog review found an upcoming removal of old CBC TLS 1.2 cipher suites, starting no earlier than 2026-11-10. It does not change the proposed module architecture; deployment verification should use supported runtimes/TLS. Compatibility of physical clients was not tested by this review. [Changelog notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
