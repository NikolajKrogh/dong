# Data Model: Cloud Gameplay Core Data Model

## Overview

This feature introduces the first cloud-backed relational model for DONG multiplayer sessions. Supabase Auth remains the source of durable identity, `public.accounts` becomes the application-owned identity anchor, and the shared-state model stores current session snapshots alongside immutable gameplay events so later history and leaderboard work can reconstruct outcomes from persisted records.

Two logical entities are represented as columns rather than standalone tables in v1:

- `GuestRejoinToken` lives as a hashed token on guest participant rows.
- `IdempotencyKey` lives on immutable gameplay event rows.

## Enumerations

### `session_state`

- `joinable`
- `in_progress`
- `completed`

### `participant_membership_type`

- `registered`
- `guest`

### `gameplay_event_type`

The event type list is expected to start with constrained values such as:

- `session_created`
- `participant_joined`
- `participant_reclaimed`
- `match_added`
- `common_match_selected`
- `assignment_replaced`
- `score_changed`
- `drink_changed`
- `session_started`
- `session_completed`

Implementation note: use a text column with a check constraint for `gameplay_event_type`, and keep that convention consistent across migrations.

## Physical Entities

### Account

Durable application-owned identity row keyed to Supabase Auth.

| Field                    | Type          | Notes                                                     |
| ------------------------ | ------------- | --------------------------------------------------------- |
| `id`                     | `uuid`        | Primary key, also foreign key to `auth.users.id`          |
| `preferred_display_name` | `text`        | Nullable, future-friendly for profiles and setup defaults |
| `created_at`             | `timestamptz` | Default `now()`                                           |
| `updated_at`             | `timestamptz` | Default `now()`                                           |

**Relationships**

- One account can host many game sessions.
- One account can participate in many sessions through `participants.account_id`.

**Validation rules**

- `id` must correspond to an existing `auth.users` row.

### Game Session

Authoritative room and lifecycle record for a multiplayer game.

| Field                 | Type            | Notes                                             |
| --------------------- | --------------- | ------------------------------------------------- |
| `id`                  | `uuid`          | Primary key                                       |
| `host_account_id`     | `uuid`          | Foreign key to `accounts.id`                      |
| `join_code`           | `text`          | Short uppercase code used by participants to join |
| `state`               | `session_state` | `joinable`, `in_progress`, or `completed`         |
| `common_match_id`     | `uuid`          | Nullable reference to the shared common match     |
| `last_event_sequence` | `bigint`        | Monotonic per-session event counter, default `0`  |
| `created_at`          | `timestamptz`   | Default `now()`                                   |
| `started_at`          | `timestamptz`   | Nullable                                          |
| `completed_at`        | `timestamptz`   | Nullable                                          |

**Relationships**

- One session belongs to one host account.
- One session has many participants, matches, assignments, and gameplay events.
- One session can reference zero or one common match from its own match set.

**Validation rules**

- `join_code` is unique only for active sessions; completed sessions may release the code for reuse.
- `completed_at` can only be set when `state = 'completed'`.
- `common_match_id`, when present, must belong to the same session.

### Participant

Session-scoped member record for either a durable account or a guest.

| Field                     | Type                          | Notes                                                     |
| ------------------------- | ----------------------------- | --------------------------------------------------------- |
| `id`                      | `uuid`                        | Primary key                                               |
| `session_id`              | `uuid`                        | Foreign key to `game_sessions.id`                         |
| `account_id`              | `uuid`                        | Nullable foreign key to `accounts.id`; null for guests    |
| `display_name`            | `text`                        | Session-facing display name                               |
| `membership_type`         | `participant_membership_type` | `registered` or `guest`                                   |
| `current_drink_total`     | `numeric(6,1)`                | Current session snapshot, default `0`                     |
| `guest_rejoin_token_hash` | `text`                        | Nullable for registered participants; required for guests |
| `created_at`              | `timestamptz`                 | Default `now()`                                           |

**Relationships**

- Many participants belong to one session.
- A registered participant can reference one durable account.
- A participant can appear in many assignments and many gameplay events.

**Validation rules**

- Registered participants require `account_id` and must not carry a guest rejoin token hash.
- Guest participants require a guest rejoin token hash and must not reference `account_id`.
- `current_drink_total >= 0`.
- At most one `(session_id, account_id)` exists when `account_id IS NOT NULL`.
- Guest rejoin token hashes are unique per session.

### Match

Tracked fixture inside a session, including current score snapshot and provider linkage.

| Field             | Type          | Notes                                                  |
| ----------------- | ------------- | ------------------------------------------------------ |
| `id`              | `uuid`        | Primary key                                            |
| `session_id`      | `uuid`        | Foreign key to `game_sessions.id`                      |
| `source_provider` | `text`        | External feed source such as `espn`                    |
| `source_match_id` | `text`        | Nullable external identifier for later live-score sync |
| `home_team_name`  | `text`        | Required                                               |
| `away_team_name`  | `text`        | Required                                               |
| `kickoff_at`      | `timestamptz` | Nullable                                               |
| `home_score`      | `integer`     | Current score snapshot, default `0`                    |
| `away_score`      | `integer`     | Current score snapshot, default `0`                    |
| `created_at`      | `timestamptz` | Default `now()`                                        |

**Relationships**

- Many matches belong to one session.
- Many participants can be linked to many matches through assignments.
- One match may be referenced as a session’s common match.

**Validation rules**

- `home_score >= 0` and `away_score >= 0`.
- `(session_id, source_provider, source_match_id)` is unique when an external match id is present.

### Assignment

Join table for participant-to-match responsibility within a session.

| Field            | Type          | Notes                            |
| ---------------- | ------------- | -------------------------------- |
| `session_id`     | `uuid`        | Session owner for the assignment |
| `participant_id` | `uuid`        | Participant in the same session  |
| `match_id`       | `uuid`        | Match in the same session        |
| `created_at`     | `timestamptz` | Default `now()`                  |

**Key and relationships**

- Composite primary key: `(session_id, participant_id, match_id)`.
- Composite foreign key `(session_id, participant_id)` references `participants(session_id, id)`.
- Composite foreign key `(session_id, match_id)` references `matches(session_id, id)`.

**Validation rules**

- Cross-session assignments are impossible because both participant and match must belong to the same `session_id`.
- The write path should reject assignments to the common match, because the common match applies to all participants without explicit assignment rows.

### Gameplay Event

Immutable append-only audit record for shared-state changes that affect history.

| Field                  | Type          | Notes                                               |
| ---------------------- | ------------- | --------------------------------------------------- |
| `id`                   | `uuid`        | Primary key                                         |
| `session_id`           | `uuid`        | Foreign key to `game_sessions.id`                   |
| `sequence_number`      | `bigint`      | Monotonic per-session order                         |
| `actor_participant_id` | `uuid`        | Participant who initiated the event                 |
| `event_type`           | `text`        | Constrained to known gameplay event values          |
| `idempotency_key`      | `text`        | Client-generated command key, scoped to the session |
| `payload`              | `jsonb`       | Immutable event body                                |
| `created_at`           | `timestamptz` | Default `now()`                                     |

**Relationships**

- Many gameplay events belong to one session.
- Many gameplay events can be attributed to one participant.

**Validation rules**

- `(session_id, sequence_number)` is unique.
- `(session_id, idempotency_key)` is unique.
- `(session_id, actor_participant_id)` must resolve to a participant in the same session.
- `sequence_number > 0`.
- Inserts must be rejected when the session is already completed.

## Logical Entities

### Guest Rejoin Token

- Raw token is returned to the guest once at join time.
- Only a hashed representation is stored in `participants.guest_rejoin_token_hash`.
- Token lookup is always scoped to an active session.
- Reclaiming a participant record must not create a new participant row.

### Idempotency Key

- Lives on `gameplay_events.idempotency_key`.
- One key corresponds to one authoritative history-affecting command per session.
- Reusing the same key must return or preserve the same outcome.
- Reusing the same key for a conflicting payload is rejected by the validated write path.

## Relationship Summary

- `auth.users` 1:1 `accounts`
- `accounts` 1:\* `game_sessions` as hosts
- `game_sessions` 1:\* `participants`
- `game_sessions` 1:\* `matches`
- `game_sessions` 1:\* `gameplay_events`
- `participants` _:_ `matches` through `assignments`
- `game_sessions` 0:1 `matches` as `common_match_id`
- `participants` 1:\* `gameplay_events` as actors

## State Transitions

### Session lifecycle

```text
joinable -> in_progress -> completed
```

- `completed` is terminal in v1.
- Sessions remain joinable until they are completed.
- Once completed, no new history-affecting writes are accepted.

### Participant lifecycle

```text
registered join -> active participant
guest join + token issue -> active participant -> token-based reclaim -> same participant row
```

- Registered rejoin resolves by `(session_id, account_id)`.
- Guest rejoin resolves by `(session_id, guest_rejoin_token_hash)`.

### Event lifecycle

```text
validated command -> allocate next session sequence -> write snapshot changes -> append immutable event -> commit
```

- The write path increments `game_sessions.last_event_sequence` transactionally.
- Snapshot tables (`participants.current_drink_total`, `matches.home_score`, `matches.away_score`, `game_sessions.state`) are convenience state; replay and history remain event-backed.

## Database Invariants

- Active join codes map to at most one non-completed session.
- Host ownership is always represented by `game_sessions.host_account_id`.
- Every registered participant membership is unique per account within a session.
- Every guest participant has one reclaim token hash scoped to the session.
- Every assignment references a participant and match in the same session.
- Every history-affecting command maps to at most one immutable event per session idempotency key.
- Completed sessions reject inserts, updates, or deletes on history-affecting session tables through validated write paths and completion guards.

## Migration Order

1. Create stable enum types or constrained text conventions.
2. Create `accounts` keyed to `auth.users`.
3. Create `game_sessions` without the `common_match_id` foreign key enforced yet if needed for dependency ordering.
4. Create `participants`.
5. Create `matches`.
6. Add the same-session `common_match_id` foreign key from `game_sessions` to `matches`.
7. Create `assignments` with composite foreign keys.
8. Create `gameplay_events` with session sequence and idempotency constraints.
9. Add helper functions or triggers for sequence allocation, completion guards, and timestamp maintenance.
10. Add pgTAP tests for structure, integrity, authenticated host context, guest reclaim, idempotency, and completion behavior.
