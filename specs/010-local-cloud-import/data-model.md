# Data Model: One-Time Local-to-Cloud Import

## Overview

This feature adds an import control plane around the existing cloud gameplay tables. It does not introduce a second gameplay model. Instead, it records import progress in private ledger tables, then writes imported sessions into the existing canonical session, participant, match, assignment, and event tables so the current history and leaderboard read models can consume them unchanged.

The key new concepts are:

- a signed-in account can have at most one completed import state;
- each source legacy session is identified by a deterministic fingerprint;
- the user explicitly chooses one local participant to represent the signed-in account;
- guest participants remain session-scoped and are never promoted into permanent identities.

## Enumerations

### `legacy_history_import_state`

- `in_progress`
- `completed`
- `failed`

### `legacy_history_import_session_state`

- `pending`
- `imported`
- `skipped`
- `failed`
- `conflict`

## Physical Entities

### Legacy History Import State

One row per signed-in account that tracks the claimant choice and whether the account has already finished its one-time import.

| Field                            | Type                          | Notes                                                    |
| -------------------------------- | ----------------------------- | -------------------------------------------------------- |
| `account_id`                     | `uuid`                        | Primary key and FK to `public.accounts.id`               |
| `claimed_local_participant_id`   | `text`                        | Stable local participant id selected by the user         |
| `claimed_local_participant_name` | `text`                        | Display name captured for audit and conflict checks      |
| `state`                          | `legacy_history_import_state` | Current account-level import state                       |
| `started_at`                     | `timestamptz`                 | When the first import attempt began                      |
| `completed_at`                   | `timestamptz`                 | Set when all eligible sessions are imported successfully |
| `failed_at`                      | `timestamptz`                 | Set when a batch ends in failure                         |
| `last_error`                     | `text`                        | Human-readable failure summary                           |
| `created_at`                     | `timestamptz`                 | Default `now()`                                          |
| `updated_at`                     | `timestamptz`                 | Default `now()`                                          |

**Relationships**

- One account has zero or one import-state row.
- The row gates whether later runs should no-op after completion.

**Validation rules**

- `state = completed` implies `completed_at` is not null.
- `state = failed` implies `failed_at` is not null.
- `claimed_local_participant_id` must remain stable for the lifetime of the import state.

### Legacy History Import Session

One row per legacy session fingerprint per account. This is the durable dedupe ledger for retries and cross-device repeats.

| Field                          | Type                                  | Notes                                                                        |
| ------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------- |
| `id`                           | `uuid`                                | Primary key                                                                  |
| `account_id`                   | `uuid`                                | FK to `public.accounts.id`                                                   |
| `source_fingerprint`           | `text`                                | Deterministic hash of the normalized legacy session snapshot                 |
| `source_local_session_id`      | `text`                                | Local session id from AsyncStorage history                                   |
| `claimed_local_participant_id` | `text`                                | The local participant that represented the imported account for this session |
| `cloud_session_id`             | `uuid`                                | Nullable FK to `public.game_sessions.id` after a successful write            |
| `state`                        | `legacy_history_import_session_state` | Per-session import status                                                    |
| `error_message`                | `text`                                | Failure detail for UI/status reporting                                       |
| `created_at`                   | `timestamptz`                         | Default `now()`                                                              |
| `updated_at`                   | `timestamptz`                         | Default `now()`                                                              |

**Relationships**

- One imported legacy session maps to zero or one canonical cloud session.
- One account can have many source-fingerprint rows.
- The unique `(account_id, source_fingerprint)` pair prevents duplicate imports of the same source session.

**Validation rules**

- The same source fingerprint cannot be inserted twice for the same account.
- `state = imported` implies `cloud_session_id` is not null.
- `state = failed` implies `error_message` is not null.

### Legacy Session Payload

The RPC accepts a normalized session payload, not a raw local database dump.

| Field                          | Type             | Notes                                                           |
| ------------------------------ | ---------------- | --------------------------------------------------------------- |
| `source_local_session_id`      | `text`           | Legacy local `GameSession.id` from AsyncStorage                 |
| `saved_at`                     | `timestamptz`    | Local session timestamp                                         |
| `claimed_local_participant_id` | `text`           | User-selected claimant for the signed-in account                |
| `players`                      | `jsonb`          | Ordered local player snapshot                                   |
| `guestParticipants`            | `jsonb`          | Session-scoped guest snapshots preserved in the request payload |
| `matches`                      | `jsonb`          | Ordered local match snapshot                                    |
| `player_assignments`           | `jsonb`          | Local player-to-match assignment map                            |
| `common_match_id`              | `text` \| `null` | Local common match id                                           |
| `matches_per_player`           | `integer`        | Local setup summary                                             |

**Relationships**

- The server computes `source_fingerprint` from the normalized payload.
- The chosen claimant is stored separately from the fingerprint.
- Guest participant snapshots are carried separately in the payload so non-claimed players stay session-scoped.

## Logical Entities

### Source Fingerprint

- Deterministic hash of the normalized legacy session snapshot.
- Independent of retry attempts and independent of which device sent the payload.
- Used to dedupe the same source session across repeated imports.

### Claimed Local Participant

- The local player selected by the user to represent the signed-in account.
- Becomes the registered participant row in the imported cloud session.
- Must not be inferred automatically from display-name matching.

### Import State

- Account-level completion marker for the one-time import.
- The UI should show this as `in_progress`, `completed`, or `failed`.
- Once `completed`, later calls for that account should no-op or return an already-imported response.

## Relationship Summary

- `public.accounts` 1:0..1 `private.legacy_history_import_state`
- `public.accounts` 1:\* `private.legacy_history_import_sessions`
- `private.legacy_history_import_sessions.source_fingerprint` uniquely identifies a source session per account
- `private.legacy_history_import_sessions.cloud_session_id` points to the canonical imported `public.game_sessions` row
- Imported canonical sessions still use `public.participants`, `public.matches`, `public.assignments`, and `public.gameplay_events`

## State Transitions

### Account import lifecycle

```text
not started -> in_progress -> completed
                    \-> failed
```

- The import is complete only when all eligible source sessions have been processed.
- After completion, subsequent imports for the same account should return already-imported status.

### Session import lifecycle

```text
pending -> imported
       \-> skipped
       \-> failed
       \-> conflict
```

- `skipped` means the server recognized an already-imported source fingerprint.
- `conflict` means the same fingerprint was attempted with incompatible claimant data or malformed payload contents.

## Database Invariants

- The same source fingerprint cannot be imported twice for the same account.
- A completed account import is terminal for that account in v1.
- Guest participants remain session-scoped rows in the canonical cloud session tables.
