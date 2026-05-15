# Research: Join Room as Guest

## Decision 1: Use a public Supabase RPC boundary for guest join and snapshot reads

Decision: The guest flow will call a public RPC wrapper for room joining, and a companion RPC for loading the guest room snapshot. The implementation can keep the SQL logic behind a private `SECURITY DEFINER` helper, but the client-facing surface is a small public command pair rather than direct table writes.

Rationale: Guests do not have a durable Supabase auth session, and the existing room RLS policies are authenticated-only. A public RPC keeps the authorization surface narrow, lets the database validate joinability atomically, and avoids exposing the room tables directly.

Alternatives considered:

- Direct table inserts from the client. Rejected because it would require weakening room-table access or introducing unsafe broad grants.
- Anonymous Supabase auth. Rejected because it creates an auth user row and does not match the no-account requirement.
- Edge Function only. Rejected because the repo already uses Supabase RPCs for server-authoritative commands, and the guest flow does not need an extra service layer.

## Decision 2: Persist a guest-room session grant locally and hash only the server-side token

Decision: On a successful guest join, the client will store a room-scoped guest session grant in AsyncStorage, while the database retains only the hashed token on the participant row.

Rationale: The guest device needs a local credential to reload the room snapshot without creating a durable account. Reusing the existing `guest_rejoin_token_hash` column preserves the current participant model and keeps the secret out of the database.

Alternatives considered:

- Store nothing locally and require the room code on every refresh. Rejected because the guest would lose access on reload and the join experience would feel fragile.
- Add a new persistent guest table. Rejected because the current participant schema already models guest rows and the feature only needs a grant, not a new entity family.

## Decision 3: Allow duplicate guest names and reject only blank or whitespace-only input

Decision: Guest display names will be trimmed, non-empty, and otherwise allowed to duplicate another participant in the same room.

Rationale: The clarified spec explicitly allows duplicates, and the temporary guest model is simpler when the room does not enforce guest-name uniqueness. The UI can still differentiate participants with guest labels or avatars if needed.

Alternatives considered:

- Case-insensitive uniqueness within a room. Rejected because it contradicts the clarified requirement.
- Exact-match uniqueness only. Rejected for the same reason.

## Decision 4: Normalize the room code before lookup and validate joinability in the RPC

Decision: The join RPC will trim the submitted room code, normalize it to uppercase, and then verify that the target session is currently joinable before inserting the guest participant.

Rationale: Existing join codes are stored in uppercase and active-session uniqueness already hangs off the join code. Normalizing input gives the guest a forgiving entry experience without changing the session model.

Alternatives considered:

- Case-sensitive join codes. Rejected because it makes the guest flow needlessly brittle and conflicts with the current room-code format.

## Decision 5: Keep the guest room UI as a home-owned modal, not embedded in auth

Decision: Own the guest join flow from `app/index.tsx` and render it in a dedicated `components/guestJoin/GuestJoinModal.tsx` surface, while keeping `app/joinRoom.tsx` as a redirecting fallback.

Rationale: Guest join is not account auth. Keeping it separate from the existing `/auth` flow preserves the durable-account path, while a home-owned modal keeps the player in the primary shell and avoids maintaining two competing guest-session UI owners.

Alternatives considered:

- Put guest join inside the auth route group. Rejected because that would blur temporary guest access with durable account identity.
- Keep the dedicated route as the primary UI. Rejected because the modal-first flow provides a better guest entry experience and keeps the home CTA and restored-session experience in one place.

## Decision 6: Use a client-generated guest token as the replay-safe join key

Decision: The client will generate a device-scoped guest token before the first join submission and resend the same token across retries until the join attempt resolves. The RPC will hash that token into `guest_rejoin_token_hash` and return the existing participant on replay rather than inserting a duplicate row.

Rationale: The constitution requires idempotent shared-state writes. Reusing the existing guest token field gives the join command a stable replay key without a new table or external coordinator, and it aligns retry safety with the same token already needed for restore.

Alternatives considered:

- Server-generated idempotency keys stored in a separate table. Rejected because it introduces a new persistence surface for a problem the current participant schema already solves.
- Ignore replay safety and depend on client-side button locking only. Rejected because network retries and lost responses still need a deterministic server outcome.
