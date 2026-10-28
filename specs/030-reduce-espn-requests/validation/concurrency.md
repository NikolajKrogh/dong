# Controlled real-Postgres overlap evidence

Run 2026-10-26 against the disposable `dong-feature030` profile only: PostgreSQL on `127.0.0.1:58322`. This is a backend integration harness; no app/E2E test, Android interaction, hosted mutation or live ESPN call occurred.

`scripts/test-match-catalog-concurrency.mjs` imports the actual Match Catalog composition, Postgres adapter and ESPN HTTP/parser adapter. An ephemeral login inherits only `match_catalog_backend` privileges for application operations; a separate local administrator connection creates and removes the fixture rows. Network permissions allow only loopback. The HTTP adapter validates the exact constructed Site v2 league/date URL, then rewrites it to a local fixture server. Unexpected source resources fail closed. The fixture server checks the real Accept/User-Agent headers.

Workload: 100 active rooms, each with five selected matches from five distinct league/date scopes (`eng.1`, `esp.1`, `ger.1`, `ita.1`, `fra.1`), plus an active manual-only room. Both shared worker slots run concurrently while cold public discovery and finite solo creation overlap. Another 100 fresh consumers discover and read saved facts, with 100 finite solo grants in total sharing those same facts. A single accepted 2–1 pair becomes one typed provider snapshot event per selected room match.

Latest passing overlap result, including the concurrent retry:

```json
{"ok":true,"rooms":100,"selectedRoomMatches":500,"sharedMatches":5,"coldReservations":5,"controlledHttpRequests":5,"warmConsumers":100,"soloGrants":100,"creationCalls":101,"creationAdmissions":100,"extraWarmAttempts":0,"providerEvents":500,"replayContinuations":0,"coldMs":1405,"warmMs":4318,"escapedRequests":0}
```

The harness asserts the accepted source facts, all 500 applied room cursors/scores and all 500 provider events, not only HTTP counts. Fresh discovery, saved reads and the empty/manual selection add zero attempts. Cleanup removes only scoped fixture identities and restores prior policy, empty request groups, worker-slot state and local counters; the ephemeral backend login is dropped. The script refuses a different profile/address, a live scheduler, active worker leases, occupied source scopes or a contaminated solo-admission workload. It never resets the database. Run it exclusively while other feature030 mutation/check commands are paused.

The final M1–M5 schema, conservative growth guard and PostgresJS `max_pipeline: 0` configuration also passed the optional `--monitor` mode through explicit source completion; see [US2 timing evidence](us2.md) and the replacement [monitor results](monitor-measurements.json). The separate [resource/replay run](overlap-resource-measurements.json) remains preserved: its 1,405-ms cold and 4,318-ms mixed warm phases are cohort execution times, not an authenticated UI recovery claim. The normal path was also reconfirmed immediately before the through-completion run (1,142-ms cold / 3,559-ms warm, identical request/admission/event counts), recorded in the monitor JSON's overlap section.

The default workload now sends the first creation twice concurrently through two actual adapters, with identical nonce, operation UUID and body. Both replies must have the same capability and current selection/version, exactly one must be a replay, and a scoped database read must find one immutable server issuance UUID. Across 101 creation calls for 100 consumers, persisted grants and admission counters both remain exactly 100. This is an actual fresh-creation race through real Postgres, rather than only two different nonces or mocked replay responses. It adds no provider request.

Local resource observations for that complete default run, from after the profile guard through fixture cleanup: 281 ms user CPU, 156 ms system CPU, starting RSS 45,563,904 bytes, ending RSS 88,223,744 bytes and a 100-ms-sampled peak of 88,506,368 bytes. These are aggregate local Deno process values, excluding imports/startup, PostgreSQL CPU and the hosted Edge runtime; the sampled RSS is not a guaranteed kernel peak. Five controlled response bodies totalled 2,355 bytes. The 101 saved-read DTO JSON serializations totalled 547,794 bytes. These synthetic payload figures exclude headers/TLS/TCP, discovery responses, Realtime and hosted egress, so they do not establish production egress or Edge CPU/memory acceptance.

The first real-adapter run caught a binding defect missed by mocked acceptance: `JSON.stringify(projection)` passed to a typed PostgresJS jsonb parameter becomes a JSON string. A read-only probe confirmed `jsonb_typeof` was `string`, compared with `object` for `sql.json(projection)`. The coordinator fixed the adapter to use `sql.json`; the complete workload then passed. Fixture setup also now uses the existing room trigger's actual registered host instead of inserting a duplicate participant.

Reproduce from the repository root in PowerShell:

```powershell
$env:DENO_DIR='C:\src\dong\.supabase\deno-cache'
npx --yes deno@2.9.6 run --no-lock --cached-only --allow-env --allow-read=.supabase/feature030/supabase/config.toml,supabase/tests/fixtures/match_catalog.sql --allow-net=127.0.0.1 --node-modules-dir=none scripts/test-match-catalog-concurrency.mjs
```

The ignored disposable profile must already be prepared/running with current migrations. This command has no permission to reach an external provider. Its optional `MATCH_CATALOG_TEST_DATABASE_URL` must still resolve to `postgres://…@127.0.0.1:58322/postgres`.

Focused worker verification in `__tests__/supabase/matchMonitor.test.ts`: 11 tests passed, covering invalid dispatch denial, exactly one four-group wave under an existing slot, saved replay without source reservations, a total 100-room/four-concurrent cap with isolated room failure, deadline margins, and no retry/refund for an ambiguous source commit. Five additional fake-clock cases first demonstrated stalled dispatch/claim/release dependencies escaping the wall bound and a preliminary replay lookup blocking the network wave. After the coordinator added explicit deadline races, all passed: work settles by 35 seconds, preliminary replay yields after its two-second share, and a late reservation reply cannot start HTTP or mutate accepted/failure state. Together with the ingress suite, 22 tests passed. Harness/worker-test ESLint and Deno harness checking passed.

This establishes the controlled US1 overlap/counting behavior. It does not establish hosted activation, real scheduler delivery, closed-client kickoff latency, the five-second authenticated client-recovery target, long-running overload capacity or Android acceptance.
