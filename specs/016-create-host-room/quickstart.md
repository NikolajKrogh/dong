# Quickstart: Host Creates Room

**Feature**: 016-create-host-room
**Date**: 2026-06-20

This guide describes how to validate the feature end-to-end once implemented.

---

## Prerequisites

1. Local Supabase stack running: `npm run db:start`
2. DB reset with all migrations applied: `npm run db:reset`
3. A registered host account exists (run the host-auth e2e flow or seed via SQL)
4. Expo web dev server running: `npx expo start --web`

---

## Validate the Database Layer (pgTAP)

```bash
npm run db:test
```

Expected: all tests in `supabase/tests/database/160_host_create_room.test.sql` pass, including:
- Room is created with `state = 'joinable'`
- Participant is created with `session_role = 'owner'` and `membership_type = 'registered'`
- Calling the RPC twice returns the same room (existing-room redirect)
- Unauthenticated caller receives `not_authenticated` error
- Join code is a 6-character numeric string

---

## Validate the Hook (Jest)

```bash
npm test -- --testPathPattern=useHostRoomCreate
```

Expected: all cases pass, including:
- `isCreating` transitions from `false` → `true` → `false` across a call
- On success: navigation is called with `sessionId`, `joinCode`, `hostParticipantId`, `hostDisplayName`
- On RPC error: `error` state is set and navigation is not called

---

## Validate the Full Flow (Playwright BDD)

```bash
npm run test:e2e -- --grep "host creates room"
```

Expected: the `host-create-room.feature` scenario passes:
1. Host is signed in
2. "Create Room" button is visible on home screen
3. Tapping it navigates to `app/lobby/[sessionId]`
4. Lobby screen shows a 6-digit numeric join code

---

## Manual Smoke Test (Web)

1. Open `http://localhost:8081` in a browser
2. Sign in as a host
3. Verify "Create Room" button is visible on the home screen (not visible when signed out)
4. Tap "Create Room"
5. Verify the app navigates to the lobby screen immediately
6. Verify a 6-digit numeric join code is displayed prominently
7. Verify the host's display name appears in the participant list
8. Tap "Create Room" again from a second browser tab (same host account) → verify both tabs navigate to the **same** lobby (existing-room redirect)

---

## Contract Reference

- RPC signature: [contracts/create_room_as_host.sql](contracts/create_room_as_host.sql)
- TypeScript interface: [contracts/HostRoomRpcClient.ts](contracts/HostRoomRpcClient.ts)
- Data model: [data-model.md](data-model.md)
