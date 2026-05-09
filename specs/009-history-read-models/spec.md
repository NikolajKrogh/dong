# Feature Specification: History, Comparison, and Leaderboard Read Models

**Feature Branch**: `126-us23-create-read-models-for-history-comparisons-and-leaderboards`  
**Created**: 2026-05-09  
**Status**: Draft  
**Input**: User description: "Plan implementation for issue #126 '[US2.3] Create read models for history, comparisons, and leaderboards' using epic #115 and the existing multiplayer schema context."

## Clarifications

### Session 2026-05-09

- Q: What leaderboard metric should v1 use? → A: Rank registered users by total drinks consumed in completed sessions.
- Q: How should leaderboard ties be broken? → A: Break ties by higher average drinks per game, then registered account ID ascending.
- Q: Should comparison reads support guests or only registered users? → A: Support both registered users and guest session participants, with guest results scoped to the session snapshot.
- Q: When a comparison includes a guest, what scope should it use? → A: Guest-vs-registered comparisons are only allowed when both participants appear in the same completed session snapshot.
- Q: Should registered-user comparisons require shared sessions? → A: Registered-user comparisons may cover any two registered users across completed sessions; if they have no shared sessions, shared-session metrics are zero and the timeline is empty.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Completed History Loads Without Local Recalculation (Priority: P1)

As a player opening History, I can load completed session summaries, so the Games tab and details view show consistent results without recomputing session totals on the client.

**Why this priority**: History summaries are the primary consumer of the derived data and are needed before the client can stop recalculating session aggregates locally.

**Independent Test**: Load a representative set of completed sessions and confirm the returned summary data is sufficient to render the Games tab and details view without any extra aggregation step in the client.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** completed multiplayer sessions exist, **When** the history summary data is requested, **Then** the response includes the completed session identity, participants, matches, common match selection, completion timing, and summary totals needed by the history screen.
2. **Given** a completed session with guest and registered participants, **When** the session summary is requested, **Then** the response includes the guest participants only for that session and preserves the registered participant identities for durable references.
3. **Given** the same completed session data is requested repeatedly, **When** the client reloads the summary, **Then** the returned shape and ordering remain stable for the same underlying dataset.

---

### User Story 2 - Lifetime Stats Stay Keyed To Registered Identity (Priority: P1)

As a signed-in player, I can load my lifetime totals across completed sessions, so the Players and Stats tabs show one durable record per registered account.

**Why this priority**: Lifetime totals are the second major consumer of the derived data and are the basis for the visible player stats experience.

**Independent Test**: Query multiple completed sessions and confirm registered users aggregate to one lifetime row each, with no guest rows in permanent rankings.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** completed sessions with repeated participation by the same registered account, **When** lifetime stats are requested, **Then** the same account is aggregated into one durable stats record.
2. **Given** a user with no completed sessions, **When** lifetime stats are requested, **Then** the response is empty or zeroed rather than failing.
3. **Given** guest participants appear in completed sessions, **When** lifetime stats are requested, **Then** the guest identities are not promoted into durable lifetime rows.

---

### User Story 3 - Player Comparisons Are Stable And Session-Safe (Priority: P2)

As a player comparing two users, I can load head-to-head comparison data, with registered users compared across completed sessions and guest participants kept session-scoped, so the client can render the comparison view without calculating the metrics locally.

**Why this priority**: Comparison data is more specialized than history and lifetime stats, but it still needs a stable contract so the current client comparison logic can move off local aggregation.

**Independent Test**: Request comparison data for two selected participants and confirm the response covers the metrics currently shown in the comparison modal.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** two registered users with shared completed sessions, **When** a comparison is requested, **Then** the response includes shared-session counts, wins and ties, per-player totals, averages, peak single-session totals, per-match efficiency, top-drinker frequency, and trend data needed by the comparison view.
2. **Given** a registered user and a guest participant from the same completed session, **When** a comparison is requested, **Then** the response includes the same comparison metrics for that session snapshot while keeping the guest scoped to that session.
3. **Given** two registered users with no shared completed sessions, **When** a comparison is requested, **Then** the response returns zero shared-session metrics, an empty timeline, and the per-player totals for each user.
4. **Given** the same pair and dataset, **When** the comparison is requested again, **Then** the results are deterministic and use the same identity keys.
5. **Given** a guest participant appears only in session history, **When** comparison data is built, **Then** the guest remains session-scoped and is not treated as a durable ranked identity.
6. **Given** a guest participant and a registered user do not appear together in the same completed session snapshot, **When** a comparison is requested, **Then** the system rejects the comparison rather than inventing cross-session guest identity.

---

### User Story 4 - Leaderboards Rank Registered Users Only (Priority: P2)

As a player viewing leaderboards, I can see ranked registered users by total drinks consumed in completed sessions with a deterministic tie-break, so permanent rankings stay consistent and do not mix in session-scoped guests.

**Why this priority**: Leaderboards need durable identities and stable ordering, while guests should remain tied to the session where they appeared.

**Independent Test**: Request a leaderboard from completed-session data and verify that only registered accounts are present, ordered by total drinks consumed, then average drinks per game, then account ID.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a dataset with registered users and guest participants, **When** the leaderboard is requested, **Then** only registered accounts appear in the ranking and they are ordered by total drinks consumed, then average drinks per game, then account ID.
2. **Given** tied ranking values, **When** the leaderboard is requested repeatedly, **Then** the ordering is deterministic for the same dataset.
3. **Given** a user has no completed sessions, **When** the leaderboard is requested, **Then** that user does not appear as a ranked entry.

---

### Edge Cases

- A completed session has no guest participants.
- A completed session has no registered participants.
- Two different registered accounts share the same display name.
- A session includes zero or incomplete matches, so summary fields must still be well-defined.
- A comparison is requested for players who never appeared in the same session; the response should still be stable and should not invent session-scoped overlap.
- The same dataset is queried after new unrelated completed sessions are added; each read model must continue to return the same result for the same underlying scope.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: Native and web clients should use the same derived data contract; the read models themselves are platform-neutral.
- **Shared State Model**: The shared multiplayer data store remains the canonical source of truth for completed-session history and all derived lifetime or ranking outputs. The client should stop recalculating these aggregates locally once the read models are consumed.
- **Identity Model**: Durable lifetime stats and leaderboards are keyed by registered account identity. Guest participants remain session-scoped and only appear in per-session history summaries.
- **Migration / Backfill**: Existing completed session data is the source of truth for the new read models. No separate data migration or identity backfill is expected in this story.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Add database-level tests that validate history summaries, lifetime stats, comparison results, leaderboard ordering, stable result shapes, and guest exclusion from durable rankings.
- **E2E Test Coverage**: No new end-to-end flow is required for this story unless the client integration is included in the same change set. The primary validation remains at the read-model and query-contract level.
- **Applicable Skills**: supabase, supabase-postgres-best-practices, database-design-expert, database-testing

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a stable history summary for completed sessions that includes the data needed to render session lists and details without client-side aggregation.
- **FR-002**: The system MUST key history summaries for registered participants to durable account identity where appropriate, while preserving guest participants only as session-scoped records.
- **FR-003**: The system MUST provide lifetime statistics for registered users across completed sessions using one durable record per account.
- **FR-004**: The system MUST provide a comparison read model for any two registered users across completed sessions, and for guest session participants only when both participants appear in the same completed session snapshot, that includes the metrics needed for head-to-head and influence views without requiring the client to recompute them, and returns zero shared-session metrics plus an empty timeline when the compared registered users have no shared completed sessions.
- **FR-005**: The system MUST provide a leaderboard read model for registered users that ranks by total drinks consumed in completed sessions, breaks ties by higher average drinks per game and then account ID ascending, supports stable ranking, and excludes guest identities from permanent rankings.
- **FR-006**: The system MUST return empty or zeroed results, rather than errors, when a user has no completed-session history or when a leaderboard scope has no ranked participants.
- **FR-007**: The system MUST keep guest participants session-scoped in derived reads and MUST NOT promote them into durable lifetime or leaderboard identities in v1.
- **FR-008**: The system MUST return the same read-model shape and ordering for the same underlying dataset and query scope.
- **FR-009**: The system MUST document the response shape for each read model so the client can consume it without additional aggregation logic.
- **FR-010**: The system MUST validate the read-model behavior against representative completed-session datasets and benchmark the query behavior before the feature is considered complete.

### Key Entities _(include if feature involves data)_

- **Completed Session Summary**: A per-session derived record that captures the session identity, participants, matches, completion timing, and summary totals needed by history views.
- **Lifetime Player Stat**: A registered-user aggregate that combines completed-session participation into durable totals, averages, and counts.
- **Player Comparison**: A derived head-to-head summary for two selected participants that captures shared-session metrics and trend data, including guest session participants when the comparison is scoped to a session snapshot.
- **Leaderboard Entry**: A ranked registered-user summary used to display ordered lifetime performance results by total drinks consumed with average-drinks-per-game tie-breaking.
- **Registered Identity**: A durable account-linked identity that can appear in lifetime stats and leaderboards.
- **Guest Session Participant**: A session-scoped identity that may appear inside a session summary but does not become a permanent ranked identity.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In validation with completed-session datasets, the history screen can load session summaries without client-side aggregation in 100% of sampled runs.
- **SC-002**: In validation, every registered user with completed-session participation is represented by one lifetime stats record keyed to their account identity.
- **SC-003**: In validation, guest participants never appear as permanent lifetime or leaderboard identities, while still appearing inside the session summaries where they belong.
- **SC-004**: In validation, repeated comparison requests for the same two selected participants and the same dataset return identical results in 100% of runs.
- **SC-005**: In validation, leaderboards ordered by total drinks consumed and average drinks per game return deterministic ordering for tied results and remain stable across repeated queries for the same dataset.
- **SC-006**: Benchmark validation shows the representative read-model queries complete within the agreed local-performance threshold for the sample completed-session dataset.

## Assumptions

- Completed multiplayer sessions are the only source used to build the new read models in v1.
- Registered account identity is the durable key for lifetime stats and leaderboard rankings, and leaderboard ordering uses total drinks consumed in completed sessions with average drinks per game as the tie-break.
- Guest participants remain session-scoped and are not backfilled into permanent identity tables for this story.
- The current history screen's session, player, stats, and comparison views define the minimum contract the read models must support, including session-scoped guest comparisons only when both participants are present in the same completed session snapshot and cross-session comparisons for registered users.
- No separate data cleanup or migration is required beyond deriving these read models from existing completed-session data.
