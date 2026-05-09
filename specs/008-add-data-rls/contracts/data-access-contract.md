# Data Access Contract: Protected Multiplayer Data Access

## Purpose

This contract defines the row-level access boundaries for the data surfaced by issue #125. Direct table access is allowed only where RLS and grants explicitly permit it. Protected room mutations remain behind approved database-command or service-role paths.

## Identity Contexts

| Context                         | Identity Source                                                       | Contract Expectations                                                                            |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Signed-in account owner         | `auth.uid()` mapped to `public.accounts.id`                           | Can read and update its own profile and settings rows                                            |
| Accepted friendship participant | `auth.uid()` mapped to one side of an accepted friendship row         | Can read the other account's profile row, but not that account's settings row                    |
| Friendship requester/addressee  | `auth.uid()` mapped to the requester or addressee on a friendship row | Can read that friendship row and transition it only when the current lifecycle state allows it   |
| Room host                       | `auth.uid()` mapped to the host account on a session                  | Can read room data for that session                                                              |
| Room participant                | `auth.uid()` mapped to a participant account in the session           | Can read room data for that session                                                              |
| Guest participant               | Join code plus session-scoped guest reclaim token                     | Can join/reclaim through the approved room surface, not through direct unrestricted table access |
| Service role / DB harness       | Supabase service role or pgTAP fixture context                        | Fixture setup and privileged room mutations only                                                 |

## Table Access Matrix

### `profiles`

- `SELECT`: owner or accepted friendship participant.
- `INSERT`: owner only.
- `UPDATE`: owner only.
- `DELETE`: owner only, if deletion is supported at all.

### `settings`

- `SELECT`: owner only.
- `INSERT`: owner only.
- `UPDATE`: owner only.
- `DELETE`: owner only, if deletion is supported at all.

### `friendships`

- `SELECT`: requester or addressee only.
- `INSERT`: requester only.
- `UPDATE`: requester/addressee only, but only for the lifecycle transition they are authorized to perform.
- `DELETE`: disabled unless the contract explicitly requires hard delete; lifecycle cancellation is preferred as an update.

### Room tables (`game_sessions`, `participants`, `matches`, `assignments`, `gameplay_events`)

- `SELECT`: host or current participant only for the relevant session.
- `INSERT` / `UPDATE` / `DELETE`: not exposed to general client roles; privileged room mutations occur through approved database commands or service-role paths.

## Invariants

- A signed-in user never gains access to another user's settings row.
- A signed-in user only sees a profile row for a friend after the friendship is accepted.
- Friendship rows are only visible to the two involved accounts.
- Room data is never readable outside the host/participant boundary.
- Direct client writes to protected room-state records are rejected.

## Implementation Notes

- Use explicit `GRANT` statements alongside `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Keep policy predicates index-friendly and avoid exposing helper functions in the `public` schema.
- Preserve the existing secure room write contract from US2.1; this feature only hardens access around it.
