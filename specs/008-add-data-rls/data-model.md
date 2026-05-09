# Data Model: Protected Multiplayer Data Access

## Overview

This feature adds the minimal account-linked tables required to secure the multiplayer data surface: `profiles`, `settings`, and `friendships`. It also applies row-level security and explicit grants to the existing room tables from US2.1 so the host/participant boundary is enforced directly in Postgres.

The existing `public.accounts` table remains the durable identity anchor mapped 1:1 to `auth.users`. The new tables hang off that anchor and are protected by RLS:

- `profiles` stores the friend-visible identity row.
- `settings` stores the owner-only preference row.
- `friendships` stores the request-based social relationship between two accounts.

## Enumerations

### `friendship_status`

- `pending`
- `accepted`
- `declined`
- `canceled`

## Physical Entities

### Profile

Friend-visible identity row for an authenticated account.

| Field          | Type          | Notes                                                                                                           |
| -------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| `account_id`   | `uuid`        | Primary key and foreign key to `accounts.id`                                                                    |
| `display_name` | `text`        | Public-facing display name, nullable only if the product allows fallback from `accounts.preferred_display_name` |
| `avatar_url`   | `text`        | Nullable profile image reference                                                                                |
| `bio`          | `text`        | Nullable short profile description                                                                              |
| `created_at`   | `timestamptz` | Default `now()`                                                                                                 |
| `updated_at`   | `timestamptz` | Default `now()`                                                                                                 |

**Relationships**

- One profile belongs to exactly one account.
- Accepted friendships may read the profile row.

**Validation rules**

- `account_id` must reference an existing account.
- One profile row exists per account.
- Only the owner may update the row.

### Settings

Owner-only preference row for an authenticated account.

| Field           | Type          | Notes                                               |
| --------------- | ------------- | --------------------------------------------------- |
| `account_id`    | `uuid`        | Primary key and foreign key to `accounts.id`        |
| `settings_data` | `jsonb`       | Structured preference payload, default empty object |
| `created_at`    | `timestamptz` | Default `now()`                                     |
| `updated_at`    | `timestamptz` | Default `now()`                                     |

**Relationships**

- One settings row belongs to exactly one account.
- Only the owner may read or update the row.

**Validation rules**

- `account_id` must reference an existing account.
- One settings row exists per account.
- Settings data is never readable by other signed-in users.

### Friendship

Request-based bilateral relationship between two authenticated accounts.

| Field                  | Type                | Notes                                        |
| ---------------------- | ------------------- | -------------------------------------------- |
| `id`                   | `uuid`              | Primary key                                  |
| `requester_account_id` | `uuid`              | Account that initiated the request           |
| `addressee_account_id` | `uuid`              | Account that received the request            |
| `status`               | `friendship_status` | Lifecycle state                              |
| `requested_at`         | `timestamptz`       | Default `now()`                              |
| `responded_at`         | `timestamptz`       | Nullable timestamp for accept/decline/cancel |
| `created_at`           | `timestamptz`       | Default `now()`                              |
| `updated_at`           | `timestamptz`       | Default `now()`                              |

**Relationships**

- One friendship row belongs to exactly two accounts.
- Accepted friendships unlock profile reads between the two accounts.

**Validation rules**

- `requester_account_id` and `addressee_account_id` must both reference existing accounts.
- The requester and addressee must be different accounts.
- Exactly one friendship row may exist for an unordered pair of accounts.
- Pending requests may transition to `accepted`, `declined`, or `canceled`.
- Accepted friendships may transition to `canceled` when the relationship ends.

## Relationship Summary

- `auth.users` 1:1 `accounts`
- `accounts` 1:1 `profiles`
- `accounts` 1:1 `settings`
- `accounts` 1:n `friendships` as requester
- `accounts` 1:n `friendships` as addressee
- `game_sessions` 1:n `participants`, `matches`, `assignments`, `gameplay_events`

## Access Model Summary

- `profiles`: owner read/write; accepted friendship participants may read.
- `settings`: owner read/write only.
- `friendships`: involved accounts may read; lifecycle state changes are limited to the requester/addressee rules defined in the contract.
- Room tables: host/participant read access only; privileged writes stay behind approved database-command or service-role paths.

## Database Invariants

- Every account has at most one profile row and one settings row.
- Friendship rows are unique per unordered pair of accounts.
- Accepted friendship is the only state that unlocks friend-readable profile access.
- Room-table access stays scoped to the session host or current participants.
