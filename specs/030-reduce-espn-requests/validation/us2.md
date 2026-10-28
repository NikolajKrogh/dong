# US2 controlled closed-client recording

Verified 2026-10-26 on the disposable `dong-feature030` database after the final M1–M5 reset and seed, including reschedule-degradation safeguards. The coordinator's complete SQL suite passed 68 files / 1,118 assertions before the exclusive integration window. No hosted deployment, Android run, browser journey, E2E test or live ESPN request occurred.

`scripts/test-match-catalog-concurrency.mjs --monitor` uses the actual Match Catalog worker composition, owned Postgres adapter and HTTP/parser adapter. It creates 100 active rooms with five shared selected matches, starts with known kickoffs ten seconds in the future, and invokes bounded worker passes through an explicit fifteen-second test driver. No app calls occur during monitoring. Five seconds after the first source wave finishes, the controlled upstream explicitly supplies `STATUS_FULL_TIME`, `completed: true` and a final 3–1 pair. A dedicated fixture flag supplies completion; neither test nor production code infers it from the score. No attempt timestamp or observation is backdated to force the result.

| Observation | Actual result |
| --- | ---: |
| Source HTTP / reservations before known kickoff | 0 / 0 |
| Source HTTP / reservations over two live windows | 10 / 10 |
| Distinct shared scopes; attempts per scope/window | 5; 1 |
| Minimum interval between a scope's reservations | 60,361 ms |
| First accepted source p95 after kickoff | 7,450 ms |
| First applied room event p95 after kickoff | 7,578 ms |
| Provider-visible final update → accepted source p95 | 55,219 ms |
| Provider-visible final update → applied room event p95 | 55,339 ms |
| Applied provider versions / room snapshot events | 10 / 1,000 |
| Explicitly finished shared matches / cleared live-due groups | 5 / 5 |
| Extra terminal tick source HTTP / reservations | 0 / 0 |
| 100 latest-saved module reads after re-entry | 63 ms |
| Additional source calls from those saved reads | 0 |
| Scheduled ticks + immediate terminal verification / duration | 6 + 1 / 75,748 ms |
| Escaped source requests | 0 |

The first source tick had all 500 room matches at 2–1. The next three ticks added no HTTP while the final update was already available upstream. The second eligible source wave updated all 500 matches to 3–1 and persisted all five shared matches as finished/completed. All five normal live-due values became null. An additional bounded terminal tick created neither HTTP nor reservations. Assertions require exactly one source read per each of five scopes in each window, both observation versions and all room events, not only a successful worker return code. Saved-read results must contain the final 3–1 pair, `lifecycle: finished` and `isCompleted: true`.

The same final schema and pooling configuration also passed the independent default overlap workload: 100 rooms / 500 selected references, five requests, 100 additional fresh consumers and 100 finite solo grants, zero additional warm requests, and 500 provider events. Its 101 creation calls included an identical concurrent retry, with exactly 100 admissions. Cold work took 1,142 ms. Its 3,559-ms warm phase includes discovery, saved reads and persistent grant admission together; it is not a saved-recovery latency measurement. See [machine-readable results](monitor-measurements.json) and [overlap details](concurrency.md).

The separate earlier [default resource/replay results](overlap-resource-measurements.json) are preserved as their own run. The monitor JSON now contains this new through-completion run's provenance and actual timings, replacing the earlier non-terminal monitor checkpoint. Local CPU/RSS and synthetic payload counts in that JSON are not hosted Edge/PostgreSQL resource or egress acceptance.

Both modes exercised `max_pipeline: 0` with four pool connections and a dedicated fixture LOGIN role inheriting only `match_catalog_backend`, with its own ten-second statement timeout. All fixture identities and temporary login were removed, original policy/slot/counter state restored, and the database window released after the runs.

Reproduce after preparing a clean disposable profile and pausing other mutation work:

```powershell
$env:DENO_DIR='C:\src\dong\.supabase\deno-cache'
npx --yes deno@2.9.6 run --no-lock --cached-only --allow-env --allow-read=.supabase/feature030/supabase/config.toml,supabase/tests/fixtures/match_catalog.sql --allow-net=127.0.0.1 --node-modules-dir=none scripts/test-match-catalog-concurrency.mjs --monitor
```

This establishes the controlled backend's pre-kickoff dormancy, two-window cadence, closed-client recording through explicit source completion, stopped normal live demand, fan-out and saved-module recovery targets. Future bounded optional summaries remain a separate capability, not a promise of zero source requests forever after completion. The explicit driver is not hosted Cron/pg_net/Edge delivery. Direct PostgreSQL is not Supavisor/TLS acceptance, and module reads do not establish authenticated browser/Android rendering within five seconds. Edge CPU, hosted invocation overhead, Realtime/egress and overloaded latency remain separately measured release concerns. Acquisition stays disabled outside the disposable fixture window.
