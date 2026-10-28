# Agreed analysis remediation

**Date**: 2026-10-25  
**Status**: Applied to design artifacts after explicit user agreement; application code and schema are not implemented by this step.

| Finding | Agreed resolution | Principal task coverage |
| --- | --- | --- |
| I1 — all-client versus supported-client scope | FR-002/FR-023 require shared acquisition for supported migrated clients and one authoritative backend owner. Adoption evidence identifies known residual old-solo traffic and visibility limits; server fences do not control old device code. | T077–T080 |
| I2 — local versus provider-wide failure pause | FR-010 distinguishes group-local failures from provider-wide throttling/integration failures, with persisted scope/reason and no diagnostic provider calls. A lone group 403 is local unless its response establishes wider scope. | T048, T053 |
| U1 — solo history retention | Multiplayer server references protect shared history. Solo games retain captured self-contained compact detail locally; bounded saved-only history reads add no ESPN traffic or anonymous retention pins. Uncaptured expired detail may be unavailable. | T014, T017, T021, T029, T062, T066, T068, T072 |
| U2 — expired grant recovery | Token derivation includes immutable server issuance UUID plus creation nonce. Recovery is limited to unexpired issuance state; post-purge creation is fresh counted admission with a new UUID/token. Old authority cannot revive. | T015, T020, T023, T026, T051, T056, T068 |
| U3 — pending room command response | All command transports return the same HTTP-200 pending JSON. Safe score-processing progress commits without the requested mutation or terminal success. At most two automatic original-key/payload retries preserve existing precondition conflicts. | T035, T040, T045 |

Authoritative details: [specification](spec.md), [consumer contracts](contracts/match-catalog.md), [worker/room contracts](contracts/worker-and-room-processing.md), [data model](data-model.md), [research](research.md), [storage policy](free-tier-storage.md) and [tasks](tasks.md).

Validation distinguishes document quality from runtime behavior. Task IDs/counts remain T001–T080, all open. [The focused requirements checklist](checklists/provider-data.md) is preserved and remains pending T001 review; none of its items or implementation tasks is automatically marked complete. The [validation guide](quickstart.md) carries the additional boundary cases for implementation.
