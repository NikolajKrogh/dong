# Shared Session Write Contract

## Purpose

This contract defines the validated write and read surfaces that future DONG clients should rely on for multiplayer session state. Direct table writes are not the public contract. The public contract is a set of Supabase RPC or database-command surfaces that enforce ownership, same-session integrity, idempotency, and completed-session immutability.

Actual SQL function names may vary during implementation, but the semantic contract below must hold.

## Identity Contexts

| Context | Identity Source | Contract Expectations |
| --- | --- | --- |
| Authenticated host | `auth.uid()` mapped to `public.accounts.id` | Can create a session, join as the host participant, persist setup, append history-affecting events, and complete the session |
| Authenticated registered participant | `auth.uid()` mapped to `public.accounts.id` plus a participant row | Can join an existing session as a registered participant and later perform only the event actions explicitly allowed by follow-up authorization work |
| Guest participant | Join code plus guest rejoin token | Can join or reclaim a session-scoped participant record without a durable account |
| Service role or DB test harness | Supabase service role or pgTAP helper context | Fixture setup only; not the user-facing write path |

## Core Write Commands

### `create_session`

Creates a new joinable session for an authenticated host.

**Caller**: authenticated host  
**Inputs**:

- optional `hostDisplayName`
- `idempotencyKey`

**Behavior**:

- ensures a matching `public.accounts` row exists for `auth.uid()`
- creates a `game_sessions` row in `joinable` state with a server-generated join code
- creates the host’s participant row in the same session
- appends a `session_created` gameplay event in the same transaction

**Success response**:

- `sessionId`
- `joinCode`
- `state`
- `hostParticipantId`

**Failure conditions**:

- caller is not authenticated
- idempotency key conflicts with an incompatible prior command result

### `join_session_registered`

Joins an active session as an authenticated registered participant.

**Caller**: authenticated registered user  
**Inputs**:

- `joinCode`
- optional `displayName`
- `idempotencyKey`

**Behavior**:

- resolves the active session by join code
- rejects completed sessions
- returns the existing participant row if this account is already a session member
- otherwise creates a registered participant row and appends `participant_joined`

**Success response**:

- `sessionId`
- `participantId`
- `membershipType = registered`

**Failure conditions**:

- join code does not resolve to an active session
- caller is not authenticated
- session is completed

### `join_session_guest`

Creates a guest participant membership for an active session.

**Caller**: guest client through a validated public-safe join surface  
**Inputs**:

- `joinCode`
- `displayName`
- `idempotencyKey`

**Behavior**:

- resolves the active session by join code
- rejects completed sessions
- creates a guest participant row
- generates a server-issued guest rejoin token and stores only its hash
- appends `participant_joined`

**Success response**:

- `sessionId`
- `participantId`
- `membershipType = guest`
- raw `guestRejoinToken` returned once

**Failure conditions**:

- join code does not resolve to an active session
- session is completed
- input validation fails

### `reclaim_guest_participant`

Reuses the existing guest participant row after reconnect.

**Caller**: guest client  
**Inputs**:

- `joinCode`
- `guestRejoinToken`

**Behavior**:

- resolves the active session by join code
- matches the provided token to the stored session-scoped hash
- returns the existing participant row instead of creating a duplicate membership

**Success response**:

- `sessionId`
- `participantId`
- `membershipType = guest`

**Failure conditions**:

- join code does not resolve to an active session
- token is invalid for that session
- session is completed

### `replace_session_setup`

Atomically persists the match list, common match, and assignment map for a session.

**Caller**: authenticated host  
**Inputs**:

- `sessionId`
- `matches[]`
- `commonMatchId`
- `assignments[]`
- `idempotencyKey`

**Behavior**:

- validates host ownership
- upserts or replaces session matches for the payload
- updates `game_sessions.common_match_id`
- replaces assignments transactionally
- rejects assignments that do not belong to the same session
- rejects explicit assignments for the common match
- appends one setup-related gameplay event for the authoritative change

**Success response**:

- `sessionId`
- updated session setup snapshot

**Failure conditions**:

- caller is not the host
- any participant or match in the payload belongs to another session
- session is completed
- idempotency key conflicts with an incompatible prior command result

### `append_gameplay_event`

Applies a history-affecting mutation and records it immutably.

**Caller**: authenticated host or later-authorized participant  
**Inputs**:

- `sessionId`
- `actorParticipantId`
- `eventType`
- `payload`
- `idempotencyKey`

**Behavior**:

- validates the actor belongs to the session
- rejects completed sessions
- checks `(sessionId, idempotencyKey)`
- if first use, increments the session event sequence, updates current snapshot tables as needed, and appends one immutable gameplay event
- if repeated with the same semantic command, preserves the original authoritative result instead of creating a second event

**Success response**:

- `eventId`
- `sequenceNumber`
- any updated snapshot state needed by the caller

**Failure conditions**:

- missing or invalid idempotency key
- actor is not a participant in the session
- session is completed
- idempotency key is reused for a conflicting command payload

### `complete_session`

Moves the session into its terminal state.

**Caller**: authenticated host  
**Inputs**:

- `sessionId`
- `actorParticipantId`
- `idempotencyKey`

**Behavior**:

- validates host ownership
- marks the session `completed`
- sets `completed_at`
- appends `session_completed`
- causes future history-affecting writes to reject for that session

**Success response**:

- `sessionId`
- `state = completed`
- `completedAt`

**Failure conditions**:

- caller is not the host
- session is already completed with a conflicting command request

## Read Expectations

### `get_active_session_by_join_code`

Returns the active session snapshot used by join and reconnect flows.

**Includes**:

- session id and state
- host account reference
- participants
- matches
- common match
- assignments

### `get_session_snapshot`

Returns the host or authorized participant view of a session by session id.

**Includes**:

- current session snapshot tables
- ordered gameplay events by `(sequence_number)`
- enough state to hydrate the current game and later derive history views

## Invariants This Contract Must Preserve

- Active join codes never resolve to more than one non-completed session.
- The same registered account cannot become multiple participants in one session.
- A reconnecting guest never creates a duplicate participant row when presenting the same valid rejoin token.
- Assignments and actor references cannot cross session boundaries.
- One history-affecting command produces at most one immutable event for a given `(sessionId, idempotencyKey)`.
- Completed sessions reject new history-affecting writes.