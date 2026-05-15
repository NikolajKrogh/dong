# Guest Room Join Contract

## Screen Contract

### `app/index.tsx`

- Must expose a clear guest-room entry point from the home screen.
- Must remain usable when no guest session exists yet.
- Must not force durable account auth before a guest can start the join flow.
- Must own the guest-join modal visibility state so a restored guest session reopens the room UI without creating a second session owner.

### `components/guestJoin/GuestJoinModal.tsx`

- Must collect a room code and guest name.
- Must trim and validate the guest name before submission.
- Must show room-not-found and room-not-joinable errors clearly.
- Must hand off into a lobby or room-state view after a successful join.
- Must switch to an active temporary-guest state after a successful join or restored grant, including room-scoped limitation copy and a leave path.
- Must restore a stored guest session when the persisted grant is still valid.
- Must clear local guest state and return the player to the home-owned guest join form when the server reports the stored grant is expired or invalid.
- Must allow the player to close the modal without clearing an already-active guest room session.

### `app/joinRoom.tsx`

- Must redirect the deprecated route back to `/` so the home-owned modal remains the only guest-room UI owner.

## Hook Contract

`useGuestRoomSession()` should expose:

- `status`: `idle | joining | joined | refreshing | failed | expired`
- `session`: the current guest room session or `null`
- `joinRoom(joinCode, guestName)`
- `refreshRoom()`
- `leaveRoom()`
- `error`: the latest user-facing error or `null`

Behavior requirements:

- `joinRoom` generates a device-scoped guest token before the first submission and reuses it for retry until the join attempt resolves.
- `refreshRoom` moves the session to `expired` and clears the persisted grant when the server reports an unknown or expired guest token.
- `leaveRoom` clears the persisted grant immediately.

## RPC Contract

### `join_room_as_guest(join_code text, guest_name text, guest_token text)`

- Accepts a room code, guest name, and replay-safe guest token.
- Normalizes the room code before lookup.
- Rejects blank or whitespace-only guest names.
- Allows duplicate guest names.
- Creates a guest participant row with `membership_type = 'guest'`.
- Replaying the same `guest_token` for the same room returns the existing guest participant and current snapshot instead of creating a duplicate participant row.
- Returns the session identity, participant identity, room snapshot, and the same device-scoped guest token.
- Returns a distinct error when a stored or replayed guest token is unknown or expired so the client can clear the local grant deterministically.

### `get_guest_room_snapshot(guest_token text)`

- Accepts the device-scoped guest token returned by the join RPC.
- Returns the current room snapshot for the same session only.
- Fails cleanly if the token is unknown or expired.

## Database Contract

- `public.game_sessions` remains the canonical room table.
- `public.participants` stores guest rows with `membership_type = 'guest'` and `session_role = 'member'`.
- `guest_rejoin_token_hash` stores only the hashed guest token.
- Duplicate guest display names are allowed within a room.
- Blank guest display names are rejected before insert.
- Replay with the same guest token must return the same participant instead of inserting a second row.
- No durable user account is created as part of guest join.
