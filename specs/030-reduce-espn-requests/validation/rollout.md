# Implementation and rollout ledger

The hosted catalog was activated on 2026-10-29 after the website had shipped its catalog client ahead of the required Edge deployment. Earlier sections below retain the preparation and preview history.

## Production activation, 2026-10-29

- Applied the seven pending migrations from `20261026163255` through `20261029170000` using `db push --linked --skip-vault`, after a dry run. Existing core and consumer migrations were already present.
- Guarded extension installation with `pg_extension` checks. Reissuing `CREATE EXTENSION IF NOT EXISTS pg_cron` triggered a managed privilege hook and failed with `2BP01`; the explicit guard succeeded, including a later rollback-only repeat.
- Provisioned `dong_match_catalog_login`, inheriting only `match_catalog_backend`, with a ten-second statement timeout. A fresh transaction-pooler connection verified TLS, the timeout, permitted discovery, and denied direct-table/operator access. The local verification trusted the published Supabase CA; deployed functions used their platform trust configuration.
- Configured the server-only database/signing/origin settings and Vault dispatch entries without printing secret values. The named worker key is `match_monitor`: Supabase rejects hyphens in API-key names. The final signing key ID is `v1`; a temporary solo grant was successfully created and ended, leaving no active smoke grant.
- Deployed discovery, solo tracking, monitor and legacy score-refresh compatibility. Production public/default-secret worker calls returned 401; the named monitor key reached body validation. Discovery preflight returned 204 with the production origin, saved reads returned 200, and the internal `net` schema returned 406 through the Data API.
- Fixed cold PostgresJS array serialization by supplying the text-array OID explicitly. A read-only fresh-connection reproduction failed for inferred nonempty arrays and passed for explicit single, multiple, empty and bigint-cast arrays. Production discovery then returned 200.
- Initial acquisition used an eight-per-minute/twelve-per-day sample cap. Existing active-room reservations exceeded that temporary daily forecast and caused partial imports. After restoring the documented 30/5000 limits and refreshing scheduling capacity, invalidated only the two incomplete Saturday sample groups and reacquired them; retained attempt records still account for the requests.
- Catalog generation 3 owns acquisition, legacy SQL entrances are fenced, and the single owned 15-second Cron job is active. A real monitor dispatch returned HTTP 200 without timeout, and Cron runs succeeded. Storage remained below 3 MB attributable to the feature and 24 MB for the database during checks.
- Live discovery returned 12 fixtures for 2026-10-31 across England/Spain/Denmark and five for 2026-10-30 across Spain/Germany/France. Empty responses for tested leagues on 2026-10-29 were successful provider checks, not transport failures. Reload the website and select a date/league with scheduled fixtures.
- Edge typechecks, focused ingress/monitor unit tests (23 tests), changed-source lint and `git diff --check` passed. The actual pinned SDK smoke denied public/other-secret keys with zero networking. The existing guarded local concurrency harness passed with 100 rooms, 500 applied events, five controlled source requests and zero extra warm-consumer attempts. A forged production monitor dispatch was denied with 403. Browser control was disabled; endpoint checks do not claim a browser UI or physical Android run. Java hosting and older client adoption were not verified, so this does not claim universal provider-traffic consolidation.
- Post-deployment security advisors retained the same warning categories as the baseline; three additional private RLS-enabled tables account for the extra no-policy informational findings. Performance advisors still report unindexed foreign keys, including catalog attempt/group keys. No unrelated advisor remediation was included.

Rollback remains the paused-mode operator procedure below; preserve saved facts, replay, credentials and catalog-compatible clients. Deployment source includes the local fixes described above; they are not yet committed by this run.

| Migration alias | CLI-created local file |
| --- | --- |
| M1 | `supabase/migrations/20261025191037_match_catalog_core.sql` |
| M2 | `supabase/migrations/20261025193835_match_catalog_consumers.sql` |
| M3 | `supabase/migrations/20261026163255_match_catalog_monitoring.sql` |
| M4 | `supabase/migrations/20261026164400_match_catalog_recovery.sql` |
| M5 | `supabase/migrations/20261026164719_match_catalog_retention.sql` |

Acquisition defaults disabled. Deployment/activation and supported-client adoption remain separate release gates. No reset of an existing or hosted database is permitted by the disposable profile.

Before provisioning the Edge DSN, follow [runtime database review](runtime-database.md). The dedicated login needs `GRANT match_catalog_backend` and its own `ALTER ROLE ... SET statement_timeout='10s'`; a NOLOGIN role's defaults are not inherited as session settings. Use the actual transaction-pooler host/custom-role username and verified TLS. Check the fresh login's effective timeout, intended execute grants and denied table/operator access. Pinned PostgresJS is configured without prepared statements or pipelining and uses only atomic function calls; hosted pooler/certificate acceptance remains a separate pre-activation check.

## Verified preview, 2026-10-26

Read-only Supabase MCP migration history reported 62 hosted entries, ending at `20261022172949_multiplayer_game_editor`; none of M1–M5 was present. The installed CLI is pinned at 2.118.0. Its command help was checked, then this preview was run after verifying `supabase/.temp/project-ref` equals `qccvlhblytuedgmlqfef`:

```powershell
npx supabase db push --linked --dry-run --skip-vault
```

It succeeded and listed exactly the five files above, with no seed or role payload. The ignored output is `.supabase/feature030/hosted-migration-preview.log`. This preview applied no feature migration, Vault configuration, function deployment, Cron activation or client release. Repeat it immediately before a later approved push; do not repair/fetch migration history or use `--include-all` to bypass a different preview.

Hosted advisors returned existing baseline findings, not a clean feature-deployment verdict: 38 security findings across RLS-without-policy information, mutable search paths, executable security-definer functions and Auth configuration warnings; 10 performance informational findings covered unindexed foreign keys and unused indexes. Findings were observed by the service at approximately 17:32 UTC on 2026-10-26. Review the [security-definer](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [search-path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) and [foreign-key](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) reports again after deployment; no unrelated hosted remediation was performed.

## Prepared commands — not executed

T079 requires separate deployment authorization and a reviewed source revision. Run these later from the reviewed checkout, preserving unrelated dirty work. Actual Cloudflare project/production branch, Google project/region/service, secrets and hosted connection acceptance must be resolved before execution; no values are invented here. [Production delivery](../../../docs/production-hosting.md#feature-030-match-catalog-release) records the repository's actual CI and manual-hosting paths.

### 1. Apply additive schema with acquisition disabled

Check the linked project and repeat the exact five-file preview. Only after that preview and deployment approval:

```powershell
npx supabase db push --linked --skip-vault
```

Do not include seed data, custom-role files, Vault updates or unrelated functions. Through separately authorized operator SQL, verify the installed versions, `private.provider_budget_state.ownership_mode='disabled'`, and the owned `match-catalog-monitor` job is inactive. Do not change existing job schedules.

### 2. Provision the restricted runtime and credentials

Use the [dedicated login template](runtime-database.md#provisioning-template-for-a-later-authorized-deployment), set its password through the approved secret workflow, and verify a fresh transaction-pooler connection. The actual LOGIN must have the ten-second default, verified TLS, intended private execute grants and no direct provider-table/operator privileges. The adapter uses four connections per warm instance, `prepare:false`, `max_pipeline:0` and atomic function statements. Public API/JWT credentials cannot substitute for its DSN.

Create the named Supabase server key **`match_monitor`** through the project's API-key management UI. Confirm the runtime's platform-supplied named-secret map supports `auth:'secret:match_monitor'`; do not manufacture a service-role client bypass. Store that same key in Vault as `match_catalog_monitor_key`, and the public project URL `https://qccvlhblytuedgmlqfef.supabase.co` as `match_catalog_project_url`. Use existing named entries when rotating rather than duplicate names. Verify names only; never print decrypted values.

Prepare an ignored, access-restricted `.supabase/match-catalog.production.env` using the approved secret workflow:

```dotenv
MATCH_CATALOG_DATABASE_URL=postgresql://dong_match_catalog_login.qccvlhblytuedgmlqfef:<PERCENT_ENCODED_PASSWORD>@<VERIFIED_TRANSACTION_POOLER_HOST>:6543/postgres?sslmode=verify-full
MATCH_CATALOG_SIGNING_KEY_ID=<CURRENT_KEY_ID>
MATCH_CATALOG_SIGNING_KEYS={"<CURRENT_KEY_ID>":"<32_RANDOM_BYTES_AS_CANONICAL_BASE64URL>"}
MATCH_CATALOG_ALLOWED_ORIGINS=https://dongthegame.com
PROVIDER_SCORE_ALLOWED_ORIGINS=https://dongthegame.com
MATCH_CATALOG_FIXTURES_ONLY=false
```

`MATCH_CATALOG_MODE` is not the production authority; database ownership mode is. Keep signing key IDs/material for unexpired issuance recovery during rotation. Never place the DSN, signing keys or monitor key in Expo/EAS public variables, tracked files, command arguments or logs. Before activation, audit every custom database LOGIN against the [managed pg_net trust boundary](pg-net-security.md); queued headers are visible to trusted database logins. Keep `net` outside Data API schemas.

Upload the ignored file and deploy only the reviewed functions:

```powershell
npx supabase secrets set --project-ref qccvlhblytuedgmlqfef --env-file .supabase/match-catalog.production.env
npx supabase functions deploy discover-matches solo-match-tracking run-match-monitor refresh-provider-scores --project-ref qccvlhblytuedgmlqfef --use-api
```

The checked config sets gateway JWT verification off for these adapters; actual public-key, registered-user and named-secret checks remain in their handlers. Before enabling source work, verify invalid worker credentials/dispatches fail, `Accept-Profile: net` is denied, saved-only reads work, and the deployed DSN/TLS/timeout configuration succeeds. Do not enable monitoring merely because deployment uploaded successfully.

### 3. Fence the outgoing source owner

Deliver the Java catalog forwarder and registered legacy Edge read/no-op compatibility. Confirm every routable backend revision uses these adapters; account for already dispatched old requests. Then run this **operator SQL**, with Cron still inactive on the initial rollout:

```sql
begin;
select private.configure_catalog_limits(30,5000);
do $$
declare generation bigint; result jsonb;
begin
  select worker_generation into generation from private.provider_budget_state where provider='espn' for update;
  result:=private.set_catalog_ownership('paused',generation);
  if result->>'ok' is distinct from 'true' then raise exception 'catalog_fence_failed'; end if;
end;
$$;
commit;
```

This permanently fences the old SQL acquisition entrances, clears old ownership leases and advances generation without refunding ambiguous attempts. Java's former independent HTTP owner is stopped by deploying/routing only the forwarder, not by this SQL flag. Existing direct-ESPN solo bundles cannot be centrally fenced.

### 4. Deliver supported clients, then activate one generation

Publish the reviewed Expo web export and require refreshed web tabs for the supported acceptance cohort. **Android delivery and device testing are skipped at the user's request for now.** Existing Android/old web solo bundles remain outside the consolidated-traffic claim; record their residual direct traffic separately. Do not claim all-client source consolidation while they remain in use.

Review capacity, unresolved identities, fresh-login/TLS evidence, advisor changes and saved-room recovery before activation. The following operator transaction measures current storage, preserves explicit 30/5000 budgets and enables only the owned job:

```sql
begin;
select private.configure_catalog_limits(30,5000);
select private.measure_catalog_capacity();
do $$
declare generation bigint; result jsonb;
begin
  select worker_generation into generation from private.provider_budget_state where provider='espn' for update;
  if not (select new_demand_allowed from private.provider_budget_state where provider='espn') then
    raise exception 'catalog_capacity_review_required';
  end if;
  result:=private.set_catalog_ownership('catalog',generation);
  if result->>'ok' is distinct from 'true' then raise exception 'catalog_activation_failed'; end if;
  perform cron.alter_job(jobid,active:=true) from cron.job where jobname='match-catalog-monitor';
  if not found then raise exception 'catalog_monitor_job_missing'; end if;
end;
$$;
commit;
select private.catalog_operator_report();
```

Record the returned generation and actual deployed revisions. Verify useful-only dispatch, no recurring pre-kickoff monitoring, provider attempts/budget/cooldown, closed-client selected-room progress and authorized saved-room recovery under the approved live check. Counts from local controlled fixtures do not establish hosted TLS, source availability or sustained Free-tier capacity.

## Rollback: pause acquisition, retain replay

Keep catalog-compatible schema/functions/client paths. Do not drop retained facts/history, restore an old direct-fetch revision, or switch ownership back to `legacy`.

```sql
begin;
do $$
declare generation bigint; result jsonb;
begin
  select worker_generation into generation from private.provider_budget_state where provider='espn' for update;
  result:=private.set_catalog_ownership('paused',generation);
  if result->>'ok' is distinct from 'true' then raise exception 'catalog_pause_failed'; end if;
end;
$$;
commit;
select private.catalog_operator_report();
select jobname,active from cron.job where jobname='match-catalog-monitor';
```

Paused mode advances generation and stops new source acceptance/acquisition while saved reads and accepted-room replay continue. Preserve the active owned Cron job for replay; explicit `disabled` mode turns it off and is not the normal rollback. In-flight uncertain reservations remain counted. Resume only a reviewed catalog-compatible deployment with fresh capacity/budget checks and a new recorded generation. Rotate compromised credentials through the approved secret workflow without exposing them.
