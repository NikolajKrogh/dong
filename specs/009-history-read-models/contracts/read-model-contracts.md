# Read Model Contracts: History, Comparison, and Leaderboard

## Overview

This contract defines the public database surfaces that replace the current client-side aggregation in the history screen. The implementation should use `security_invoker` views for unparameterized reads and stable SQL functions for parameterized comparisons.

All contracts are read-only for authenticated clients. Explicit `GRANT` statements must be present for the exposed surfaces.

## Contract 1: Completed Session History

### Surface

- `public.completed_session_summaries` view

### Access

- `SELECT` for `authenticated`

### Purpose

Return one row per completed session with enough nested data to render the Games tab and details modal without client-side reconstruction.

### Required Fields

| Field                   | Type          | Notes                    |
| ----------------------- | ------------- | ------------------------ | ------------ |
| `session_id`            | `uuid`        | Completed session id     |
| `owner_account_id`      | `uuid`        | Session owner            |
| `completed_at`          | `timestamptz` | Completion timestamp     |
| `started_at`            | `timestamptz` | Session start time       |
| `common_match_id`       | `uuid         | null`                    | Common match |
| `session_total_players` | `integer`     | Participant count        |
| `session_total_matches` | `integer`     | Match count              |
| `session_total_goals`   | `integer`     | Aggregated goals         |
| `session_total_drinks`  | `numeric`     | Aggregated drinks        |
| `matches_per_player`    | `numeric`     | Session metric           |
| `players`               | `jsonb`       | Ordered player snapshots |
| `matches`               | `jsonb`       | Ordered match snapshots  |
| `player_assignments`    | `jsonb`       | Participant-to-match map |

### Notes

- The view should only include completed sessions.
- Guests remain visible only within the session snapshot.

## Contract 2: History Overview Totals

### Surface

- `public.history_overview_totals` view

### Access

- `SELECT` for `authenticated`

### Purpose

Return the overall totals used by the Stats tab without client-side summation.

### Required Fields

| Field                              | Type      | Notes                           |
| ---------------------------------- | --------- | ------------------------------- |
| `total_sessions`                   | `integer` | Completed session count         |
| `total_participations`             | `integer` | Participant row count           |
| `total_matches`                    | `integer` | Match count                     |
| `total_goals`                      | `integer` | Total goals                     |
| `total_drinks`                     | `numeric` | Total drinks                    |
| `average_drinks_per_participation` | `numeric` | Mean drinks per participant row |

### Notes

- The view should be deterministic for the same underlying dataset.

## Contract 3: Lifetime Player Stats

### Surface

- `public.lifetime_player_stats` view

### Access

- `SELECT` for `authenticated`

### Purpose

Return durable player totals keyed by account identity for the Players tab and for leaderboard ranking.

### Required Fields

| Field              | Type      | Notes                     |
| ------------------ | --------- | ------------------------- |
| `account_id`       | `uuid`    | Registered identity key   |
| `display_name`     | `text`    | Display name              |
| `games_played`     | `integer` | Completed sessions played |
| `total_drinks`     | `numeric` | Sum of drinks             |
| `average_per_game` | `numeric` | Average drinks per game   |

### Notes

- Guest participants must not appear in this view.
- This is the source view for the leaderboard.

## Contract 4: Leaderboard

### Surface

- `public.leaderboard_entries` view

### Access

- `SELECT` for `authenticated`

### Purpose

Return ranked registered accounts ordered by total drinks consumed in completed sessions.

### Required Fields

| Field              | Type      | Notes                   |
| ------------------ | --------- | ----------------------- |
| `rank`             | `integer` | Deterministic rank      |
| `account_id`       | `uuid`    | Registered identity key |
| `display_name`     | `text`    | Display name            |
| `total_drinks`     | `numeric` | Primary rank metric     |
| `games_played`     | `integer` | Supporting stat         |
| `average_per_game` | `numeric` | Tie-break metric        |

### Ordering Rules

1. `total_drinks` descending
2. `average_per_game` descending
3. `account_id` ascending

### Notes

- Guests are excluded from permanent rankings.
- The rank column should be stable for the same dataset.

## Contract 5: Registered User Comparison

### Surface

- `public.compare_registered_players(left_account_id uuid, right_account_id uuid)`

### Access

- `EXECUTE` for `authenticated`

### Purpose

Return the fully aggregated head-to-head metrics for two registered accounts across all completed sessions.

### Required Fields

All fields from `ComparisonResult` in [data-model.md](../data-model.md).

### Notes

- The function must return zero shared-session metrics and an empty timeline when the two registered users have no shared completed sessions.
- The function must be stable and deterministic.

## Contract 6: Session-Scoped Participant Comparison

### Surface

- `public.compare_session_participants(session_id uuid, left_participant_id uuid, right_participant_id uuid)`

### Access

- `EXECUTE` for `authenticated`

### Purpose

Return the comparison metrics for any two participants that both belong to the same completed session snapshot, including guest participants.

### Required Fields

All fields from `ComparisonResult` in [data-model.md](../data-model.md).

### Notes

- The function must reject requests where both participant ids are not members of the supplied completed session.
- Guest comparisons must remain session-scoped and must not aggregate across unrelated sessions.

## Client Mapping

- History screen `Games` tab -> `completed_session_summaries`
- History screen `Stats` tab -> `history_overview_totals`
- History screen `Players` tab -> `lifetime_player_stats`
- Player comparison modal -> `compare_registered_players` or `compare_session_participants` depending on identity scope
- Leaderboard screen -> `leaderboard_entries`
