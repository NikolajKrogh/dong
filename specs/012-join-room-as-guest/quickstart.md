# Quickstart: Join Room as Guest

## Prerequisites

- Set the Supabase client environment variables expected by the app.
- Run the local Supabase stack that backs the multiplayer schema and RPCs.
- Keep the current Expo web server or native dev client available for the guest-device journey.

## Local Validation

1. Start Supabase locally.

   ```bash
   npm run db:start
   ```

2. Reset the local database so the new guest-room RPCs, policies, and tests are applied from a clean state.

   ```bash
   npm run db:reset
   ```

3. Run the database test suite to verify the guest join command, replay safety, participant creation, and joinability checks.

   ```bash
   npm run db:test
   ```

4. Run the focused unit tests for the guest join and guest session hooks plus the home-owned guest modal surfaces.

   ```bash
   npx jest --runInBand __tests__/hooks/useGuestRoomJoin.test.ts __tests__/hooks/useGuestRoomSession.test.ts __tests__/components/guestJoin/GuestJoinForm.platform.test.tsx __tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx __tests__/app/index.platform.test.tsx __tests__/app/joinRoom.platform.test.tsx
   ```

5. Run the browser journey for the guest join flow.

   ```bash
   npm run test:e2e
   ```

6. Run lint before merge.

   ```bash
   npm run lint
   ```

## Manual Checks

- Open the home screen and confirm there is a guest join entry point.
- Join a joinable room from a second device using a valid room code and guest name.
- Confirm the first lobby render appears directly from the successful join flow and does not require a second loading cycle before the room content becomes usable.
- Confirm the lobby shows the guest participant and the room state matches the host device.
- Try a blank guest name and confirm the form rejects it.
- Join with the same guest name as another participant and confirm both guest rows are accepted.
- Retry the same join after a simulated lost response or double-submit and confirm the room still contains only one guest participant for that device token.
- Reload the guest device and confirm the stored grant restores the joined room.
- After a successful join or restore, confirm the home-owned modal switches into an active temporary-guest state, shows the room-scoped limitation copy, and offers a leave action instead of continuing to foreground the join form.
- Invalidate the stored guest grant or remove the guest participant server-side and confirm the app clears local storage and returns the guest to the home-owned join modal.
- Leave the room and confirm the persisted guest grant is removed.
- Start gameplay from the host device and confirm the guest sees the same state transition without rejoining.
- Repeat the join, lobby, gameplay-transition, and grant-recovery smoke path in a native dev client if automated coverage remains web-only.
