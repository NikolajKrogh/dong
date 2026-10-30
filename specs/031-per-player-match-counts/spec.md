# Feature Specification: Per-Player Match Counts

**Feature Branch**: `191-per-player-match-counts`

**Created**: 2026-10-30

**Status**: Draft — validated and ready for planning

**Input**: Allow players to have different numbers of matches because some want to drink less, including when using automatic assignment.

**Additional requirement**: Match times must always use 24-hour `HH:mm` format, from `00:00` through `23:59`, never AM/PM.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Give a player fewer matches (Priority: P1)

The local organizer or multiplayer host sets a group default and optionally changes individual players' additional-match counts.

**Why this priority**: Enables lower participation without reducing everyone's count.

**Independent Test**: Configure three players for 3, 3, and 1 additional matches and start with those exact counts plus the Common Match.

**Acceptance Scenarios**:

1. **Given** a default of 3, **When** the organizer sets one player's count to 1, **Then** others retain 3 and that player receives 1 additional match plus the Common Match.
2. **Given** an individual override of 1, **When** the default changes to 4, **Then** the override stays 1 and players following the default use 4.
3. **Given** an override, **When** the organizer restores the group default for that player, **Then** the player follows the current default and subsequent default changes.
4. **Given** a zero target, **When** play starts, **Then** the player participates with only the Common Match.
5. **Given** saved unequal targets, **When** a local game reopens or a room participant reconnects, **Then** the same players retain their targets and settled assignments.
6. **Given** a new-policy local or hosted game with every target set to zero and a stored positive sharing preference, **When** assignments are prepared, **Then** everyone receives only the Common Match, no sharing minimum or consent applies, and the stored preference remains available when targets later become positive.

### User Story 2 - Automatically assign unequal counts (Priority: P1)

The organizer uses random assignment while preserving each player's chosen count and understanding any conflict with sharing settings.

**Why this priority**: Automatic assignment must not undo a player's lower participation.

**Independent Test**: Generate for unequal targets and verify exact counts; confirm a low target does not disable sharing between other players.

**Acceptance Scenarios**:

1. **Given** targets 3/3/1, no additional sharing, and at least 7 additional pool matches, **When** assignment runs, **Then** players receive exactly 3/3/1 distinct additional matches with no overlap.
2. **Given** a target larger than the distinct additional pool, **When** generation or start is attempted, **Then** the organizer sees the impossible target and nothing is partially saved.
3. **Given** targets 3/3/1, a preference of 2 shared additional matches per pair, and a sufficient selected pool, **When** assignment runs, **Then** the two players with targets of 3 share 2 additional matches, sharing involving the player with target 1 is allowed to fall below 2, and all targets remain exactly 3/3/1.
4. **Given** a successful shared start, **When** the same start request is retried, **Then** the original assignments are returned without rerandomizing or duplicating the start.
5. **Given** unequal targets for which the optimizer finds a zero-deviation arrangement within its execution budget, **When** assignment runs, **Then** every pair receives the preferred overlap and all individual targets are honored.
6. **Given** unequal targets and a pool sufficient for each individual target but insufficient for the preferred overlap, **When** assignments are previewed, **Then** the actual sharing and any deviation are shown and the game can start without changing targets or requiring a sharing-relaxation override.
7. **Given** the hosted optimizer reaches its time or model-size limit, **When** a valid assignment is available, **Then** the preview retains exact individual counts and labels sharing as best effort, without claiming optimality or reporting the targets as infeasible. Offline local games use a portable fallback with the same exact-count guarantees.
8. **Given** positive equal targets whose counts fit the pool but strict sharing does not, **When** a relaxed preview is prepared, **Then** its actual assignments and sharing policy are fixed, and start/save requires explicit acceptance of relaxed sharing for that exact preview; declining leaves the game unchanged.
9. **Given** overlapping requests for different previews, **When** an older computation completes after a newer request has been admitted, **Then** the old result cannot replace or invalidate the newer preview; identical pending requests do not start additional computations.

### User Story 3 - Honor counts in host allocations and player picks (Priority: P2)

Hosts allocate and participants pick against each player's own target. Start-time filling completes only that individual's shortfall.

**Why this priority**: Lower participation must work across all existing assignment modes.

**Independent Test**: With targets 3 and 1, make partial selections in both modes and verify exact final counts and retention of valid selections.

**Acceptance Scenarios**:

1. **Given** a participant with target 1 and one pick, **When** they pick another match, **Then** it is refused until the first is released; others' targets are unaffected.
2. **Given** incomplete host allocations or participant picks, **When** the host starts, **Then** valid selections remain and each player is filled only to their own target.
3. **Given** three draft selections, **When** the host tries lowering that player's target to 1, **Then** saving is refused until two selections are explicitly released; none are silently removed.
4. **Given** individual overrides, **When** the assignment mode changes, **Then** overrides persist and feasibility is recalculated; existing confirmation before discarding selections still applies.

### User Story 4 - Change future participation during play (Priority: P2)

The organizer adjusts individual counts through the existing running-game editor without rewriting recorded scores or drinks.

**Why this priority**: Players may want to reduce participation after starting.

**Independent Test**: Record gameplay, lower a target and corresponding assignments in the editor, save, and verify future assignments change while recorded gameplay remains intact.

**Acceptance Scenarios**:

1. **Given** a running game, **When** an authorized organizer saves valid targets and assignments, **Then** future assignment-dependent gameplay uses the new assignments and existing scores and drinks stay unchanged.
2. **Given** a stale shared configuration draft, **When** it is saved, **Then** it is rejected, the draft is retained for review, and newer shared state stays intact.
3. **Given** an assignment change, **When** history is viewed, **Then** actual participation and recorded gameplay remain explainable without claiming everyone had the same count.

### User Story 5 - Read match times consistently (Priority: P2)

Players see match times in the same unambiguous 24-hour format everywhere in the app, regardless of language or device clock preferences.

**Why this priority**: Prevents inconsistent kickoff displays and confusion between morning and evening matches.

**Independent Test**: Review match times across discovery, setup, lobby, assignments, running-game editing, gameplay details, and history on Android and web with a device or browser configured for a 12-hour clock.

**Acceptance Scenarios**:

1. **Given** a match time of 9:05 in the morning in the display timezone, **When** shown on any match surface, **Then** its time reads `09:05`, without AM/PM.
2. **Given** match times at midnight, noon, and 11:59 in the evening in the display timezone, **When** displayed, **Then** they read `00:00`, `12:00`, and `23:59` respectively.
3. **Given** a device or browser using a 12-hour clock, **When** viewing match times on Android or web, **Then** the app still uses `HH:mm` with two-digit hours and minutes.
4. **Given** a match with an unknown kickoff time, **When** displayed, **Then** the existing unknown-time indication remains rather than showing a fabricated `00:00`.

### Edge Cases

- One player: their own target applies; pair sharing has no effect.
- All targets zero under the new policy: Common Match only even with a stored positive sharing preference; no sharing minimum or consent applies. Existing non-sharing start requirements still apply, and legacy-policy behavior remains unchanged.
- Invalid negative, fractional, non-numeric, or excessive counts: reject without changing saved settings and explain the allowed range.
- Duplicate selections count once per player; assignments cannot come from outside the selected pool.
- Duplicate names or renamed players do not move individual settings between identities.
- Lobby joins use the default; departures remove that player from feasibility without increasing remaining targets.
- Pool or Common Match changes recalculate validity and retain existing selection-loss confirmation behavior.
- Zero target with positive sharing receives no additional matches and does not disable preferred sharing between other players.
- A zero-sharing preference produces disjoint additional sets when the pool permits; if the pool forces overlap, the preview explains the deviation without increasing targets.
- Failed writes, concurrent roster changes, and retries leave no partial assignments or duplicate starts.
- Legacy games retain their existing assignments and historical totals.
- Midnight must display as `00:00`, never `24:00`; timezone conversion and date rollover must retain the correct displayed date and instant.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Local games and multiplayer rooms MUST support a group default additional-match count and optional overrides associated with stable player identities.
- **FR-002**: A player's resolved target MUST be their override when present, otherwise the default. Default changes MUST preserve overrides. Organizers MUST be able to clear an override.
- **FR-003**: Targets MUST be whole numbers from zero through the supported game limit. Zero means Common Match only. The Common Match MUST remain separate from additional counts and assigned to everyone.
- **FR-004**: Setup, previews, pick progress, running editing, gameplay summaries, and history MUST display individual counts wherever an equal group count would misrepresent participation.
- **FR-005**: Successful generation, start, or configuration save MUST produce exactly each player's target of distinct additional matches from the selected pool. No sharing policy or relaxation may raise that target.
- **FR-006**: Automatic assignment MUST support unequal targets and varied arrangements across separate games without silently raising targets to meet a sharing minimum.
- **FR-007**: Feasibility MUST consider the current active roster, resolved targets, mode, pool, and Common Match. Impossible distinct-match targets MUST prevent generation or start with an actionable explanation and no partial writes.
- **FR-008**: When resolved targets differ, automatic mode MUST treat the shared-matches-per-pair setting as a preference and individual targets as mandatory. Hosted games MUST optimize sharing within a budget covering the entire assignment operation, use a validated best-known assignment or exact-count fallback if optimization cannot finish, and distinguish a proven optimal result from best effort. No global optimality guarantee is required after a timeout or fallback. A lower target MUST NOT disable sharing between other players: with targets 3/3/1 and preference 2, the two players with 3 MUST share 2 additional matches when the pool permits. The preview MUST show actual sharing and deviations before start; if complete aggregate assessment exceeds its own budget, it MUST label the summary incomplete and expose actual pair overlap on demand rather than claim no deviation. Unequal targets need no explicit sharing-relaxation override. Positive equal targets retain strict sharing with explicit acceptance of a particular immutable relaxed preview when the pool is short. New-policy all-zero targets are Common-Match-only regardless of stored sharing preference, without consent or a sharing minimum. The Common Match is excluded from overlap counts. Offline local games MUST honor exact counts with a portable sharing fallback.
- **FR-009**: Host allocations and player picks MUST use individual caps. Start-time filling MUST preserve valid selections and fill only individual shortfalls. Exact sharing MUST remain inapplicable to those two modes.
- **FR-010**: A lobby reduction below existing draft selections MUST require surplus selections to be explicitly released first. Mode changes MUST preserve targets and recalculate feasibility.
- **FR-011**: Existing running-game editing MUST accept individual targets, validate the whole proposed configuration before saving, preserve past scores and drinks, and retain an auditable record of assignment changes.
- **FR-012**: Multiplayer target editing MUST remain host-controlled. Members and guests MUST see targets and progress but MUST NOT gain permission to edit targets or another player's picks.
- **FR-013**: Shared writes MUST be atomic, retry-safe, and checked against current configuration. Concurrent joins, departures, edits, or starts MUST NOT cause partial state or silently overwrite newer settings. A preview request MUST be admitted before computation and a superseded result MUST NOT replace a newer preview. Relaxed-sharing consent MUST be bound to the exact proposal and commit identity, never supplied as a policy change after review. Accepted retries MUST preserve their original request identity.
- **FR-014**: Targets and settled assignments MUST survive supported persistence, reconnects, host handover, and completion. History MUST preserve actual participation rather than infer equal counts from a default.
- **FR-015**: Existing games without individual settings MUST retain their existing behavior and assignments; adopting the feature MUST NOT rerandomize games or rewrite past gameplay.
- **FR-016**: Text MUST describe participation counts without promising that fewer matches guarantees a particular reduction in drinks.
- **FR-017**: Every user-facing match time MUST use 24-hour `HH:mm` format with two-digit hours (`00`–`23`) and minutes (`00`–`59`), without AM/PM, regardless of locale or device/browser clock preference. This applies throughout discovery, setup, lobby, assignments, running-game editing, gameplay details, and history on Android and web, including times within date-and-time labels. Existing timezone selection, date context, and unknown-time handling MUST be preserved; formatting MUST NOT change the underlying kickoff instant.

### Key Entities

- **Group default**: Additional-match target used without an override.
- **Individual target**: Optional game-scoped count belonging to one player's stable identity.
- **Assignment configuration**: Roster, targets, mode, pool, Common Match, and sharing rule evaluated together.
- **Settled assignment**: Accepted distinct match set, with changes recorded to explain past gameplay.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All successful starts and configuration saves in acceptance testing produce exactly each player's resolved target.
- **SC-002**: Starting at assignment settings with three participants and a sufficient pool already selected, an organizer can lower one player's count and see the saved individual totals within 60 seconds. This includes normal settings-save/refresh time, but excludes account creation, match discovery and optional automatic-preview computation.
- **SC-003**: The 3/3/1 journey succeeds across all three multiplayer modes with sufficient matches and compatible sharing, including a guest participant.
- **SC-004**: Every rejection, cancellation, stale edit, and retry covered by acceptance testing preserves recorded gameplay and creates no duplicate start or partial assignment change.
- **SC-005**: Reopening local games and reconnecting shared participants preserves targets and assignments. For connected foreground clients, accepted shared state appears on the next successful refresh: the current scheduling baseline is 4 seconds for host/registered-member views and 1 second for guest views, plus the refresh request's network time. Offline/background clients resume this behavior after reconnect/foregrounding; no offline convergence deadline is implied.
- **SC-006**: Every legacy-game fixture retains existing assignments and historical totals after the feature becomes available.
- **SC-007**: Every acceptance run of the 3/3/1 configuration with preference 2 and sufficient pool gives the two players with target 3 exactly 2 shared additional matches, without increasing the third player's count.
- **SC-008**: All inventoried match-time displays on Android and web show `00:00`, `09:05`, `12:00`, and `23:59` correctly in acceptance testing under both 12-hour and 24-hour device/browser preferences, with no AM/PM or `24:00` output.

## Assumptions

- The local organizer and multiplayer host control counts. Participant self-service target editing is outside the first version.
- Targets belong to the game, not an account-wide preference.
- Zero additional matches is supported; opting out of the Common Match is outside scope.
- Existing game count limits and match eligibility continue to apply.
- Expected-goal balancing, drink multipliers, and normalized rankings are outside scope. Unequal counts change exposure, not guaranteed drink totals.
- Sharing is a preference when resolved targets differ. Positive equal targets retain exact-sharing behavior. New-policy all-zero targets are an explicit Common-Match-only exception. The mode and preview must make that distinction clear.
- The user selected stronger hosted optimization with a separate offline fallback on 2026-10-30, after reviewing solver trials and time-limit behavior. This replaces the earlier unbounded promise to find every mathematically possible perfect arrangement.
- The 24-hour requirement applies to match times throughout the app; changing timezone policy or formatting unrelated timestamps is outside scope.

## Dependencies and Existing Specification Relationship

- Builds on [canonical assignment](../020-canonical-assignment-generation/spec.md), [host assignment](../021-host-assigned-mode/spec.md), [player picks](../022-player-picked-mode/spec.md), and existing running-game editing.
- For configurations using individual targets, this feature replaces 020 FR-003's single equal count and FR-009/FR-010's automatic target raising. For unequal resolved targets, FR-008 also replaces exact-sharing and explicit-relaxation requirements with a sharing preference and a preview of actual overlap. Other identity, assignment, and history safeguards continue to apply.
- Requires stable player identities, selected pools, and existing configuration permissions; no new identity flow is introduced.

## Platform, Auth, Shared-State, and Migration Impact

- **Platforms**: Equivalent Android and web behavior using existing setup, lobby, selection, and editor patterns, with touch, keyboard, and screen-reader support and player-specific labels.
- **Auth and guests**: Retain host editing authority and participant-owned picks; guest pick limits use their own targets.
- **Shared state**: Host, members, and guests see the same accepted targets and assignments. Local games retain device-owned state.
- **Migration and recovery**: Preserve legacy defaults and assignments without inventing historical targets. Preserve actual historical assignment counts. Planning must define persistence evolution and safe rollback or recovery for already-saved unequal configurations.
- **Required coverage**: Unit coverage for target resolution, bounds, modes, zero counts, and compatibility; shared-state and database integrity coverage for permissions, atomicity, retries, conflicts, and persisted changes; end-to-end coverage for local setup, a host/member/guest room, and running edits on affected platforms. Verify actual UI interactions through ARTEMIS before authoring executable UI tests, as required by repository instructions.
- **Match-time coverage**: Verify formatting boundaries, leading zeroes, unknown times, and date rollover, and check inventoried match surfaces under a 12-hour locale/device preference on Android and web. No stored kickoff-time migration is required by this display-format requirement.

### User-authorized validation exception — 2026-10-30

For this implementation run the user requested unit tests instead of E2E tests and explicitly excluded Android-device testing for now. Do not run Android/ARTEMIS exploration or author/run E2E journeys as a prerequisite to unit testing. Retain client/domain/component unit tests, database unit tests for shared-state integrity, type/lint checks and the non-UI HiGHS runtime gate. Device, visual, E2E and real-backend browser journeys remain deferred coverage, not passed checks. Android/web behavior requirements remain in scope.

## Research Informing the Decision

- [Ticket to Ride Europe official rules](https://cdn.svc.asmodee.net/production-daysofwonder/uploads/2026/09/DO7202N_TICKET2RIDE_EUROPE_RULES_EN_20260512_compressed.pdf): Players receive random destination tickets and may keep different numbers. This is a precedent for random selection with variable commitment, not DONG's exact sharing mechanism.
- [Social Golfer documentation](https://socialgolfer.online/): Attendance and other constraints may prevent zero-repeat pairings; optimization then aims to reduce repeats. This illustrates pairing quality as a preference when constraints prevent perfection.
- **Decision confirmed 2026-10-30**: The user selected sharing as a preference. Chosen counts are mandatory, while sharing should still be achieved between players whose counts permit it. The external examples inform the discussion rather than establish a standard for drinking games.
