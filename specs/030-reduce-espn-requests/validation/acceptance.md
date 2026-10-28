# Acceptance scope, 2026-10-26

The implementation is verified locally with deterministic provider responses and actual Postgres. Production acquisition is not activated. Android and E2E testing were explicitly excluded. Deployment/live acceptance tasks remain open.

| Criterion | Controlled evidence and limit |
| --- | --- |
| SC-001 | Five requests for 100 rooms / 500 selected references: 99% fewer than the specified 500-independent-attempt comparison. Not a production billing measurement. |
| SC-002 | One hundred fresh consumers and one hundred solo grants add zero requests; an actual duplicate fresh-creation race produces one issuance/admission. |
| SC-003 | Zero requests before kickoff; actual timed module passes record source/room updates within ninety seconds. Exact measurements are in [US2](us2.md). |
| SC-004 | Actual live and explicitly finished source versions reconcile 100 rooms without connected clients; all five live due values clear, and an additional terminal tick adds zero HTTP. SQL cutoff/idempotency and source/room isolation checks prevent duplicate consequences. See the final through-completion run in US2. |
| SC-005 | Real SQL boundary/day/expiry/cooldown/generation checks, controlled failures, repeated worker passes and global reservation counting. No literal hosted outage/server-crash experiment. |
| SC-006 | Compact parser/schema/current-detail/correction cases preserve identities, unknowns and existing gameplay rules. No raw-response history exists. |
| SC-007 | One hundred saved module re-entry reads finish well below five seconds and add no HTTP. Hook/transport tests retain stale content and source time. Actual authenticated web/Android rendering remains unverified under the user exception. |
| SC-008 | Private bounded last-day group/purpose/outcome reporting and copied-label daily consumer reuse/deferral totals; terminal/deselected work stops normal demand. |
| SC-009 | Real forty-person roster/stat/goal insertion, indexed queries, public projection caps and captured-local-history survival. Unknown appearance never becomes an unused substitute's appearance. |
| SC-010 | Actual relation/index/sequence/whole-database measurements, protected references, evictable caches, growth forecasts/reservations and eighty/ninety-percent admission controls. Reschedule overload preserves existing recording and stops optional/new demand. |

The overlap resource sample measures the local harness: 437 ms CPU and about 84.4 MiB sampled peak RSS; it excludes the database process and hosted Edge runtime. Five tiny synthetic source bodies total 2,355 bytes; saved DTO payloads are separately counted. Headers/TLS, representative real-provider payloads, deployed Edge CPU/invocations, Realtime delivery and billed egress require the authorized target run. No sustained hosted Free-tier operating claim is made.

See [quality gates](quality-gates.md), [monitor measurements](monitor-measurements.json), [overlap resources](overlap-resource-measurements.json), [storage evidence](storage-measurements.json), [release review](release-review.md) and [prepared rollout](rollout.md). Host targets/credentials, Supavisor/TLS acceptance, supported-build adoption and the bounded live smoke remain explicit release gates.
