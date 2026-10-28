# Durable bounds and recovery

The final SQL suite and full client/Java/unit checks pass; see [quality gates](quality-gates.md). Controlled tests use database-owned state, fresh worker tokens, real Postgres and loopback provider responses. No live provider diagnostic/probe request is used.

SQL tests cover rolling sixty-second boundaries, UTC-day rollover, exhausted/invalid budgets, expiry without refunds, uncertain reservations, stale leases/generations, cross-resource projection ordering, group-local access rejection, provider-wide Retry-After and healthy-group isolation. Accepted source commits are separate from atomic per-room events/cursors. A command drains at most twenty accepted observations and returns the exact committed HTTP-200 pending envelope before any requested reassignment/departure/completion mutation. Original-key retries and stale-precondition handling are covered in Java and registered/guest clients.

The actual concurrent grant race creates one immutable issuance/token for two identical simultaneous requests. Expired-row denial, cleanup followed by a new counted UUID/token, rejection of the old token and current/retiring signing-key behavior are tested. Saved reads have no acquisition/renewal authority; public credentials cannot claim work or invoke the named-secret worker.

Pause increments generation, fences obsolete acceptance, preserves saved reads and keeps the owned Cron job available for accepted replay. Returning to legacy acquisition after cutover is rejected. Operator reports expose bounded last-day attempts by group/purpose/outcome and daily copied-label consumer reuse/deferral totals; they have no worker/client grant.

Source freshness is distinct from room connectivity. Nullable/partial facts, stale saved content, denied admission, expired grants and processing-pending state remain visible without clearing game content. Legacy selection changes and ambiguous pending mutations are generation/idempotency fenced. Android/E2E recovery was explicitly excluded; literal PostgreSQL-server crash/restart and hosted network outages were not performed.

Managed pg_net's actual trust boundary is documented in [pg-net-security.md](pg-net-security.md): `net` remains unexposed through the Data API and API roles remain NOLOGIN; trusted database logins can read queued headers. Ineffective owner-level ACL revocation is not claimed as protection.
