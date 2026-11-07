# Notification Requirements Checklist: Active Game Goal Notifications

**Purpose**: Review whether the eligibility, delivery and rollout requirements are clear enough to turn into implementation tasks.
**Created**: 2026-11-06
**Feature**: [Goal notification spec](../spec.md) and [implementation plan](../plan.md)

**Note**: This checklist reviews the written requirements before task generation or PR review. Leave items open until the relevant wording is explicit and consistent.

## Recipient and consent requirements

- [x] CHK001 - Are per-browser push consent and the personal multiplayer session setting defined separately, including who can change each one? [Completeness, Spec §FR-001, §FR-003]
- [x] CHK002 - Are both multiplayer choices, the default for each new session and the common-match preference in either scope stated consistently? [Consistency, Spec §Clarifications, §FR-003, §FR-013]
- [x] CHK003 - Is “every match in the room” defined consistently for unassigned pool matches, including the limits of existing score coverage? [Ambiguity, Spec §FR-003, Research §Resolve eligibility from the active game]
- [x] CHK004 - Are ownership and authorization rules explicit for registered participants, hosts, guests and finite solo play, including expired or rotated access? [Coverage, Spec §FR-005, §FR-009, §FR-016, Data Model §Eligibility and concurrency]
- [x] CHK005 - Are same-session retention, separate players' choices, multiple browsers and conflicting changes specified without implying that one browser grants consent for another? [Completeness, Spec §FR-001, §FR-003, Data Model §Multiplayer scope]
- [x] CHK006 - Is the no-replay boundary defined for new enrollment, scope expansion, reassignment, re-added matches and common-match re-enablement, including uncertain ordering? [Edge Cases, Spec §FR-006, §FR-009, Data Model §Eligibility and concurrency]
- [x] CHK007 - Are offline opt-out, sign-out, game replacement, departure and expiry requirements explicit about when a stop is pending or acknowledged? [Recovery, Spec §User Story 2, §FR-009, Contracts §Browser and player operations]
- [x] CHK008 - Is the point at which a stop prevents a new send defined consistently, including the gap between final authorization and handoff? [Conflict, Spec §FR-009, §SC-003, Data Model §Eligibility and concurrency]

## Delivery requirements and failure coverage

- [x] CHK009 - Are eligible goal evidence, neutral score updates, corrections, late enrichment, unknown baselines and multiple goals in one update distinguished clearly? [Clarity, Spec §Edge Cases, §FR-004, §FR-007]
- [x] CHK010 - Are foreground system alerts and the independent toast and DONG sound settings described consistently with the multiplayer foreground fix as an enablement prerequisite? [Consistency, Spec §Clarifications, §FR-013, §FR-022, Plan §Implementation sequence]
- [x] CHK011 - Do the duplicate criteria distinguish one logical alert from provider handoff and device presentation, including uncertain handoff outcomes and the requirement for visible notifications? [Conflict, Spec §FR-006, §FR-008, §FR-022, §SC-002]
- [x] CHK012 - Are expiry and retry requirements measurable from the original evidence acceptance time, with a stated boundary for delayed device presentation? [Measurability, Spec §FR-008, §SC-006]
- [x] CHK013 - Are transient failure, permanent subscription failure, permission revocation and recovery each covered, including what consent or registration state remains afterward? [Coverage, Spec §FR-002, §FR-010, §FR-020, Contracts §Sender boundary]
- [x] CHK014 - Are unauthorized destination, registration abuse, payload privacy and expired game access requirements explicit for both test and goal notifications? [Completeness, Spec §FR-011, §FR-012, §FR-016, §FR-023, Contracts §Sender boundary]
- [x] CHK015 - Are the requirements explicit about protecting score acceptance, room updates and provider request budgets when notification work fails or reaches its limits? [Non-Functional, Spec §FR-008, §SC-006, Research §Bound independent scheduling and storage]
- [x] CHK016 - Are dispatch states and retention deadlines defined in terms reviewers can distinguish from presentation, and is the game history exclusion explicit? [Measurability, Spec §FR-017, §FR-018, §SC-008]
- [x] CHK017 - Does the latency criterion identify its start and end events, the sample size, device conditions and how degraded conditions are reported? [Measurability, Spec §SC-001, Quickstart §Phone evidence and staged enablement]

## Setup, recovery and release boundaries

- [x] CHK018 - Are setup and recovery requirements distinct for an ordinary iPhone tab, its Home Screen website, an embedded browser and a denied or revoked permission? [Coverage, Spec §FR-002, §FR-014, §FR-019, §FR-020]
- [x] CHK019 - Are accessibility, essential notification content and the limits of a test notification stated for both successful setup and unsupported conditions? [Completeness, Spec §FR-002, §FR-021, §FR-023, §SC-004, §SC-008]
- [x] CHK020 - Do the spec and plan agree on code-free opt-in, target policy, Android preview checks and iPhone feedback from production users? [Consistency, Spec §FR-014, Plan §Implementation sequence]
- [x] CHK021 - Are pilot capacity, rollout stop conditions and rollback expectations specified, including outstanding deliveries and preservation of score history? [Dependency, Spec §SC-006, Plan §Technical Context, §Implementation sequence, Quickstart §Phone evidence and staged enablement]

## Review resolutions

- **CHK007** — Offline stops survive local sign-out using the installation credential and original generation. The UI reports pending until server acknowledgment. [Spec](../spec.md) · [Disable contract](../contracts/goal-notifications.md#browser-and-player-operations)
- **CHK013** — Revoked or reset browser permission clears consent. Endpoint expiry can be repaired while same-identity consent and permission hold. Transient and sender configuration failures preserve enrollment. [Spec](../spec.md) · [Sender boundary](../contracts/goal-notifications.md#sender-boundary)
- **CHK021** — Safety and gameplay failures pause sends. Device latency or capacity misses hold expansion. Numerical capacity limits are recorded before the first production cohort. [Plan](../plan.md#implementation-sequence) · [Quickstart](../quickstart.md#phone-evidence-and-staged-enablement)
