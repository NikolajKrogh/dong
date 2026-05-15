# Data Model: Join Room as Guest

## Entity: Guest Join Request

Represents a submitted guest-room join attempt from the device.

Fields:

- `join_code` text, trimmed and normalized before lookup
- `guest_name` text, trimmed before validation
- `guest_token` text, generated on the device before the first submit and reused across retries until the join attempt resolves
- `requested_at` timestamptz, implied by the RPC call

Validation rules:

- `join_code` must resolve to a current room session that is still joinable.
- `guest_name` must not be blank after trimming.
- `guest_token` must be present for the initial submit and remain stable across retries for the same attempted join.
- Duplicate guest names are allowed.

## Entity: Guest Participant

Represents a temporary room-scoped participant row stored in `public.participants`.

Fields:

- `id` uuid, primary key
- `session_id` uuid, foreign key to `public.game_sessions(id)`
- `account_id` uuid, null for guests
- `display_name` text, the room-facing guest name
- `membership_type` `participant_membership_type`, set to `guest`
- `session_role` `participant_session_role`, set to `member`
- `guest_rejoin_token_hash` text, hashed room-scoped grant for reloading the same guest session and replay-safe join retries
- `created_at` timestamptz

Relationships:

- One guest participant belongs to exactly one room session.
- One room session may contain many guest participants.
- The hashed token maps to a single guest participant row within a session.

Validation rules:

- `display_name` must remain non-empty.
- `guest_rejoin_token_hash` must be unique per session.
- Replaying the same `guest_token` for the same session must resolve to the existing participant row instead of creating a second guest row.
- The row must not link to a durable account.

## Entity: Guest Room Session Grant

Represents the client-side credential that allows the guest device to restore and refresh the joined room session.

Fields:

- `guest_token` plaintext, stored only on the device
- `participant_id` uuid, returned by the join RPC
- `session_id` uuid, returned by the join RPC
- `join_code` text, persisted for convenience and refresh
- `display_name` text, used to restore the lobby identity

State transitions:

- `issued` when the join RPC succeeds.
- `stored` when the client writes the grant to AsyncStorage.
- `active` when the room snapshot loads successfully.
- `restored` when a valid stored grant reloads the room after app restart.
- `replayed` when the same `guest_token` is resubmitted after a lost response and the existing participant is returned.
- `expired` when the server no longer recognizes the grant, which forces the client to clear local storage and return to the home-owned guest join modal.
- `cleared` when the guest leaves the room or the app resets the session.

## Entity: Guest Room Snapshot

Represents the room state returned to the guest client after join or refresh.

Fields:

- `session_id` uuid
- `join_code` text
- `state` session lifecycle state
- `participants` array of participant summaries
- `matches` array of match summaries
- `assignments` array or grouped mapping
- `common_match_id` uuid, nullable

Validation rules:

- The snapshot must only return the guest's own room session.
- The snapshot must not expose unrelated rooms.
- The guest participant should appear alongside the host and any registered players already in the room.
- An expired or invalid guest grant must return a distinct failure that allows the client to clear the stored grant deterministically.
