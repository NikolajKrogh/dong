# Research: Host Creates Room

**Feature**: 016-create-host-room
**Completed**: 2026-06-20
**Status**: All unknowns resolved — via codebase exploration and design session

---

## Decision 1: API Layer for Room Creation

**Decision**: Supabase PL/pgSQL RPC (`SECURITY DEFINER`)
**Rationale**: Room creation requires no external integration, secrets, or cross-service orchestration. A `private.create_room_as_host` function can atomically generate the code, insert both rows (session + participant), and handle the existing-room redirect in a single transaction. The guest-join flow (`private.join_room_as_guest`) uses the identical pattern.
**Alternatives considered**: Java `command-api` endpoint — rejected because the constitution requires Java only when Supabase cannot safely handle the operation (§IV). Room creation is entirely within Postgres.

---

## Decision 2: Join Code Format

**Decision**: 6-digit numeric string (e.g., `482917`)
**Rationale**: User preference. 1,000,000 possible codes; at the expected scale (dozens of concurrent rooms), collision probability is negligible. A PL/pgSQL retry loop (max 5 attempts) handles rare conflicts against the existing `ux_game_sessions_join_code_active` partial unique index.
**Alternatives considered**: 6-char alphanumeric excluding ambiguous chars (~1 billion combinations) — more collision-resistant but user preferred numeric for ease of sharing and typing.

---

## Decision 3: UI Entry Point and Auth Awareness

**Decision**: Auth-aware home screen — "Create Room" button renders only when `account !== null` from `useAccountAuth`.
**Rationale**: `useAccountAuth` already exists at `hooks/useAccountAuth.ts` and exposes `account: Account | null`. Showing "Create Room" only to authenticated hosts avoids tap-then-redirect friction. Multiplayer actions are grouped near "Join Room as Guest" on the home screen.
**Alternatives considered**: Show to all users and redirect unauthenticated to sign-in — rejected (unnecessary friction and a confusing back-navigation experience).

---

## Decision 4: Lobby Screen Route

**Decision**: `app/lobby/[sessionId].tsx` (Expo Router dynamic segment)
**Rationale**: Idiomatic Expo Router pattern for a resource-scoped screen. The sessionId in the URL supports future deep-linking. All subsequent lobby stories (US5.2, US5.3) extend this screen without rethinking the route.
**Alternatives considered**: Modal over home screen (breaks back-stack, no deep-link support), flat route with query param (less idiomatic Expo Router).

---

## Decision 5: Multiple Active Rooms per Host

**Decision**: Block creation if host already has a joinable room; return existing room data (same response shape).
**Rationale**: No valid use case for two open rooms simultaneously. Orphaned joinable rooms would confuse guests trying to join by code. Check is server-side in the RPC before attempting insertion.
**Alternatives considered**: Allow multiples (creates orphan problem), warn and let user choose (unnecessary complexity for US5.1).

---

## Decision 6: RPC Return Shape

**Decision**: Partial — `{ sessionId, joinCode, hostParticipantId, hostDisplayName }`
**Rationale**: The US5.1 lobby screen needs exactly these four values to render. US5.2 will add Supabase Realtime subscriptions for live participant updates, making a full snapshot unnecessary at creation time. Lean response avoids coupling to a shape that will be superseded.
**Alternatives considered**: Full snapshot matching guest-join pattern — over-fetches for the creation context; wasted once Realtime arrives in US5.2.

---

## Decision 7: Host Display Name

**Decision**: Used silently from `accounts.preferred_display_name`; fallback to `'Host'` in PL/pgSQL if null.
**Rationale**: The host configured their display name at account creation (US3.1). Room creation should feel instant — one tap. Profile settings is the correct place to manage names, not a pre-creation prompt.
**Alternatives considered**: Confirmation prompt before creation, block if name unset — both add unnecessary friction.

---

## Decision 8: Client Hook Pattern

**Decision**: Dedicated `useHostRoomCreate` hook at `hooks/useHostRoomCreate.ts`
**Rationale**: Keeps `app/index.tsx` slim, matches the `useGuestRoomJoin` convention, and makes the logic unit-testable without rendering the full home screen.
**Alternatives considered**: Inline `useState` + `useCallback` in `index.tsx` — breaks established pattern and bloats an already-large component.

---

## RLS / Security Findings

- `authenticated` role has `SELECT`-only on `game_sessions` (migration 013). The new RPC is `SECURITY DEFINER` in the `private` schema, matching the guest-join pattern.
- A public wrapper function (`public.create_room_as_host`) grants `EXECUTE` to `authenticated`, exposing only the safe entry point.
- `auth.uid()` is called inside the `SECURITY DEFINER` context to identify the calling host — the same approach used by all existing private functions.
- Unauthenticated callers (where `auth.uid()` is null) receive a `not_authenticated` exception before any reads or writes occur.

---

## Code Collision Handling

The `ux_game_sessions_join_code_active` partial unique index already enforces uniqueness of `join_code` across non-completed sessions. The PL/pgSQL function catches `unique_violation` inside a retry loop (max 5 attempts). At expected scale with 6-digit numeric codes (1M combinations, ~dozens concurrent rooms), retry probability per attempt is < 0.01%.

---

## Test Coverage Map

| Layer | File | What it proves |
|-------|------|----------------|
| DB (pgTAP) | `supabase/tests/database/160_host_create_room.test.sql` | RPC creates session + participant atomically; existing-room redirect returns correct data; code uniqueness enforced; unauthenticated caller rejected |
| Unit (Jest) | `__tests__/hooks/useHostRoomCreate.test.ts` | Hook state transitions (idle → creating → success/error); navigation called with correct params on success; error surfaced on failure |
| E2E (Playwright BDD) | `e2e/features/host-create-room.feature` | Host signs in → taps Create Room → lobby screen appears → join code visible |
