# Data Model: History, Comparison, and Leaderboard Read Models

## Overview

This feature does not introduce new business tables. It adds derived read-model contracts over the existing multiplayer schema so the client can load completed-session history, lifetime player stats, comparison metrics, and leaderboards without re-aggregating local state.

The contracts are read-only and are built from the existing completed-session graph:

- `game_sessions` provides the completed-session boundary and timestamps.
- `participants` provides session-scoped player identity and per-session drink totals.
- `matches` provides the fixture and score data needed by history and comparison views.
- `assignments` provides the session-scoped player-to-match mapping.

## Derived Entities

### CompletedSessionSummary

Represents one completed session in the history list and details view.

| Field                   | Type          | Notes                                              |
| ----------------------- | ------------- | -------------------------------------------------- | -------------------- |
| `session_id`            | `uuid`        | Session primary key                                |
| `owner_account_id`      | `uuid`        | Session owner identity                             |
| `completed_at`          | `timestamptz` | Completion timestamp                               |
| `started_at`            | `timestamptz` | Session start time                                 |
| `common_match_id`       | `uuid         | null`                                              | Session common match |
| `session_total_players` | `integer`     | Participant count                                  |
| `session_total_matches` | `integer`     | Match count                                        |
| `session_total_goals`   | `integer`     | Home + away goals across matches                   |
| `session_total_drinks`  | `numeric`     | Total drinks across participants                   |
| `matches_per_player`    | `numeric`     | Derived session metric                             |
| `players`               | `jsonb`       | Ordered session participants, including guest rows |
| `matches`               | `jsonb`       | Ordered session matches with score data            |
| `player_assignments`    | `jsonb`       | Participant-to-match mapping                       |

**Relationships**

- One summary row per completed session.
- Guest participants remain represented only inside their session summary.

### HistoryOverviewTotals

Represents the aggregated totals used by the Stats tab.

| Field                              | Type      | Notes                                            |
| ---------------------------------- | --------- | ------------------------------------------------ |
| `total_sessions`                   | `integer` | Completed-session count                          |
| `total_participations`             | `integer` | Total participant rows across completed sessions |
| `total_matches`                    | `integer` | Total match rows across completed sessions       |
| `total_goals`                      | `integer` | Total goals across all completed sessions        |
| `total_drinks`                     | `numeric` | Total drinks across all completed sessions       |
| `average_drinks_per_participation` | `numeric` | Total drinks divided by participant rows         |

**Relationships**

- One row per query scope.
- Derived from completed-session summaries or the base session tables.

### LifetimePlayerStat

Represents one durable player aggregate keyed by account identity.

| Field              | Type      | Notes                                     |
| ------------------ | --------- | ----------------------------------------- |
| `account_id`       | `uuid`    | Registered identity key                   |
| `display_name`     | `text`    | Current durable display name              |
| `games_played`     | `integer` | Completed sessions containing the account |
| `total_drinks`     | `numeric` | Sum of completed-session drink totals     |
| `average_per_game` | `numeric` | `total_drinks / games_played`             |

**Relationships**

- One row per registered account with completed-session participation.
- Guest participants are excluded because they do not have durable account identity.

### ComparisonResult

Represents a fully aggregated head-to-head result for two selected participants.

| Field                         | Type      | Notes                                         |
| ----------------------------- | --------- | --------------------------------------------- |
| `player1_id`                  | `uuid`    | Registered account or session participant id  |
| `player2_id`                  | `uuid`    | Registered account or session participant id  |
| `player1_name`                | `text`    | Display name                                  |
| `player2_name`                | `text`    | Display name                                  |
| `player1_games_played`        | `integer` | Total completed sessions for player 1         |
| `player2_games_played`        | `integer` | Total completed sessions for player 2         |
| `player1_total_drinks`        | `numeric` | Total drinks across the compared scope        |
| `player2_total_drinks`        | `numeric` | Total drinks across the compared scope        |
| `player1_average_per_game`    | `numeric` | Average drinks per game                       |
| `player2_average_per_game`    | `numeric` | Average drinks per game                       |
| `games_played_together`       | `integer` | Shared-session count for the comparison scope |
| `player1_wins_count`          | `integer` | Comparison-scope wins                         |
| `player2_wins_count`          | `integer` | Comparison-scope wins                         |
| `tied_games_count`            | `integer` | Comparison-scope ties                         |
| `player1_max_in_a_game`       | `numeric` | Highest single-session total                  |
| `player2_max_in_a_game`       | `numeric` | Highest single-session total                  |
| `player1_common_match_count`  | `integer` | Common-match appearances                      |
| `player2_common_match_count`  | `integer` | Common-match appearances                      |
| `player1_efficiency`          | `numeric` | Drinks per match                              |
| `player2_efficiency`          | `numeric` | Drinks per match                              |
| `player1_top_drinker_count`   | `integer` | Top-drinker frequency                         |
| `player2_top_drinker_count`   | `integer` | Top-drinker frequency                         |
| `player1_avg_with_player2`    | `numeric` | Influence metric                              |
| `player1_avg_without_player2` | `numeric` | Influence metric                              |
| `player2_avg_with_player1`    | `numeric` | Influence metric                              |
| `player2_avg_without_player1` | `numeric` | Influence metric                              |
| `timeline_data`               | `jsonb`   | Ordered timeline points                       |

**Relationships**

- Registered-user comparisons aggregate across all completed sessions.
- Guest comparisons are only valid inside a single completed session snapshot.
- If two registered users have no shared completed sessions, the shared-session metrics are zero and `timeline_data` is empty.

### LeaderboardEntry

Represents one ranked row in the leaderboard view.

| Field              | Type      | Notes                      |
| ------------------ | --------- | -------------------------- |
| `rank`             | `integer` | Deterministic order number |
| `account_id`       | `uuid`    | Registered identity key    |
| `display_name`     | `text`    | Display name               |
| `total_drinks`     | `numeric` | Primary ranking metric     |
| `games_played`     | `integer` | Supporting stat            |
| `average_per_game` | `numeric` | Secondary tie-break metric |

**Relationships**

- One row per ranked registered account.
- Guests are not ranked.

## Validation Rules

- Completed-session read models only include sessions with a completed state.
- History summaries preserve guest participants only as session-scoped rows.
- Lifetime stats and leaderboards are keyed by registered account identity.
- Leaderboards sort by `total_drinks` descending, `average_per_game` descending, then `account_id` ascending.
- Comparison functions return zeroed shared metrics rather than errors for registered users with no overlap.
- Guest comparisons are only valid when both inputs belong to the same completed session snapshot.
