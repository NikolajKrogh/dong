# Shared consumer implementation and controlled acceptance

Implemented and verified locally:

- M2 compact goal/participant/current-stat/solo schema, bounded public live/history saved RPC, typed room observation/cursor/provenance references, shared score consequences and trusted saved replay.
- Issuance-bound finite solo SQL creation/replacement/end, version/replay conflicts, expiry denial, fresh identity after cleanup and old-token rejection; server WebCrypto HMAC over immutable issuance UUID plus canonical nonce, fixed-length credential digests and current/retiring key recovery.
- Public client transport for discovery, saved reads and solo tracking, bounded batch splitting/follow-ups, cancellation, safe error mapping and explicit missing IDs. Maintained hooks, existing details/history controls and Java compatibility now use the catalog; no signing key or backend connection appears in client code.

The real adapter workload creates 100 rooms with 500 selected references covered by five shared groups. It asserts five SQL reservations, five controlled HTTP calls, all saved source facts, all room scores/cursors and 500 provider snapshot events. One hundred overlapping fresh consumers and one hundred finite grants add zero upstream work. Two identical concurrent creation requests yield one issuance/token and one admission. See [concurrency evidence](concurrency.md) and the [quality gates](quality-gates.md) for the final suite counts.

Accepted source responses save compact goals/current statistics and reconcile selected rooms in separate transactions. Source IDs and room UUIDs remain unchanged; opaque catalog IDs are additive strings. New rooms preserve the existing first absolute-score reconciliation rule. Provider events carry typed observation provenance and no invented participant actor. Registered/guest snapshots expose catalog linkage and actual source freshness; participant-only history joins remain limited to participant departure records.

Manual-only selections and saved live/history reads add zero acquisition or demand renewal. Null data stays null, existing cards remain, captured local history is independent of later cache eviction, and source failures retain saved content. Java forwards public catalog requests without independent ESPN/Caffeine behavior.

All database work was isolated. Source sharing is demonstrated by the controlled counting workload; [US2](us2.md) separately records unattended module timing. Production, authenticated browser recovery and Android acceptance are not inferred from these results.

Client foreground discovery makes at most two follow-ups, at least 15 seconds apart. Delays over one minute are returned as pending/deferred for explicit later refresh instead of holding a foreground request indefinitely; no early retry is made. Saved-read cache eviction is represented as missing IDs; actual local snapshot survival remains store/controller coverage in T017/T029, rather than a transport test pretending to own local history.
