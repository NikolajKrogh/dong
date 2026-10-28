# Inserted storage/query measurement (T071), 2026-10-26

The guarded local runner completed against `dong-feature030`, localhost 58322, with M1–M5 applied and the owned Cron job disabled. The full machine-readable evidence is [storage-measurements.json](storage-measurements.json). No source HTTP, acquisition reservation or scheduler dispatch was used. All fixture writes ran inside one rolled-back transaction; the final residue check found zero fixture matches, athletes, accounts or scheduler rows. This does not establish hosted capacity or device acceptance.

## Workload actually inserted

1000 shared matches across five supported leagues and 30 days; 100 shared team identities; 2000 shared athlete identities; 40 roster entries per match; 6 goals per match with 600 meaningful clock corrections; 2 expanded team-stat rows per match; 10 meaningful score/lifecycle observations per match. 100 active rooms each select the same five matches, with one actual registered participant per room, 500 assignment references and 500 first-score reconciliation events. A score jump creates one snapshot event per room/match rather than six invented individual goal events. The initial goal revision trigger creates 6000 revisions; 600 genuine changes bring the total to 6600.

The 40000 roster rows preserve 30000 known appearances, 6000 known unused substitutes and 4000 unknown appearances. 2000 roster entries have unknown athlete identity, and 4000 have unknown minutes. Known unused minutes are 0; unknown minutes remain null. 200 of the 2000 team-stat rows have unknown offsides while valid zero red-card values remain 0.

## Actual physical allocation, including indexes

These are decimal bytes/MB. Physical deltas are measured with `pg_total_relation_size`; they are not serialized JSON estimates.

| Portion | Measured allocated bytes | Interpretation |
| --- | ---: | --- |
| Shared private match data/identities/coordination |20054016|About 20.05 KB per unique match in this workload|
| Rosters alone |9437184|About 9.44 KB per match; 4374528 bytes of this are indexes|
| Meaningful observations |2465792|10000 rows and their indexes|
| Current goals |2170880|6000 current rows and indexes|
| Goal participant links |1908736|12000 scorer/assist links and indexes|
| Goal revision evidence |1351680|6600 initial/corrected rows and indexes|
| Current/final expanded team metrics |606208|2000 typed wide rows and indexes|
|100 active rooms, participants, assignments, matches and provider events |1384448|About 13.84 KB per one-participant/five-match room|
|1000 owned Cron log entries |229376|About 229 allocated bytes per sampled log entry|

The actual saved row datums are smaller: rosters 4703200 bytes, observations 1854416 bytes, goals 1289712 bytes, expanded stats 394800 bytes, and provider events 364000 bytes. `pg_column_size` measures these actual inserted row datums; it excludes page/index allocation. Do not use the datum sum as a database quota forecast. The JSON records per-relation heap/table/index/total bytes, sequence sizes, before/after deltas and the independent capacity-policy result.

The policy sample attributed 23568384 bytes to the feature. Whole local database size during the workload was 41208979 bytes, leaving 458791021 bytes below the 500000000-byte database allowance. The policy itself still reserves 50000000 bytes of headroom. These local values do not describe the hosted project's existing data.

## Growth scenarios and limits

With the same identities/40-person rosters/10 observations/goal corrections per match, holding the 100 sample rooms fixed:

| Retained unique matches | Shared match allocation | With 100 sample rooms and estimated seven-day owned Cron logs |
| --- | ---: | ---: |
|1000|20054016|30686905|
|2500|50135040|60767929|
|5000|100270080|110902969|
|10000|200540160|211173049|

5000 such matches already exceed the 100 MB feature target before other application data. The 80 MB optional-enrichment stop and 90 MB new-demand stop therefore matter even on Free. Roughly 100 new unique matches/day retained in the 30-day unreferenced cache imply about 3000 match sets (~60 MB shared allocation) before retained history, room growth and scheduler logs. Protected history is additional cumulative growth; no indefinite-retention guarantee follows from this sample.

The 15-second SQL job can produce 40320 log rows over seven days, including idle checks. Scaling the 1000 physically inserted log rows gives 9248441 bytes (~9.25 MB) for that seven-day allowance. This attribution is material even though idle ticks make no Edge invocation/provider request. Real command/status text and page packing can differ; owned log cleanup remains necessary.

The sample has one participant per room, active rooms and one first-score event per selected reference. It does not include a completed assignment snapshot per room or every possible later provider/manual/drink event. More participants, protected sessions and accepted score changes increase public history beyond the illustrated room cost. Row sizes also vary by names, available fields and revision frequency. WAL/disk limits are separate and are not measured as hosted service usage here.

## Query plans

After analyzing the inserted data, `EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON)` measured:

| Query | Actual rows | Local execution time |
| --- | ---: | ---: |
| League/source event identity |1|~0.03 ms|
| Athlete's known/unknown participation |20|~0.10 ms|
| League/day discovery |7|~0.05 ms|
| Goal timeline with scorer/assist identity |12|~0.08 ms|
| One shared match's active room fan-out |100|~0.15 ms|

The complete plans and exact timing/buffer values are in the JSON. Identity, roster athlete, league/kickoff, goal timeline and catalog room-reference indexes are exercised; the room join uses a hash join over the small 100-room workload. These are warm local database execution times, excluding network/Edge/device latency. They are query-shape evidence rather than production latency acceptance.

## Repeatability and cleanup limits

Run `scripts/measure-match-catalog-storage.mjs` with Deno 2.9.6, its pinned `postgres@3.4.9` cache, `--node-modules-dir=none`, the documented file permissions and loopback-only network permission. It checks the isolated profile, rejects a different database URL/URL options, requires M5 and a disabled owned Cron job, and takes no hosted credentials. Coordinate with other workers before using this one disposable database.

An initial fixture alias error rolled its transaction back; the corrected full run succeeded. Physical allocation deltas depend on existing pages/index slack and can be smaller when prior local tests allocated reusable space. The before/after report makes that baseline explicit. Rollback removes fixture records, but sequence advancement, WAL and allocated files do not roll back or imply reclaimed disk. The runner analyzes affected local relations again after rollback so query estimates reflect the remaining real rows. A disposable reset is available when a fresh physical baseline is needed; no other database was reset or modified by this measurement.
