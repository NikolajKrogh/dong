# Multiplayer runtime bug log

## BUG-001 — Web host setup cannot load match fixtures

- Platform: Web (`http://localhost:8081/setupGame`)
- Repro: Start New Game → add two players → Next to Matches.
- Expected: Match fixtures load so the host can select/add a match and continue the multiplayer setup.
- Actual: The match panel displays `The upstream match provider returned an invalid response.` and `No matches added yet!`; no usable match fixtures are available. The visible `Next` control reports enabled in the browser automation layer, but activating it leaves the user on the Matches step without an explanatory validation message.
- Evidence: Visible in the live browser DOM/screenshot on 2026-09-11. Browser console emitted `Error fetching teams: The upstream match provider returned an invalid response.` at 2026-09-11T17:34:20.674Z. Direct `GET http://localhost:8080/v1/matches?leagueCode=eng.1&requestedAt=2026-09-11T00%3A00%3A00.000Z` returned HTTP 502 with `{"error":"UPSTREAM_BAD_RESPONSE","message":"The upstream match provider returned an invalid response."}` and request id `78742032-f803-4818-b1ce-29590e78c9c0` at 2026-09-11T17:38:20Z. The matching command-api log traces the exception to `RestClientEspnClient.fetchScoreboard(RestClientEspnClient.java:49)` while handling an upstream response; the exact upstream status is not included in the supplied log. A direct host request to the configured ESPN scoreboard URL returned HTTP 200 at 2026-09-11T17:38:50Z, so the proxy request/response mismatch still needs isolation.
- Scope: Blocks the normal fixture-based host flow before active multiplayer gameplay. Investigate provider response/adapter and whether the UI should offer a resilient manual-match fallback.
- Resolution: Fixed in `command-api/src/main/java/com/dong/commandapi/match/espn/RestClientEspnClient.java` by sending an explicit JSON `Accept` header and a descriptive project `User-Agent` with contact URL. ESPN returned HTTP 403 to the prior JDK default identity and HTTP 200 with the new request headers. Added header assertions to `RestClientEspnClientTest`.
- Verified: `RestClientEspnClientTest` passes; after restarting command-api, the live `GET /v1/matches` request for `eng.1` on 2026-09-12 returned HTTP 200 with seven normalized fixtures and request id `33f90a35-b5e4-461c-a4c2-a9cbe17b1c45` at 2026-09-11T17:48:01Z.
- Verified: The original default date, 2026-09-11, now returns HTTP 200 with an empty JSON array (no upstream error). A live hosted-room setup on 2026-09-12 also confirmed `SetupWizardNext` exposes `aria-disabled="true"` while the match pool is empty; adding provider matches enables the flow.

## BUG-002 — Android Start Game crashes because Tamagui PortalProvider is missing

- Platform: Android physical device `WCR0218C11000221` (CLT L29, Android 10)
- Repro: From setup, add a second player, choose a fixture date with results, add matches, select a common match, tap Randomize Matches, then tap Start Game.
- Expected: The game-progress screen opens.
- Actual: The device shows the Expo render-error screen and does not enter gameplay: `'PortalDispatchContext' cannot be null, please add 'PortalProvider' to the root component.`
- Evidence: Reproduced on 2026-09-11 at approximately 19:55 CEST. The visible stack points to `@tamagui/portal/dist/esm/GorhomPortal.native.js (80:41)` and `components/gameProgress/FooterButtons.tsx` (`FooterButtons` around line 36). Web reached `gameProgress` with the same setup, so this is currently Android-specific.
- Live two-device reproduction: On 2026-09-12, an authenticated web host created room `801864`, an Android guest joined successfully, and the host advanced through match selection, common-match selection, and assignment. Starting the shared game navigated the web host to `/gameProgress` (`Shared game · synced`), while the physical Android guest immediately showed the same Expo render-error screen and stack. The ARTEMIS hierarchy also showed the exact source line and `Render Error` heading.
- Scope: Blocks physical Android multiplayer/gameplay validation after setup. Inspect the native root provider composition and the `FooterButtons` portal usage.
- Recovery: Tapping `Dismiss` on the render-error screen leaves the Android app on a blank dark screen; the app must be relaunched/reloaded before another flow can be attempted.
- Resolution: Added exact direct dependency `@tamagui/portal@2.7.7`, which hoists the portal implementation shared by `TamaguiProvider` and `Sheet`; no redundant root provider was added.
- Verified: `npm ls @tamagui/portal --all` reports every Tamagui consumer deduped to the single root package. The portal-resolution regression test and an open real-Sheet render under `TamaguiAppProvider` pass. After rebuilding the development client, physical Android guest `AndroidGuesty` entered hosted room `660451` and `/gameProgress` with `Shared game · synced`; neither the UI nor filtered logcat contained `PortalDispatchContext` or a render error.

## BUG-003 — Android dev-client reload cannot reach the configured Metro host

- Platform: Android physical device `WCR0218C11000221`
- Repro: After the render error, force-stop and relaunch `com.krogh.dong.dev`.
- Expected: The dev client reloads the app bundle and returns to the app.
- Actual: The screen enters a blank/dark loading state after briefly showing `Loading from 10.0.0.3:8081...` and does not return promptly; after several minutes it eventually recovered to the persisted home screen.
- Evidence: On 2026-09-11 at approximately 19:58 CEST, `adb reverse --list` showed `tcp:8080` and `tcp:8081`, but the app still targeted `10.0.0.3:8081`; `adb shell ping -c 1 -W 2 10.0.0.3` reported 100% packet loss. By approximately 20:02 CEST the app had recovered and displayed the persisted game home screen. This is a dev-client/tunnel configuration blocker rather than a gameplay assertion.
- Scope: Causes an unreliable, multi-minute Android rerun after a crash and may mask subsequent app behavior. Align the native dev-server host with the configured ADB reverse/tunnel strategy (or make the LAN host reachable) before relying on repeated physical-device smoke runs.
- Resolution: `android:tunnel` now reverses command-api `8080` and Metro `8081`; `android:dev` establishes both tunnels and launches Expo with `--dev-client --android --localhost`. On Windows the script also starts Node with `--dns-result-order=ipv4first`: without it Expo advertised `127.0.0.1` but bound Metro only to `::1`, which reproduced an `unexpected end of stream` load failure through ADB reverse. The dev-client plugin uses Android fallback URL `http://localhost:8081` with `most-recent` launch mode, and the README documents the one-time rebuild requirement.
- Verified: Expo prebuild configuration resolves the new dev-client settings, the native development client rebuilt and installed successfully, `adb reverse --list` contains both mappings, Metro listens on `127.0.0.1:8081`, and its launch URL is `http://127.0.0.1:8081` rather than `10.0.0.3`. A measured force-stop/cold relaunch reached the persisted app home in 3.3 seconds.

## BUG-004 — Android invalid guest join leaks a raw unhandled-promise toast

- Platform: Android physical device `WCR0218C11000221` (CLT L29, Android 10)
- Repro: Open Join as a guest, enter room code `000000` and guest name `AndroidGuest`, then tap Join Room.
- Expected: The modal shows only the actionable room-not-found message and allows the guest to correct or retry the form.
- Actual: The modal shows the correct `We couldn't find that room. Check the code and try again.` message, but Android also displays one or more dark error toasts reading `Uncaught (in promise, id: 0) Object {...}`. The accessibility hierarchy exposes the underlying `room_not_found` payload, including Postgres code `P0001`.
- Evidence: Reproduced on 2026-09-11 at approximately 20:11 CEST. Screenshot captured from the physical device shows two stacked raw error toasts below the guest modal; ARTEMIS hierarchy includes `Uncaught (in promise, id: 0) Object { ... "code": "P0001", "message": "room_not_found" }`. `adb logcat` records the same ReactNativeJS unhandled promise error.
- Scope: Leaks implementation/database details to users and duplicates a handled validation error. Compare the guest-join error boundary/async handling on native and web; the expected user-facing message should be the only error surface.
- Comparison: Repeating the same invalid code/name on web shows only the friendly validation message in the modal, with no raw error toast. This makes the leak Android-specific in the tested build.
- Static cause: `hooks/useGuestRoomSession.ts` catches the RPC error, stores the friendly message, and rethrows it; `app/index.tsx` invokes `submitGuestJoin(...)` with `void` and no rejection handler. The native dev client surfaces that rejected promise as the raw toast.
- Coverage note: The focused guest-session/form tests pass (`2` suites, `11` tests), but they do not assert that the native submit boundary consumes the rejected promise, so they miss this runtime surface.
- Resolution: `useGuestRoomSession.joinRoom` now converts handled RPC/room/transport failures to `null` after setting friendly state instead of rethrowing. Its existing nullable contract and pending guest-token retry behavior are preserved.
- Verified: Focused hook tests now assert `null`, `failed`, friendly copy, cleared submitting state, no session persistence, and token reuse; all pass. On the rebuilt physical Android client, submitting room `000000` displayed only `We couldn't find that room. Check the code and try again.`; the hierarchy contained no raw error and filtered logcat contained no `Uncaught (in promise)`, `PortalDispatchContext`, `P0001`, or `room_not_found` hit.

## BUG-005 — Gameplay sheets are clipped or translated off-screen

- Platform: Web (`http://localhost:8081/gameProgress`), authenticated host session
- Repro: Start a real room, enter `/gameProgress`, then activate the floating `Open game actions` control at the bottom-left of the gameplay screen.
- Expected: The action sheet/menu renders visibly over the gameplay screen so the host can choose its actions or close it.
- Actual: The browser accessibility tree exposes the `Reassign matches` sheet content, participant selector, match list, `Cancel`, and `Save assignments`, but the visible browser screenshot becomes an almost entirely blank white viewport with only the top sheet handle/edge. The gameplay cards and the sheet's visible controls are not visually usable.
- Evidence: Reproduced twice on 2026-09-12 in the authenticated room `801864` after `/gameProgress` loaded with `Shared game · synced`; a reload restores the normal gameplay screenshot, and activating `Open game actions` deterministically returns the white viewport while the AX tree still contains the reassign controls.
- Scope: Blocks visually driven host actions from the gameplay screen and makes the reassign/action-menu path unusable in the tested web build. Investigate the web `Sheet`/portal rendering and backdrop/layout behavior.
- Additional symptom: The host reassignment sheet is present in the DOM but translated below the viewport with inactive pointer events, while the game-actions sheet is clipped to its handle/edge and its controls overflow outside the visible frame.
- Resolution: Corrected percent-mode snap points from invalid percentage strings to numeric values (`32` for game actions and `80` for reassignment), made sheet position controlled with an explicit `quick` animation, removed reassignment frame sizing that conflicted with the snap height, and kept the host reassignment control mounted during periodic refreshes. Stable frame test IDs support geometry checks.
- Verified: Focused component tests cover numeric configuration plus opening/closing. All ten server-authoritative Playwright scenarios pass on phone-sized and desktop-wide Chromium using normal clicks and viewport/pointer-event checks. Live desktop web showed the complete reassignment sheet and game-actions controls. Physical Android rendered `GameActionsSheetFrame` at `[0,1578][1080,2037]` with visible `Home` and `Setup` actions, then dismissed it normally.
- Maintenance follow-up: Removed the local one-line `components/ui/Sheet.tsx` re-export. Both gameplay controls now import Tamagui's maintained `Sheet` directly from `tamagui`; no custom sheet implementation remains.
- Follow-up verification: On the current post-refactor bundle, live desktop web opened and dismissed both the game-actions and reassignment sheets with all controls visible. Physical Android opened the game-actions sheet with visible `Home` and `Setup`, dismissed it through the backdrop, and returned to `Shared game · synced`; filtered React Native logs contained no `PortalDispatchContext`, render, unhandled, or uncaught error.

## GitHub rollout audit — 2026-09-12

Project: `Dong Multiplayer Rollout` (40 tracked items).

- Marked Done: `#116`, `#134`–`#137`, `#184`–`#186`, and `#190` cover room lifecycle, host setup, guest presence, assignment modes, reassignment, and the server-authoritative gameplay foundation.
- Still Todo/open: `#119`, `#138`–`#141`, and `#165` cover live gameplay sync, goal/drink synchronization, reconnect recovery, final history, and early leave. Open hardening/release issues include `#191` and `#192`.
- Verified locally: web fixture loading and setup reach `/gameProgress`; an authenticated room reached `/gameProgress` with `Shared game · synced`; the host player drink mutation persisted through reload; Android guest validation and invalid-room messaging render.
- Verified on 2026-09-12: an authenticated web host room plus a real Android/web two-device lobby session. Android joined room `801864` and both clients listed `DONG Web Host` and `DONG Android Guest`; starting the shared game still reproduces BUG-002 on Android.
- Verified after fixes on 2026-09-12: web host room `660451` plus physical Android guest `AndroidGuesty` entered shared gameplay without a portal error. A web drink mutation from `0.0` to `0.5` appeared on Android after synchronization. Host reassignment moved `DONG Web Host` from Swansea City–Burnley to Watford–Stoke City; the hosted database and Android match chips both reflected the new assignment.

## Final regression verification — 2026-09-12

- Playwright: all 124 generated BDD cases passed across the phone and desktop Chromium projects (`62/62` each) using one worker and a fresh Expo web-server process per project. Running both projects in one long-lived process exposed an unrelated Expo export-server heap leak (approximately 4 GB per project), so the projects were isolated to keep the test result valid.
- Jest: all 98 suites and 562 tests passed. The repository's known late Expo logger callback still makes the aggregate Jest process exit non-zero after completion; the five focused changed-area suites exit cleanly.
- Backend: `command-api` clean Maven verification passed (`87` tests), and live populated-date and empty-date `/v1/matches` requests both returned HTTP 200 with normalized fixtures and `[]`, respectively.
- Build/static gates: ESLint completed with zero errors (existing warnings remain), Expo web export completed, and Expo config resolution contains the expected dev-client fallback. React Doctor could not run because Windows Application Control blocked its downloaded native `oxc-resolver` binding; TypeScript's repository-wide check retains pre-existing failures outside this change set.
