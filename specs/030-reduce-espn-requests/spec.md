# Feature Specification: Reduce ESPN Requests with Shared Match Data

**Feature Branch**: `190-reduce-espn-requests`

**Feature Directory**: `specs/030-reduce-espn-requests`

**Created**: 2026-10-25

**Status**: Task backlog generated - focused requirements review and implementation pending

**Implementation verification exception (2026-10-25)**: The user explicitly forbids creating or running E2E tests for this implementation. Preserve existing E2E files and use unit/component/backend-database integration checks. See [the recorded exception](validation/user-exceptions.md); this is not E2E acceptance evidence.

**Input**: User description: "My main goal is to reduce the number of times I have to call the ESPN endpoint. When doing this I would need to store some data, so a side thing I would like to store more data to be used in the future."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reuse match information across games (Priority: P1)

As the DONG operator, I want discovery, solo play, and multiplayer rooms to reuse match information, so following the same football matches in more games does not multiply requests to ESPN.

**Why this priority**: Reducing upstream requests is the primary outcome. Richer stored data must support this outcome rather than introduce unnecessary fetching.

**Independent Test**: Follow overlapping and different combinations of matches in many rooms and solo clients, interleave discovery requests, and count provider attempts during the same freshness window. Repeated demand for an already checked match group must reuse its result.

**Acceptance Scenarios**:

1. **Given** 100 active rooms following different combinations of matches covered by the same five league/date scoreboards, **When** all demand updates within one live refresh window, **Then** at most five routine scoreboard attempts occur in the absence of failures, and each room receives the applicable accepted scores.
2. **Given** room A follows matches 1 and 2 and room B follows matches 2 and 3, **When** match 2 changes, **Then** one shared provider match observation supplies both rooms without merging their assignments or gameplay histories.
3. **Given** discovery, solo play, and multiplayer request overlapping information while a shared fetch is underway, **When** that fetch succeeds, **Then** consumers reuse the result and no concurrent duplicate fetch is started for the same request group.
4. **Given** recently checked data, **When** players repeatedly refresh, reconnect, switch screens, or start additional rooms, **Then** those actions do not bypass the shared freshness or request-budget rules.
5. **Given** no tracked matches or only manual matches, **When** gameplay requests updates, **Then** no ESPN request is made, including no ESPN connectivity-probe request.

---

### User Story 2 - Follow active games from kickoff with every app closed (Priority: P1)

As a multiplayer participant, I want active games to continue recording accepted goals and their existing gameplay consequences while everyone has closed the app, and to recover the current state when I return.

**Why this priority**: Provider monitoring must survive the loss of connected participants and must avoid routine score polling before matches can start.

**Independent Test**: Create an active game with a future kickoff, close all participant clients, advance through kickoff and multiple score observations, and reopen a client. Verify no early polling, autonomous recording, and recovery without duplicate consequences.

**Acceptance Scenarios**:

1. **Given** a tracked match with a known future kickoff, **When** all clients close, **Then** recurring score polling makes no requests before that kickoff and begins within the specified scheduling target after it.
2. **Given** an active room and no connected clients, **When** ESPN supplies changed scores after kickoff, **Then** the changes and applicable room consequences are committed without requiring an online host or participant.
3. **Given** several goals were accepted while clients were closed, **When** a participant returns, **Then** the latest authorized room state and recorded history are recovered without awarding those goals again.
4. **Given** the first due check reports a revised future kickoff or a postponed match, **When** monitoring is rescheduled, **Then** normal live polling pauses and follows the documented delayed-match policy.
5. **Given** all tracked matches in a request group have finished, **When** final confirmation has completed and no later tracked match in the group is due, **Then** routine polling stops even if a room remains open.
6. **Given** one interested room ends while another still follows the match, **When** monitoring next runs, **Then** the ended room receives no new gameplay consequences and the remaining active room continues to be updated.

---

### User Story 3 - Bound provider traffic and recover from failures (Priority: P1)

As the operator, I want all provider traffic to obey a shared budget and recover safely from failures, so outages, restarts, and repeated user actions cannot cause uncontrolled requests or lost game state.

**Why this priority**: Reuse alone does not protect ESPN when many different matches are followed, and repeated failures must not undo request savings.

**Independent Test**: Use controlled provider responses to exercise concurrent demand, worker interruption, partial failures, denied requests, rate limits, and exhausted budgets. Verify attempt counts, saved content, and recovery.

**Acceptance Scenarios**:

1. **Given** an operator-defined request budget, **When** combined discovery, routine monitoring, enrichment, and retry demand exceeds it, **Then** attempts stay within the budget and lower-priority work waits; manual refresh cannot override it.
2. **Given** failed or rate-limited provider requests, **When** clients reconnect and monitoring restarts, **Then** the recorded cooldown remains effective and valid saved scores remain available.
3. **Given** a failed league/date fetch alongside healthy ones, **When** results are processed, **Then** healthy matches continue updating while the failed group backs off independently.
4. **Given** a worker stops during a request and a replacement takes over later, **When** the old worker returns, **Then** its obsolete result cannot replace a newer accepted result or create duplicate room consequences.
5. **Given** provider data was saved but processing one room failed, **When** processing resumes, **Then** saved observations are replayed for that room without requiring a new provider request solely for recovery.
6. **Given** a failed refresh, **When** a player views saved content on web or Android, **Then** the content remains visible with an accurate nonblocking stale-data message; room synchronization does not falsely update the last successful provider-check time.

---

### User Story 4 - Retain compact match history and rosters on the Free tier (Priority: P2)

As a player and product owner, I want useful match facts, goals, final statistics, and the squad/participation roster retained alongside reliable history, while staying within the Supabase Free tier.

**Why this priority**: Compact shared data enables useful history and seeing who played, but unused source fields and exhaustive archives do not justify exceeding the user's free allowance or increasing provider traffic.

**Independent Test**: Ingest complete and partial match/goal/roster records under a controlled storage allowance. Verify selected compact facts, correct appearance/unused-substitute distinctions, bounded disposable data, and preserved referenced history without a source archive.

**Acceptance Scenarios**:

1. **Given** a valid provider response containing match identity, teams, kickoff, status, clock, season, venue, and statistics, **When** it is accepted, **Then** the specified compact field set is retained once per individual match, only current/final statistics are kept, and missing optional fields remain unknown rather than becoming false zeros or fabricated values.
2. **Given** a completed tracked match and available completion/detail allowance, **When** one shared detail response supplies goal IDs, roster/participation, clocks, or event timestamps, **Then** selected compact information is associated with the match once for every interested room, without retaining the complete response.
3. **Given** repeated responses with unchanged scores, status, and schedule, **When** only the check time or live display clock advances, **Then** current freshness/display state may change without adding duplicate permanent score events.
4. **Given** ESPN later changes a score, schedule, or identified event, **When** the change is accepted, **Then** the revision and its observation time are preserved while completed-room results are not silently rewritten.
5. **Given** an optional detail request fails or its budget is exhausted, **When** a valid scoreboard result is available, **Then** score processing proceeds and optional fields remain unavailable or pending without a request storm.
6. **Given** an archived match with retained facts and game references, **When** its data is read later, **Then** it remains available without restarting routine polling merely because the facts have been retained.
7. **Given** a final squad includes starters, used substitutes, and unused substitutes, **When** the compact roster is retained, **Then** each player's supplied team, shirt number, position, starter/appearance/substitution information is preserved without falsely labeling every squad member as having played or storing a full player profile.
8. **Given** storage pressure and disposable cache/diagnostics, **When** cleanup runs or further enrichment is considered, **Then** expirable data is reclaimed and optional collection is deferred before referenced roster, accepted gameplay evidence, or existing active-game work is endangered.

---

### Edge Cases

- Kickoff is unknown, marked tentative, changed after registration, moved across a date boundary, or affected by daylight-saving changes. Store absolute times and preserve uncertainty; do not guess a precise kickoff or query unrelated dates to hide missing metadata.
- Kickoff moves earlier without any intervening discovery response: the first monitoring check may occur at the previously known kickoff. Zero recurring pre-kickoff score polling takes precedence; opportunistically learned schedule changes update monitoring.
- A league scoreboard includes untracked future matches while being fetched for a due tracked match. Useful returned metadata may be reused, but it must not initiate live monitoring of untracked matches.
- A match is delayed, suspended, abandoned, canceled, or still scheduled after its expected kickoff; lack of score movement is not proof of completion.
- One league/date contains both completed matches and a later kickoff; polling pauses between due needs after bounded final confirmation.
- A manual match, unsupported league, or legacy match with no league is encountered. No broad sweep across every supported league is allowed as an automatic fallback.
- Several goals happen between checks, a score decreases, a goal is overturned, or a previously returned event disappears from a partial response. Score observations are not assumed to be a complete play-by-play feed.
- A penalty during play, an own goal, extra time, a shootout, and an aggregate score require distinct representations. Existing room scoring rules remain authoritative.
- Duplicate requests, overlapping workers, delayed responses, restart after data persistence, and partial room-processing failure must not duplicate fetches or consequences.
- The global budget is exhausted, missing, or invalid; enrichment and retries must not create unlimited fallback traffic.
- All clients are closed, only guests remain, the host changes, an active room expires, or a game ends while a fetch is underway.
- Optional metadata is absent or changes, provider identifiers differ between resource types, and event IDs are corrected or unavailable. Unknown information must remain distinguishable from a known empty result.
- Independent solo games follow a shared match while keeping player names, assignments, and local history private. Reopening must not reapply already recorded solo score consequences.
- A roster lists unused substitutes or omits appearance/minute details. Squad membership alone is not proof that a player appeared; absent information remains unknown.
- Free-tier capacity is tight even after unused caches and diagnostics are removed. Optional collection must stop and capacity for existing work must be protected; new persistent tracking cannot silently exhaust the allowance or trigger a paid upgrade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST maintain one shared identity and latest accepted record for each real provider match, independent of the arbitrary combinations of matches selected by rooms and solo games. Room-specific state MUST remain distinct.
- **FR-002**: Discovery, solo score updates, and multiplayer score updates in supported, migrated clients MUST reuse shared provider information under a common freshness and request-budget policy. Those clients MUST NOT retain an independent ESPN polling path or connectivity probe. Rollout evidence MUST identify supported builds and residual traffic from older solo builds; server-side fencing does not control those older direct-provider clients.
- **FR-003**: Concurrent demand for the same league/date scoreboard MUST be combined into one upstream attempt at a time. Increasing interested rooms or clients MUST NOT increase routine attempts for already covered request groups within a freshness window.
- **FR-004**: Monitoring for active multiplayer games MUST operate without any connected client, host device, or participant session refresh, and MUST survive processing restarts.
- **FR-005**: Recurring score monitoring MUST NOT issue requests before the earliest known kickoff of a due tracked match. Discovery remains demand-driven and may obtain schedules before kickoff; those responses MUST be reused. Matches already underway when tracking begins are eligible immediately, subject to budgets and existing room baseline rules.
- **FR-006**: Monitoring MUST use known kickoff and accepted provider lifecycle information to select the next check, reschedule changed kickoffs, slow delayed or suspended matches, and stop canceled or completed matches after bounded reconciliation. Match age and an unchanged score alone MUST NOT imply completion.
- **FR-007**: An active match MUST remain monitored while any eligible game needs updates, even with all clients closed. Ending or expiring one game MUST stop new consequences for that game without ending monitoring required by others. With no remaining demand, routine monitoring MUST cease after any already-required bounded final work.
- **FR-008**: Every upstream attempt made by the shared integration, including discovery, retry, and optional enrichment, MUST consume a shared operator-configured budget. The policy MUST bound short-window and daily totals, prioritize active score monitoring over optional enrichment, and prevent supported callers from bypassing limits. Missing or invalid settings MUST prevent unbounded fetching and produce an actionable operator diagnostic. Residual direct-provider calls from unsupported older solo clients are outside that server budget and MUST be reported with known visibility limits, not included in a false all-client guarantee.
- **FR-009**: Requested leagues and dates MUST remain within supported, bounded discovery and tracking policies. Missing league metadata MUST NOT trigger an automatic search across all leagues. Manual matches MUST generate no provider traffic.
- **FR-010**: Failure cooldowns MUST persist across client reconnects and processing restarts. Rate-limit retry instructions MUST be honored when supplied. Access rejection, rate limiting, malformed data, and transient availability failures MUST be distinguishable for recovery. Group-local failures MUST NOT block healthy groups. Provider-wide throttling or integration-wide configuration/access failures MAY pause the provider; the scope and reason MUST be explicit. A single group's access rejection pauses only that group unless the response establishes wider scope. Scope assessment MUST NOT introduce diagnostic provider requests.
- **FR-011**: The system MUST retain the last valid data during refresh failures and distinguish last attempt, last successful provider check, provider event time when supplied, and room synchronization time. Players MUST see stale content with a concise nonblocking explanation when freshness is uncertain.
- **FR-012**: Accepted provider changes MUST pass through the existing authoritative, auditable room-consequence rules exactly once for each eligible room. Existing baselines, assignments, departures, manual adjustments, completion rules, and correction behavior MUST remain intact. Automated changes MUST retain explicit system/provider provenance rather than fabricated participant activity, and monitoring MUST NOT acquire unrelated host-only powers.
- **FR-013**: The system MUST recover from interrupted work, reject obsolete results, and resume incomplete room processing from saved observations without a new provider fetch solely for replay. Saved observations and processing progress MUST identify which version each room has consumed. A command awaiting that processing MUST distinguish committed processing progress from its unperformed requested mutation, preserve command idempotency, and provide a bounded retry outcome rather than false success.
- **FR-014**: Individual match records MUST retain available provider event/competition identity; league and season identity; home/away team identities and display metadata; known kickoff and its validity; raw and normalized status; completion state; current period and numeric/display clock; scores; and optional venue. Resource identifiers MUST NOT be assumed interchangeable solely because sample values match.
- **FR-015**: Available compact goal details MUST preserve event identity/type, credited team where established, involved athlete identities/display names, period/clock, and penalty, own-goal, and shootout distinctions. Provider event IDs and timestamps MUST be retained when supplied, separately from DONG observation time. Participant roles MUST NOT be inferred solely from array position. Card totals may be retained without a permanent rich event history for every card.
- **FR-016**: Supported scalar team statistics already supplied by budget-permitted responses MUST be retained as one current/final set per match/team, within the storage allowance. The selected set includes possession; shots, shots on target and blocked shots; penalty attempts/goals; fouls, corners, offsides, saves and card totals; attempted/completed passes, crosses and long balls; attempted/successful tackles; interceptions and clearances; and supplied percentages with understood meanings. Missing data remains unknown, and source-reported percentages MUST NOT be silently replaced by differently rounded derived values. Intermediate per-poll statistical history, full nested response structures, and dedicated statistic-harvesting requests are excluded. Available compact match rosters MUST retain player identity/name, match team, shirt number, position, starter status, explicit appearance/substitution details, and supplied minutes. Unused substitutes and unknown appearances MUST remain distinguishable from players known to have appeared; career profiles and roster snapshots per poll are excluded.
- **FR-017**: Meaningful accepted score, lifecycle, and schedule changes MUST remain auditable with their source version and observation time. Unchanged responses and ordinary clock updates MUST NOT create duplicate permanent gameplay events. A later provider correction MUST NOT silently rewrite completed-room history; an absent event in a partial response alone MUST NOT prove retraction.
- **FR-018**: Richer match detail MUST be reused when already available. If needed for a tracked match's final roster/goal details, one shared completion-detail attempt and at most one retry MAY occur within the bounded completion allowance, global request budget, and storage allowance. Routine live detail polling is disabled by default. Discard unselected response fields after extracting the compact projection. Enrichment failure or unavailable roster coverage MUST NOT block valid scores or trigger player-by-player/league-wide discovery sweeps.
- **FR-019**: Compact match facts, meaningful accepted evidence, goal details, and rosters referenced by retained multiplayer room history MUST remain available while those server references exist. Solo history MUST preserve compact details already obtained in its private local snapshots under existing local-history ownership/deletion rules. Available saved roster/final-stat details MAY be copied into those snapshots without another provider request; shared details not downloaded before cache expiry are not guaranteed. Solo history MUST NOT create permanent anonymous server-retention pins. Unused discovery and server-unreferenced completed-match caches, operational diagnostics, and optional statistics MUST obey bounded age/size policies. Complete source documents and full source timelines MUST NOT be permanent records. Cleanup MUST NOT break protected server references or restart completed-match polling.
- **FR-020**: Shared provider data MUST NOT expose room membership, account identities, guest credentials, player drafts, assignments, or private history. Existing host/member/guest access rules MUST remain enforced. Monitoring requests from permitted solo/discovery users MUST NOT require a new account solely to obtain shared public match data.
- **FR-021**: Web and Android MUST have equivalent provider freshness, request reuse, and recovery outcomes. Solo player configuration and local history MUST retain their existing ownership and offline-read behavior; sharing real-match facts MUST NOT turn a solo game into a multiplayer room.
- **FR-022**: Operators MUST be able to measure upstream attempts by purpose, request group, outcome, and time window; reused demand; cooldown/budget deferrals; active monitoring; and last successful check. Measurements MUST demonstrate savings without logging credentials or private player content.
- **FR-023**: Existing active and completed games MUST remain readable during adoption. Existing provider identity and kickoff metadata MUST be reused where valid; ambiguous legacy records MUST be reported without broad discovery sweeps or fabricated data. Rollback or forward recovery MUST preserve accepted room history and MUST NOT leave competing authoritative backend fetchers active simultaneously. Supported/migrated client consolidation requires an explicit build/adoption gate; residual direct-provider traffic from older solo clients MUST be reported separately rather than claimed to be server-fenced.
- **FR-024**: Durable provider observations and committed room events MUST retain enough identity and revision information to support future deduplicated notifications. This feature MUST NOT send notifications or claim complete goal-by-goal coverage when only score snapshots are available.
- **FR-025**: The default retained data MUST be the compact field set in FR-014 through FR-016 and the evidence required by FR-012/FR-017, not every field ESPN returns. Commentary, articles/media, odds/predictions, detailed shot coordinates, athlete profiles/career data, unknown speculative fields, and every-poll source/clock/statistics histories MUST be omitted. Optional diagnostic source bodies MUST be disabled by default and bounded by both age and total bytes when enabled.
- **FR-026**: Current match facts, accepted changes, compact goals, roster/appearance records, and retained final statistics MUST support routine queries and replay without fetching ESPN or reading full source documents. The product MUST NOT promise later reconstruction of intentionally omitted fields or complete play-by-play. Repeated rooms MUST reuse the same roster and provider facts.
- **FR-027**: Operators MUST measure provider data/index bytes, whole-project usage, cache/diagnostic volume, and growth of protected referenced data. Storage sizing MUST distinguish actual persisted measurements from illustrative record sizes and include indexes/maintenance overhead. Expirable data MUST be reclaimed before deferring further optional enrichment, without silently deleting referenced roster or gameplay evidence.
- **FR-028**: The delivery MUST remain within the user's Supabase Free plan without requiring paid storage, a paid database, or automatic upgrades. The operating plan MUST reserve capacity for existing active-game recording, accounts, and history, and account for non-storage allowances. If protected growth cannot fit safely, the system MUST surface an operator-visible capacity condition and prevent additional persistent tracking that would consume the required reserve rather than silently losing accepted goals or deleting existing history.

### Key Entities *(include if feature involves data)*

- **Shared Provider Match**: One real football match, its provider/competition/team identities, schedule, lifecycle, latest scores, useful metadata/statistics, and provenance. Many games may reference it.
- **Provider Match Observation**: An accepted meaningful score, schedule, or lifecycle version with when it was observed, optional provider occurrence time, and revision relationships.
- **Provider Match Event**: An available compact goal occurrence, its identity/type, team, participants, clocks, optional occurrence time, and corrections needed for retained gameplay. Missing event identity does not justify invented certainty.
- **Game Match Reference**: A game's relationship to a shared real match, tracking lifetime, existing scoring baseline, and last processed observation. It does not merge private game state with public match facts.
- **Provider Fetch Coordination**: The league/date group whose transport can serve multiple individual matches, next eligible attempt, temporary ownership, and persistent failure cooldown. A group is not a room-specific scoreboard permutation.
- **Provider Request Budget**: Shared limits and consumption across all request purposes, with priority and deferral decisions.
- **Provider Request Diagnostic**: A bounded operational record supporting request counts and recovery without retaining private player content.
- **Match Roster and Participation**: Compact per-match squad membership and supplied appearance facts, referencing shared player identity/name and match team, with shirt number, position, starter/substitution information and optional supplied minutes. The roster is shared across rooms; membership does not imply appearance.

### Platform, Access, and Shared-State Impact

- Web and Android consume the same accepted provider facts and must recover consistently. No new navigation, statistical screen, or required UI flow is introduced; existing freshness/error presentation may need a small correction.
- Host authentication, registered membership, guest grants, and room access remain governed by existing rules. Background processing must be authorized for score ingestion without impersonating an online player or granting guests additional write access.
- Room consequences and history remain authoritative outside clients. Shared provider facts are reusable across games, while solo configuration/history retain local ownership.

### Migration, Backfill, and Recovery Impact

- New durable shared records and their access boundaries require a reviewed, non-destructive data transition. Completed history must remain readable before, during, and after rollout.
- Link existing game matches using validated provider identities, leagues, and kickoff times. Report incomplete or conflicting legacy links; do not scan every league to reconstruct them.
- Historical enrichment beyond data already held is outside this feature. Any later backfill must declare its scope and request budget separately.
- Rollout and recovery must fence old fetchers before enabling replacements, preserve existing idempotency and correction rules, and explain how unfinished processing resumes without replaying consequences.

### Required Verification

- Unit coverage is required for all new behavior: freshness decisions, due-at-kickoff logic, grouping, compact metadata/roster normalization, optional-field uncertainty, lifecycle transitions, budgets, cooldowns, obsolete work, replay without raw archives, enrichment gating, retention, and capacity-pressure handling.
- Persistence and access-boundary coverage must verify concurrent claims, saved-state recovery, uniqueness, history integrity, and registered/guest/unauthenticated isolation where applicable.
- A controlled multi-consumer verification must measure requests across discovery, solo, and overlapping rooms, including simultaneous cold demand and repeated reconnects. Routine automated checks must use controlled provider responses rather than call ESPN repeatedly.
- A closed-client multiplayer verification must cover kickoff, autonomous score recording, interrupted processing, and re-entry. Web evidence must not be presented as proof of Android background or device behavior.
- If implementation materially changes a primary UI journey, navigation, or cross-screen interaction, add journey-level automated coverage for that change. Otherwise focused synchronization/recovery coverage is required without inventing a new UI flow.
- Release evidence must record request savings, freshness under healthy conditions, budget compliance under failure/load, retention behavior, and recovery limits. A small explicitly bounded live provider sample may supplement controlled checks; it cannot establish all-league coverage or a provider-approved quota.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the controlled workload of 100 rooms following arbitrary subsets covered by five identical league/date scoreboards, routine upstream attempts within one configured live refresh window are at most five with no failures or enrichment, a reduction of at least 99% against 500 independent room/group attempts.
- **SC-002**: Adding 100 solo/discovery consumers of those same fresh request groups adds zero upstream attempts within that freshness window; simultaneous cold demand starts at most one in-flight attempt per group.
- **SC-003**: A tracked future match causes zero recurring score requests before its last known kickoff. Under healthy scheduling/provider conditions and available budget, the first check starts within 90 seconds after kickoff, and at least 95% of provider-visible score changes are recorded within 90 seconds of becoming available.
- **SC-004**: In a controlled game with every client closed from before kickoff through completion, all supplied valid score observations are processed for eligible rooms; reopening and replaying interrupted work produces zero duplicate consequences and zero lost accepted observations.
- **SC-005**: Across normal, concurrent, failing, restarted, and manual-refresh workloads, total attempts never exceed the configured short-window or daily budget, and no attempts occur during an applicable provider-directed cooldown.
- **SC-006**: Every selected compact field supplied by representative complete responses is retained with correct identity/context; representative missing optional fields remain unknown. Repeated unchanged observations produce zero duplicate permanent score events, and all retained completed-game outcomes remain unchanged after provider corrections unless explicitly corrected through existing rules.
- **SC-007**: A player returning on web or Android sees the latest authorized saved game within five seconds after a successful application connection under the controlled acceptance environment. When refresh fails, saved content remains visible and its last successful provider-check time is not falsely advanced.
- **SC-008**: Operators can produce a 24-hour report of attempts, reuse, failures, and deferrals by purpose and request group. After final reconciliation or loss of all eligible demand, the next scheduled monitoring pass issues zero routine requests for the inactive group.
- **SC-009**: In the controlled retention workload, all supplied selected match/goal/roster fields remain queryable while referenced by retained multiplayer history, and downloaded solo detail snapshots remain available locally under existing history rules, with zero unused substitutes falsely classified as having appeared. Expiry of a solo-only shared cache MUST NOT erase captured local details; uncaptured expired detail is explicitly unavailable. Repeated updates generate zero permanent full-response copies and zero per-poll roster/statistic history. Routine queries and replay require no new provider calls or source archive.
- **SC-010**: In a workload exceeding the configured storage allowance, expirable cache/diagnostic bytes remain bounded, optional enrichment is deferred, and existing referenced history/rosters remain intact. Capacity pressure is reported before the required operating reserve is consumed; no paid upgrade or unbounded archive is required. Actual table/index size and whole-project usage are included in release evidence.

## Assumptions

- **Primary and secondary scope**: Reduced ESPN traffic is the release driver. Retaining useful individual match facts, statistics, and event details is secondary and may not create unrestricted enrichment traffic.
- **Hybrid behavior**: Discovery obtains schedules on demand; autonomous monitoring follows tracked matches from known kickoff. No recurring pre-kickoff score polling is permitted. Opportunistic discovery or another due match's shared response may update a future fixture without dedicated early polling.
- **Freshness defaults**: The initial normal live refresh interval is 60 seconds. Delayed/suspended checks use a slower, capped schedule. Dedicated completion confirmation/roster enrichment may cause at most two additional attempts per completed match within 24 hours of observed completion, combined across rooms; failures do not reset that allowance. One completion summary may provide both final facts and the roster. Exact delays and global budgets are operator configuration established before activation, not claimed ESPN allowances.
- **Monitoring lifetime**: Multiplayer games remain eligible until ended, completed, expired, or otherwise invalid under existing lifecycle rules, irrespective of client presence. Solo monitoring reuses shared public match facts until tracking is ended or matches finish; private solo drafts and consequences need not be uploaded for this purpose.
- **Retention defaults**: Compact facts, accepted gameplay evidence, goals and rosters remain while referenced by retained multiplayer room history. Solo games keep downloaded compact details in private local history snapshots; any additional shared details remain cache-only until downloaded and may be unavailable after expiry. No permanent anonymous history pins are introduced. Unused discovery fixtures expire after 24 hours without relevant demand and server-unreferenced completed match caches after 30 days, subject to earlier size-based eviction. Optional debug capture is off by default, or capped at 24 hours/5 MB when enabled. Detailed operational diagnostics are short-lived/capped; daily aggregate usage is retained for 90 days. Current clocks and intermediate statistics replace earlier values. Unbounded permanent growth is not promised within a fixed free allowance.
- **Free-tier capacity**: Remaining on Supabase Free is a hard user constraint. Initially target at most 100 MB for the shared provider feature including indexes and disposable data, preserving headroom for other application data and existing active games. This is a proposed measurable capacity allowance, not a verified record-count capacity. Growth requires explicit retention/export or activity limits before protected data exhausts remaining capacity; referenced rosters/history are not silently discarded.
- **Corrections and roles**: Existing gameplay rules determine score consequences. Provider detail is supporting evidence; unknown scorer/assister roles, goal retractions, timestamps, and period-score meanings remain unknown until reliably established.
- **Compatibility**: Continue using currently verified provider capabilities. Controlled acceptance uses supported, migrated client builds and the shared integration; identify known residual older-solo traffic and any inability to quantify it separately. Neither backend fencing nor the shared budget controls old direct-provider device code. Switching API families or adopting an unverified v3 replacement is excluded; observed richer fields do not require that migration.
- **Future work excluded**: Notification permission/delivery, new history/statistics screens, complete commentary/play-by-play or raw-response archives, media/odds harvesting, media-file downloads, athlete career profiles, historical league-wide backfills, and a new provider contract are not deliverables. Compact match rosters are explicitly included. Fields outside the selected compact projection may be discarded even when supplied, accepting that they may be unavailable for future reconstruction.
- **Dependencies**: Reuse existing discovery, game lifecycle, room history, assignment, and identity contracts. The plan must justify the ownership of shared ingestion and scheduling within existing project constraints; this specification does not select table layouts, server frameworks, or additional infrastructure.
- **Research boundary**: Field candidates and v3 limitations are recorded in [the ESPN research report](../../exa-results/espn-provider-data-2026-10-25/report.md). Successful sample responses do not guarantee availability across every league, exact event completeness, stable IDs through corrections, or an official request quota.
- **Storage investigation**: [The free-tier storage policy](free-tier-storage.md) is the current design recommendation. [The earlier storage investigation](storage-design.md) preserves sizing evidence and the superseded full-archive alternative; its archive tables and unlimited source preservation are no longer requirements. Neither document constitutes an implemented schema.
- **Architecture and refactor scope**: [The Match Catalog architecture proposal](architecture.md) compares module interfaces and implementation ownership for planning. The user authorizes replacing or removing obsolete fetching/parsing/cache code that conflicts with the feature, while preserving gameplay, access rules, existing identities and unrelated work. A new design must consolidate policy rather than leave independent legacy fetchers active; temporary compatibility adapters need explicit removal conditions.
