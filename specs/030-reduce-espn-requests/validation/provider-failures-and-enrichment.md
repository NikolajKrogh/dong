# Focused provider failure and completion verification

Verified 2026-10-26 with injected fixtures only. No provider request, hosted operation, Android run or E2E test occurred.

`matchCatalogEnrichment.test.ts` adds four module-composition cases beyond the direct parser tests:

- A completion group referenced 100 times is deduplicated into one claim/read. Its accepted projection contains the full summary roster and boxscore scalar metrics, proving orchestration uses `normalizeEspnSummary`, rather than normalizing only its header. No commentary/profile/media fields or per-athlete fetch survive.
- A malformed summary and a summary for a different source event never reach acceptance. Both record a safe group failure, preserving existing saved facts through the module seam.
- A 404 summary is recorded once; a later database denial adds no request. There is no scoreboard sweep, player endpoint or inline fallback.
- A lost/uncertain acceptance reply produces no repeated summary or failure/refund mutation. The database owns combined-attempt counters and subsequent admission.

`matchCatalogFailures.test.ts` adds four HTTP cases beyond the baseline provider suite: HTTP-date `Retry-After`, declared oversize rejection before a body reader is acquired, fatal invalid UTF-8, and a response arriving after the total ten-second deadline when fetch ignores abort. Late/oversize bodies are cancelled and no probe/retry occurs. Resource 403/provider 429 scope, streaming byte limits, invalid JSON and stalled-body deadlines remain covered by the original provider suite instead of being duplicated here.

Both new suites passed eight tests. Together with provider and worker suites, four suites/30 tests passed at this checkpoint. SQL completion eligibility, combined two-attempt limits, partial upserts and retained-data protection remain the coordinator's real-Postgres/pgTAP evidence; mocked claim denial does not prove those counters.

The runtime adapter review and provisioning limits are in [runtime-database.md](runtime-database.md). Operator reports remain private and ungranted to the ordinary backend/public Match Catalog interface.
