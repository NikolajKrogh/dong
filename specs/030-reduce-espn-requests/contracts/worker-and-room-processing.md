# Worker, room processing and rollout contracts

**Scope**: Trusted internal operations behind the Match Catalog module. These are not capabilities on the ordinary client object. This document specifies behavior, not implementation bodies or runnable migration SQL.

## Restricted ingress and dispatch

POST `/functions/v1/run-match-monitor` accepts `{ "dispatchToken": "<opaque token>", "workerGeneration": 1 }`. Reject arbitrary source URLs, room lists, scores, timing/budget overrides and unrecognized fields. A valid named server secret in `apikey` and a live server-issued dispatch slot/token are both required. Use `auth: 'secret:match-monitor'` or equivalent exact validation; `verify_jwt=false` alone is insufficient. A user JWT or public key cannot authorize this route.

Each 15-second Cron pass runs one private due-check transaction. It checks selected eligible room processing and source/completion work, recovers expired slots, and enqueues only useful dispatches through pg_net. Allocate at most two worker slots, each with a 60-second lease. Reserve the slots required for live groups due within 45 seconds; optional discovery/enrichment cannot occupy that capacity. Token/generation belong to durable slot state; pg_net's request ID is diagnostic only. Set its timeout to 45,000 ms. HTTP starts after transaction commit; queue loss/error is recovered through due work and slot expiry, not an assumed reliable HTTP queue.

Vault stores the server credential; the SQL operation reads it only to construct the restricted call. Audit pg_net queue grants and database login roles because decrypted request headers temporarily exist there. Never expose queue data through application tables/views or diagnostics. No secrets in migration text, logs, public environments or test fixtures.

Managed Supabase pg_net retains platform-owned PUBLIC object grants; ordinary project migrations cannot revoke them. Treat queued headers as readable by trusted database LOGIN roles. API roles and the backend group remain NOLOGIN, and `net` must stay outside exposed Data API schemas. Audit every custom LOGIN before activation, including the designated worker login; it is already trusted with provider operations. Validate API denial rather than claiming queue ACL isolation. See [verified platform boundary](../validation/pg-net-security.md).

The authenticated worker returns bounded safe counts such as accepted groups, deferred groups, room versions applied and remaining work. Returning HTTP success does not imply every group or room succeeded. Per-group failures are persisted independently, and an unexpected top-level failure remains recoverable. Missing/invalid dispatch authority returns 401/403 before work; obsolete generation returns a safe no-op/conflict without acquisition.

## One `runDueMatchWork` pass

1. Validate caller, generation, slot token and deadline before privileged work.
2. Resume a bounded share of pending room processing from saved observations, even when provider budget is exhausted/paused. Before due live acquisition, use at most two seconds of the measured processing/jitter margin here and yield to the network wave; remaining replay stays durable. A replay failure does not consume source budget.
3. Select at most four eligible request groups for a single concurrent HTTP wave. Lock provider budget state before group ownership; use a consistent order and skip already-owned groups. Database time determines eligibility and expiry.
4. Reserve rolling and daily allowance and allocate monotonically increasing attempt sequence, owner token/generation and 60-second group lease atomically. No allowance means no HTTP. An uncertain reserved attempt stays counted; every retry requires a new reservation.
5. Commit the transaction before HTTP. Apply configured Accept/User-Agent, an explicit 10-second total deadline including body reading, bounded bytes and no automatic inline retry. Restrict requests to constructed allowlisted provider resources. Initial limits: 2 MB scoreboard and 2 MB summary response, checked while streaming rather than after an unlimited `response.json()` allocation.
6. Normalize and validate compact data with a pure adapter. An oversized/malformed response is a controlled resource failure; valid other groups proceed. No client stores/UI/logo side effects in provider parsing.
7. Atomically accept compact facts and meaningful versions only while token, generation and ownership deadline remain valid. Fence score/detail projection sequences across groups. Update last successful check only for a validated successful resource. Preserve prior valid fields missing in a partial response.
8. Apply a bounded share of new/pending room versions in separate room transactions, then persist safe progress/dispatch outcome and release the slot. Leave remaining work discoverable for another useful dispatch. Finish permitted completion enrichment within shared allowances.

Worker wall deadline is 35 seconds; stop admitting network work when less than 15 seconds remains. Begin with at most 100 room transactions/pass, at most four different-room transactions concurrently, and 20 observations/room transaction. Cap room application/jitter at the measured five-second freshness margin and persist continuation when that deadline is reached. Workers cannot process the same room concurrently; room locks/claims serialize it. A lifecycle command may drain at most 20 pending observations per relevant room-match set before returning a retryable pending outcome. These caps let the controlled 100-room cohort fit one application pass in principle; actual database latency/CPU/fan-out must prove it before activation. Continuation uses durable due work, not an unbounded self-invocation chain.

The 90-second freshness target covers the admitted healthy workload: source acceptance and applicable room consequences must fit 60-second cadence + at most 15-second tick delay + 10-second HTTP + 5-second processing target including dispatch margin. Do not claim the target for overloaded/deferred work or infer it from constants alone. Distinguish source acceptance latency, room application backlog, and client recovery latency in measurements. Latest authorized saved room state must appear within the separate five-second healthy recovery criterion; do not redefine it to hide a replay backlog.

## Group eligibility, priority and retries

Scoreboard identity is the canonical provider/league/request-date/response-options scope; a summary uses an exact validated event/competition identity. Store per-match facts, not scoreboard permutations. Known future tracked matches produce no recurring request before kickoff. A group is due when at least one eligible consumer needs it; future untracked matches in its response do not create demand.

Priorities are saved room replay within its deadline share, due active-score monitoring, finite discovery, then completion detail. Source acquisition is globally budgeted at every priority. Initially admit at most eight overlapping live groups for the two-worker shape. Under the admission lock, check current and future four-hour windows from known kickoff, extending existing reservations while live. This predicts capacity; it never declares a match finished after four hours. Unexpected reschedules/long matches surface degraded freshness and stop optional/new demand while preserving existing games. Cache reuse/additional rooms add no source group slots but do consume room/storage capacity.

Apply [research lifecycle/retry settings](../research.md): live every 60 seconds from admitted attempt start; postponed/delayed/suspended work slows progressively up to six hours; explicit terminal state stops routine work. An unchanged score/missing fixture/old kickoff is not terminal evidence. Respect provider-wide 429 cooldown, failed-resource backoff, and operator-only recovery after access rejection. No cooldown reset on reconnect or ownership expiry.

Dedicated completion work shares one two-attempt allowance per match, within 24 hours, across all rooms and all dedicated confirmation/detail purposes. First summary is due five minutes after observed completion; a transient/incomplete first attempt may retry 15 minutes after it. Reserve its attempt count before HTTP; ambiguity counts. A 404/unavailable detail source may end enrichment early. No per-player crawl, per-room summary, routine live-summary loop, or additional final-confirmation allowance.

## Source acceptance and room application

Source acceptance stores facts, meaningful observation evidence and increased per-match version in one transaction; the room cursor gap is the pending-work ledger. Reject repeated attempts or stale projection sequences without regressing data. A valid empty board advances group freshness but does not reset omitted matches to zero or cancel them. A score correction can decrease a score and remains governed by existing gameplay correction rules.

Trusted room application accepts only a saved observation reference plus expected room-match linkage. It does not accept arbitrary supplied scores, participant identity or host permission. Verify observation belongs to the shared match linked to the room match; lock the room then relevant room-match/progress rows in stable order. Check lifecycle and canonical current assignment/common-match selection. Apply the next allowed absolute version through the shared existing consequence implementation; write room events/sequence and advance the cursor atomically. No-op score versions still advance progress.

Provider events have explicit provider actor kind, null participant actor and required observation provenance; participant events retain their participant actor/checks. Keep participant command-result storage unchanged. Deterministic idempotency derives from room match, observation and event kind, using an existing compatible key format. Room progress is the primary replay guard; event uniqueness is additional protection. Re-entry/realtime/presence do not cause provider HTTP.

Before a command reassigns matches, captures departure results or completes a room, capture the latest accepted cutoff and drain earlier pending versions under the same room lock. If the bounded drain cannot complete, commit only safe processing progress and return `room_processing_pending` before changing the requested assignment/lifecycle state; an immediate bounded retry or background continuation finishes the backlog. Preserve the command's idempotency semantics and never record the unperformed requested mutation as successful. The captured cutoff defines ordering with concurrent source acceptance; provider occurrence time does not introduce retroactive assignment rules.

For this pending case, registered RPCs, guest ingress and Java command forwarding all return HTTP 200 with the normal JSON outcome `{ "ok": false, "code": "room_processing_pending", "retryAfterSeconds": 1 }`. It is not a SQL exception: accepted processing progress commits, while the requested assignment/departure/end mutation remains unapplied. Do not record it as a terminal successful command result or manufacture a success payload in an adapter. Success-result shapes otherwise stay unchanged.

Callers recognize this outcome before success parsing, retain saved content/drafts, and may make at most two automatic retries no sooner than one second later using the same command idempotency key and business payload. An eventual success is applied once. A stale precondition follows the existing conflict flow; never silently rebase the mutation or generate a replacement key to bypass it. After the bound, show pending state and allow an explicit later retry. A fresh snapshot may report processing progress but cannot imply the requested mutation succeeded. These retries never trigger ESPN acquisition. Compatibility coverage includes all three transports and supported old-client handling before cutover.

Adoption uses saved-current reconciliation against the existing room score pair, with manual adjustments/history intact. Linking alone changes no score or consumed version. Newly attached room matches retain current 0–0 defaults; the first eligible saved 2–1 produces one 0–0 → 2–1 `provider_score_changed` snapshot event, then anchors/consumes N atomically. Existing 2–1 adopted against 3–1 produces one delta event; identical scores emit none but consume N. There is no separate persisted multiplayer baseline to initialize. Missing observations leave anchor/cursor null. Completed rooms gain references only. Do not replay all pre-link versions or invent individual goals from a score jump. Reactivated selections reconcile latest once, rather than replaying their inactive interval version-by-version.

## Failure semantics

| Failure point | Required recovery |
| --- | --- |
| Before any attempt reservation | Retry eligible work; zero provider allowance consumed. |
| After reservation, before known dispatch | Count conservatively; recover after claim expiry; no uncertain refund. |
| During provider HTTP / late worker response | Persist failure/cooldown when still owner; expired token/generation cannot accept late facts. |
| During source commit | Transaction accepts facts/version together or neither. Repeated accepted attempt is idempotent. |
| Source commit succeeds, room processing fails | Replay saved versions without another source request. Other rooms continue. |
| Room transaction crashes | Consequences/events/cursor commit together or roll back; retry cannot double-award. |
| Budget paused/exhausted | Saved reads/replay continue; no new HTTP. |
| End/removal races a result | Room lock/lifecycle check stops new consequences for ended selection; remaining consumers retain shared monitoring. |
| Project paused/outage | Resume durable work when service returns, reconcile available source facts; never claim unobserved goal-by-goal history was reconstructed. |

## Cutover and supported-client scope

Provider ownership mode is `disabled | legacy | catalog | paused`, with a monotonic worker generation. Ship additive schema/transport first, new acquisition disabled. A transition is authorized operator deployment work, never a public API.

1. Deploy provider schema/room provenance/cursors and protected saved reads; link valid existing metadata and report unresolved identities. No network backfill.
2. Deploy catalog discovery, solo tracking and worker; verify denial/success and capacity/budget configuration with fixtures. Keep dispatch disabled.
3. Deploy Java discovery forwarding with no ESPN fallback and registered legacy Edge read/replay compatibility. Verify all production revisions use those adapters. The Java adapter uses public discovery authority, not worker authority.
4. Switch authoritative legacy acquisition off, invalidate old leases/acceptance generations, and allow previously admitted work to drain within bounded deadlines. Account for any ambiguous cutover attempt; a fence cannot undo a sent HTTP request.
5. Enable one catalog generation and the owned Cron job. Migrate maintained web/Android discovery/solo callers and remove source refresh from room sync. Verify actual source counts and no active legacy backend owner.
6. Report supported bundle/revision adoption. Old solo clients directly call ESPN and cannot be stopped by a server flag. Require refreshed web tabs/updated supported Android builds for the consolidation acceptance workload. Until adoption is established, report residual old-client traffic separately; do not claim universal all-client fencing.
7. Retire compatibility adapters and unused Java ESPN/Caffeine/solo parsers only after supported consumer use and replacement tests justify removal. No permanent alternate provider owner.

Rollback enters `paused` acquisition mode, preserves saved reads and accepted room replay, and fences the outgoing worker generation. Only a catalog-compatible replacement can resume. Do not restore old direct-polling bundles or drop protected tables/history. Database migrations, Edge deployments and client/Java delivery are separately verified. No hidden upgrade, external scheduler, forced account creation or new force-update infrastructure is required by this plan.
