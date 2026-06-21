# Data Model: Host Creates Room

**Feature**: 016-create-host-room
**Date**: 2026-06-20

---

## Existing Tables Used (no schema changes)

### `public.game_sessions`

| Column | Type | Value at creation |
|--------|------|-------------------|
| `id` | `uuid` | `gen_random_uuid()` |
| `owner_account_id` | `uuid` | `auth.uid()` |
| `join_code` | `text` | Generated 6-digit numeric string |
| `state` | `session_state` | `'joinable'` |
| `common_match_id` | `uuid` | `NULL` |
| `last_event_sequence` | `bigint` | `0` |
| `created_at` | `timestamptz` | `now()` |
| `started_at` | `timestamptz` | `NULL` |
| `completed_at` | `timestamptz` | `NULL` |

**Key constraint**: `ux_game_sessions_join_code_active` — `UNIQUE (join_code) WHERE state != 'completed'`

### `public.participants`

| Column | Type | Value at creation |
|--------|------|-------------------|
| `id` | `uuid` | `gen_random_uuid()` |
| `session_id` | `uuid` | The new `game_sessions.id` |
| `account_id` | `uuid` | `auth.uid()` |
| `display_name` | `text` | `accounts.preferred_display_name` or `'Host'` |
| `membership_type` | `participant_membership_type` | `'registered'` |
| `session_role` | `participant_session_role` | `'owner'` |
| `current_drink_total` | `numeric(6,1)` | `0` |
| `guest_rejoin_token_hash` | `text` | `NULL` |
| `created_at` | `timestamptz` | `now()` |

---

## New: Migration `029_host_create_room.sql`

Adds two functions only — no DDL table changes.

### `private.create_room_as_host()` → `jsonb`

```
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''

Returns jsonb:
  sessionId         text   — game_sessions.id::text
  joinCode          text   — 6-digit numeric string
  hostParticipantId text   — participants.id::text
  hostDisplayName   text   — display name stored in participants row

Error conditions (RAISE EXCEPTION):
  'not_authenticated'         — auth.uid() is null
  'create_room_code_exhausted'— 5 unique-code attempts all failed
```

**Algorithm**:
1. Assert `auth.uid() IS NOT NULL` → `not_authenticated`
2. Read `accounts.preferred_display_name` for calling user; coalesce to `'Host'`
3. Check for existing joinable room owned by `auth.uid()` → if found, return its data immediately (no insert)
4. Loop up to 5 times:
   a. Generate candidate: `LPAD(FLOOR(RANDOM() * 1000000)::int::text, 6, '0')`
   b. Attempt `INSERT INTO game_sessions`
   c. On `unique_violation` → retry; on success → break
5. After loop: if no insert succeeded → `create_room_code_exhausted`
6. Insert participant row (`session_role = 'owner'`, `membership_type = 'registered'`)
7. Return `jsonb_build_object(...)` with the four fields

### `public.create_room_as_host()` → `jsonb`

```
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''

Body: SELECT private.create_room_as_host();

GRANT EXECUTE TO authenticated;
REVOKE EXECUTE FROM anon, PUBLIC;
```

Thin public wrapper that forwards to the private function and applies the grant boundary.

---

## New: TypeScript Types (`types/hostRoom.ts`)

```typescript
export interface HostRoomCreateResponse {
  sessionId: string;
  joinCode: string;
  hostParticipantId: string;
  hostDisplayName: string;
}

export type HostRoomCreateStatus = 'idle' | 'creating' | 'success' | 'error';
```

---

## Session State Machine

Only the initial state transition is in scope for this story:

```
[Host taps Create Room]
          │
          ▼
     [joinable]  ←── US5.1 creates this entry point
          │
          │  US5.2: guests join → still joinable
          │  US5.3: host starts game
          ▼
    [in_progress]
          │
          │  (future)
          ▼
     [completed]
```

---

## Join Code Generation Detail

- **Format**: zero-padded 6-digit string (`000000`–`999999`)
- **Expression**: `LPAD(FLOOR(RANDOM() * 1000000)::int::text, 6, '0')`
- **Uniqueness scope**: active (non-completed) rooms only, via `ux_game_sessions_join_code_active`
- **Collision handling**: retry-on-`unique_violation`, max 5 attempts
- **Reuse**: codes are recycled once a room reaches `completed` state
