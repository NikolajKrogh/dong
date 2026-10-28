# Compact retained history on Free

M5 stores shared roster participation, typed current/final team metrics and meaningful goal corrections. Missing appearance/minutes/metric values remain null; a squad member is not automatically classified as having played. No source document, profile, media archive, per-minute metrics or per-poll roster history is stored.

The bounded history projection returns at most 128 roster entries and explicitly flags larger retained rosters as partial. The complete compact roster remains stored. Goals retain provider IDs, uncertainty and meaningful retractions/attribution revisions. A complete successful summary stops after one request; incomplete/failed work has at most one retry after fifteen minutes, with two total reservations inside twenty-four hours. Ambiguous reservations count, and unavailable detail never blocks saved scores.

Retention protects every retained multiplayer reference and active observation evidence. Expired solo grants do not pin shared data forever; captured local values survive server eviction, while never-captured expired detail remains unavailable. Only explicit discovery/selection establishes demand, and history reads create no source work.

Capacity uses actual table/index/sequence allocation, conservative shared-history attribution, owned Cron logs and whole-database bytes. Daily samples provide a protected-growth forecast. Conservative growth reservations close the gap between physical measurements: optional work stops at eighty percent, new persistence at ninety percent, and fifty MB of database headroom is reserved. Future four-hour overlap is checked per shared request group, not per room. Unexpected overlap defers optional/new work while preserving existing demand; removing the excess demand clears degradation without deleting history or resetting provider allowances.

Measured workload and indexed query plans are recorded in [us4-storage.md](us4-storage.md) and [storage-measurements.json](storage-measurements.json). One thousand representative shared matches, including forty-person rosters, consumed about twenty MB including indexes; this is not an indefinite-retention or production-capacity guarantee. Five thousand comparable matches already exceed the feature's hundred-MB target before other growth.

Schema/access/retention/query/completion/capacity tests and local snapshot tests pass. Hosted disk/billing, real provider coverage and Android presentation remain unverified. Acquisition remains disabled in the undeployed target.
