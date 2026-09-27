# Physical Android verification — 2026-09-26

Device: Huawei CLT-L29, serial `WCR0218C11000221`, sole authorized ADB device.
Scope: existing hosted pre-release DONG backend; preserve app/user data.

## Findings as observed

### AND-191-01 — installed client missing ExpoCrypto

- Initial ARTEMIS hierarchy showed an uncaught `Cannot find native module 'ExpoCrypto'` overlay originating in `platform/guestCredential/index.native.ts`.
- Repro: open the currently installed development client with the updated JavaScript.
- Expected: app opens with native random generation and protected storage available.
- Actual: module-load error blocks the app.
- Status: resolved. Installed the rebuilt debug APK in place; the physical app reached Home and the ExpoCrypto startup overlay did not return. No app-data clearing or uninstall performed.

## Execution evidence

- `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` succeeded; package `com.krogh.dong.dev`, lastUpdateTime 2026-09-26 15:00:04. No uninstall or data clear.
- Existing Metro on host port 8081 timed out on `/status`. Started a separate development server on 8082; its `/status` returned 200. Device reverse mappings: 8082→8082, 8081→8082, 8080→8080. Existing host server was not stopped.
- The initial app launch stayed on the development splash while the user restarted the host. With the 8082 development server and device reverse mappings active, the rebuilt client reached DONG Home; later normal recents dismissal and relaunch also succeeded.
- After that relaunch, Home still showed the pre-existing local game with 2 players and 12 matches. It remained intact throughout the guest-room smoke.
- Hosted room setup and participant changes are recorded below; all Android changes were limited to the test identities in the fresh test room.

## ARTEMIS + web continuation

- ARTEMIS diagnostics: ready, physical device observation verified. Android now reaches home after the upgraded install; native-module startup error no longer occurs.
- ARTEMIS trace `3b7334bb-3f3f-4ed7-8bd9-730e9fd67e82` restored AndroidGuesty into hosted room `744e9bd5-06c6-4629-a229-37013ef2d45d`. Android hierarchy and web host both showed the same two participants. Trace completed; transient provider 503 retried successfully; filtered app error logs were empty.
- User explicitly approved ending that existing room normally and creating a fresh test room. Web `End game for everyone` → confirmation `End game` completed it. Hosted read-only check confirmed `completed` with seven events retained. Android automatically changed to `Current state: completed` and `Final results only. Room actions are no longer available.`
- Created fresh room through signed-in web host UI: `13909858-4e34-4f22-b6aa-1a411fd98f85`. Android joined it as Android191, later rejoined as ReopenTest for the active-session reopen check, and confirmed departure from that guest identity.

### AND-191-02 — completed guest cannot exit to join another room

- Repro: web host ends the existing room; Android displays `Current state: completed` and final-results-only notice; tap `Leave Guest Room`.
- Expected: a safe way to release completed-room access and join a new room without changing finished history.
- Actual: `You cannot leave while this game is in progress. Your guest access remains active.` The completed guest stays connected and cannot reach the fresh-join form.
- ARTEMIS trace `1608bf5b-fd65-4e3f-aaf7-63a0b4c68913`, stdout lines 179–183, records the failed UI step. Initial trace summary misleadingly reported zero image/step compilation; full stdout confirms the tap and domain error. This is an application failure, not merely the transient provider 503 also present in the trace.
- No bypass, app-data reset, or manual credential deletion performed. The failure blocked fresh join until the approved server correction was deployed.
- Cause: `private.leave_room_as_guest` rejects every state other than `joinable`, including `completed`; the client maps this denial to in-progress wording and restores the grant. Existing lifecycle test covers completed read then closed read, but never completed leave. This conflicts with the specification's final-read access lasting until expiry **or leave**.
- [Physical completed-room screen](evidence/android-completed-room.jpg). The completed-room leave path was retested successfully after deployment.
- User approved correction and deployment. Added six lifecycle assertions; three failed on the prior implementation. Forward migration `20260926141945_completed_guest_exit.sql` expires only completed guest credentials, preserving all other participant fields and the entire event stream. Zero-duration grants are permitted for immediate same-transaction revocation. In-progress leave remains denied.
- Local full database suite at that stage: 48 files / 693 assertions passed. Deployment dry run contained only this migration; hosted push succeeded with Vault updates skipped. No existing room data changed by the migration itself. The later roster migration and 694-assertion result are recorded in the main verification report.

### AND-191-03 — room snapshot included departed guests

- Before correction, guest and host rosters showed previously departed Android test identities as active guests. The fresh-room snapshot contained the expired Android191 identity and two departed identities; the latter had `left_at` set.
- Cause: migration 038 replaced `private.build_guest_room_snapshot` and omitted its `left_at IS NULL` filter. This contradicted FR-008 and enlarged the guest card until its Leave control required scrolling.
- Forward migration `20260926143559_active_guest_roster.sql` restored the filter. The 18-assertion lifecycle test and full 48-file / 694-assertion database suite passed. Hosted snapshot and web host now omit all departed test participants; function grants remain service-role-only.
- The deliberately expired Android191 test row had `left_at IS NULL`, since expiry was simulated directly. It therefore remains displayed as a guest even though its bearer is expired. Whether expired-but-not-departed guests should be hidden or labeled is a separate product-policy question; no participant rows were deleted or rewritten for this fix.
- Evidence: [pre-fix joined roster](evidence/android-reopened-guest.jpg), [fresh join](evidence/android-fresh-join.jpg), [expired access (room code redacted)](evidence/android-expired-access-redacted.png).

### Native credential storage and session lifecycle

- While ReopenTest was joined, SecureStore contained an AES-encrypted credential record; no plaintext guest token field was present. AsyncStorage contained no guest keys, bearer fields, or protected-record key rows.
- After expiry, the Android poll cleared the credential and displayed `Your guest access is no longer valid. Ask the host for a fresh invitation.` A fresh join then worked.
- Dismissing the active guest card and choosing `Return to Guest Room` restored the same ReopenTest participant. The subsequent confirmed leave set `left_at`, kept the still-future expiry distinct, and removed the SecureStore credential.
- After leaving, dismissing DONG from Android Recents and launching it again returned to Home without a guest session. The unrelated local game still showed 2 players and 12 matches.
- Evidence: [reopened guest card](evidence/android-reopened-guest.jpg), [post-relaunch Home](evidence/android-relaunched-home.jpg), [post-leave guest screen](evidence/android-left-screen.jpg). The cold relaunch was after departure; it did not test restoring an active guest process from a cold start.

### Completed-room fix retest

- Android successfully left the completed room after the deployed correction. Hosted inspection confirmed its credential expired, historical participant left_at unchanged, and all seven events retained.
- Fresh Android191 join succeeded through the native UI and appeared in the web host roster. New native credential used SecureStore AES ciphertext with no plaintext token fields.

- Read the debuggable app's SecureStore XML in memory: guest credential entry present, scheme `aes`, ciphertext present, no plaintext token field. After confirmed leave and expiry, the credential entry was absent.
- Read AsyncStorage SQLite in memory: zero guest-related keys, zero rows containing guestToken/replacementToken fields, zero protected-record-key rows. No credentials printed or copied into evidence files. This verifies live rows, not forensic erasure of historical SQLite free pages.

## 2026-09-26 expiry-aware active-roster verification (T069)

- Device: Huawei CLT-L29 (`WCR0218C11000221`). Used the already-approved pre-release room `13909858-4e34-4f22-b6aa-1a411fd98f85`; no join code or bearer is included in this report or screenshot.
- Android joined as the test guest `DONGQaGuest191y`. Before expiry, the host browser listed that guest. The hosted snapshot contained 4 `participants` and 3 `activeRoster` entries; the test guest appeared in both, with `left_at` null and a future grant expiry.
- Simulated expiry with a guarded update to only this new test participant's grant timestamps. The room remained `joinable`; no other participant was changed.
- After the next host refresh, the browser roster contained only `DONG Web Host` and the still-valid `Expired Guest`. The server snapshot retained all 4 `participants`, including `DONGQaGuest191y`, while `activeRoster` fell to 2 and excluded that guest. The test participant still had `left_at` null; its history showed one `participant_joined` event, zero `participant_left` events, and the room retained 7 gameplay events.
- Android's next refresh displayed `Your guest access is no longer valid. Ask the host for a fresh invitation.` The screenshot was captured with the low-entropy join code cleared: [expired guest recovery and roster state](evidence/android-expired-active-roster-20260926.png).
- QA input caveat: ADB `input text AndroidRosterCheck` triggered `ReactHostImpl.getOrCreateReloadTask`; injecting `RR` into the focused guest-name field reproduced the same Expo dev-client reload. A name without `R` stayed in the form and joined successfully. Logcat showed the React instance restarting and `Running "main"`, with no `FATAL EXCEPTION`. Treat this as the dev-client keyboard shortcut interacting with ADB key synthesis, not as a guest-room/backend failure; avoid R-key sequences in ADB-injected test names.
