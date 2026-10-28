# Java compatibility integration — 2026-10-26

T019/T030 and the Java portions of T035/T045 are implemented. `GET /v1/matches` forwards selections to public `discover-matches` with the configured project app key, at most 16 league codes per request. It has no ESPN transport, diagnostic probe, local source cache or freshness policy. The retired ESPN DTO/parser/cache and their obsolete tests were removed with the Caffeine dependency/configuration.

The compatibility array keeps source event IDs, offset calendar-date semantics and existing scheduled/live/final/postponed/canceled statuses. Additive `catalogMatchId` stays a string; delayed/suspended/abandoned/unknown remain explicit, unknown score components stay null. Empty success requires all groups to be available; nonempty partial facts remain useful. Cold/unavailable empty selections return controlled 503, malformed catalog data retains controlled 502. Invalid dates/leagues remain 400.

`SupabaseRestClient` recognizes committed HTTP-200 `room_processing_pending` before success handling, waits one second and retries at most twice with the exact original key/business payload. It never updates stale preconditions. Exhaustion returns the exact pending envelope through the command controller, releases the in-flight Java reservation and never completes a terminal success cache. Dispatcher and persistence guards also reject treating a directly returned pending map as terminal success.

Verification:

- A missing-module test compilation checkpoint preceded the initial adapter; a runtime 502/503 regression was also observed failing before its correction.
- Final `mvnw.cmd -B verify`: **87 tests, 0 failures/errors/skips**, package build successful, JaCoCo coverage gate passed. Earlier clean verification also passed, ensuring deleted source beans were absent.
- Public transport, opaque IDs, nullable facts, malformed/failed one-attempt forwarding, known-empty/cold distinction, offset dates, chunking and repeated forwarding are covered. RPC tests verify two identical retries, pending-to-success and pending-to-stale-conflict. Controller/dispatcher/persistence checks verify HTTP 200 and no success caching.
- `git diff --check -- command-api` passed. Source search found no ESPN endpoint/client or Caffeine acquisition path in maintained Java code/config.

Logs are ignored under `.supabase/feature030/java-verify.log`. All upstream responses were mocked; no ESPN or hosted database call, Android test or E2E test was performed. Deployment/integrated feature acceptance remains with the coordinator. Java's catalog read timeout is 40 seconds to accommodate a bounded Edge invocation; maintained clients should use the new direct catalog adapter rather than the old ten-second Java discovery timeout.
