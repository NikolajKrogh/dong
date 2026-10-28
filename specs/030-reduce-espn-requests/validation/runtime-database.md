# Runtime database adapter review

Reviewed 2026-10-26 against current official Supabase docs and pinned PostgresJS 3.4.9 source. No hosted login, secret, TLS or pool connection was changed or tested.

## Pooling and deadlines

The intended Edge deployment uses the shared Supavisor transaction endpoint. Its module-cached client has `prepare: false`, four connections maximum and `max_pipeline: 0`. Four allows the reviewed four-room processing fan-out; it is a per-warm-instance ceiling, not a global connection limit. Source ownership still uses two durable worker slots. Public metadata calls remain database traffic and need actual deployment-level connection/latency observation.

Current [PostgresJS guidance](https://supabase.com/docs/guides/database/postgres-js) warns that its default pipelining is unsafe through Supavisor transaction mode. In [pinned 3.4.9 execution code](https://github.com/porsager/postgres/blob/v3.4.9/src/connection.js), `max_pipeline: 1` still writes a second query before marking the socket full, because the pending queue excludes the active query. Zero closes admission after the first write. The documented zero/`sql.begin()` upstream limitation is avoided: every adapter call executes one atomic database function, and the adapter does not use `sql.begin()`. Adding driver-managed transactions requires revisiting this choice. Existing local fixture setup uses a separate administrator client with its normal transaction configuration.

The adapter no longer sends `statement_timeout` as connection startup/session state. [Supabase timeout guidance](https://supabase.com/docs/guides/database/postgres/timeouts) distinguishes transaction pooling from persistent session settings. Provision the dedicated **LOGIN role** with a ten-second statement timeout, then verify it through a fresh connection. Putting a setting on the granted NOLOGIN capability role does not establish that login's session defaults.

JavaScript deadlines cover pool/transport waits; SQL generation/token checks and database-clock deadlines fence late commits. A rejected caller-side timeout does not cancel or refund an uncertain reservation. SQL statement timeout is a separate backend resource bound, not a replacement for dispatch deadlines.

## TLS and credentials

Only literal loopback hosts `localhost`, `127.0.0.1` and `[::1]` may use plaintext. Remote connections force PostgresJS `ssl: true`, whose TLS path retains certificate and hostname verification. The adapter rejects a remote `sslmode` other than `verify-full` rather than allowing `disable`, `prefer`, `allow`, `require` or `verify-ca` to weaken that policy. In pinned PostgresJS, the string `ssl: 'require'` explicitly sets `rejectUnauthorized: false`; it encrypts without verifying the peer, so it is not used here.

Use the platform's trusted CA configuration; a missing required CA must fail closed. Current [Edge Postgres SSL guidance](https://supabase.com/docs/guides/functions/connect-to-postgres) describes the deployed trust configuration and local `SSL_CERT_FILE` / `DENO_TLS_CA_STORE` options. Follow [SSL verification guidance](https://supabase.com/docs/guides/platform/ssl-enforcement) when provisioning the target certificate. Never change to disabled certificate verification to make a connection succeed.

`MATCH_CATALOG_DATABASE_URL` is a server-only DSN, not an anonymous/publishable key, JWT, or service-role shortcut. The deployment should create a dedicated login inheriting only `match_catalog_backend`; that capability role remains NOLOGIN. The controlled concurrency harness exercises the same arrangement with an ephemeral fixture login and the ten-second login default. Public routes never receive worker/operator/table authority.

## Provisioning template for a later authorized deployment

This is a template, not an executed migration. Supply the password through the approved secret workflow; do not put a real password into this document, tracked SQL, command output or the client environment.

```sql
create role dong_match_catalog_login login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant match_catalog_backend to dong_match_catalog_login;
alter role dong_match_catalog_login set statement_timeout='10s';
-- Set its password separately through the approved secret workflow.

select rolname,rolcanlogin,rolsuper,rolbypassrls,rolconfig
from pg_roles where rolname in ('dong_match_catalog_login','match_catalog_backend');
```

Use the dashboard's transaction-pooler host and the custom-role username `dong_match_catalog_login.<PROJECT_REF>`. Store the resulting percent-encoded credential DSN in `MATCH_CATALOG_DATABASE_URL`, with optional `sslmode=verify-full`. Do not grant broad table privileges, ownership, BYPASSRLS or `service_role` to this login. Through a fresh login/pool connection, check `current_user`, `current_setting('statement_timeout')`, intended private-function access and denied direct-table/operator access. Then exercise the deployed adapter with a bounded fixture/saved-only smoke before activation. Local direct-Postgres success does not establish Supavisor/TLS acceptance.

Operator reports intentionally stay outside the ordinary Match Catalog interface. `catalog_operator_report` has no backend/public grant; use separately authorized operator access rather than adding a consumer escape hatch.

## Local verification after the options change

Both real-Postgres harness modes passed with `max_pipeline: 0` and a fixture login configured to ten-second statement timeout. The overlap mode accepted five shared facts and applied 500 room events while 100 additional consumers/grants added no source calls. The timed monitor applied two versions across those 100 rooms with exact sixty-second source cadence and zero pre-kickoff calls; see [measurements](monitor-measurements.json). This confirms the pinned driver's atomic-call configuration locally. A `--deny-net` configuration smoke also rejected remote `disable`, `allow`, `prefer`, `require` and `verify-ca` modes and accepted `verify-full` lazily. It does not claim a remote TLS handshake or actual Supavisor delivery.
