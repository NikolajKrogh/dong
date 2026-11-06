# Validation Quickstart: Active Game Goal Notifications

Run these checks after implementing the plan. Use the original DONG checkout, an isolated local Supabase stack and an isolated HTTPS preview for Android delivery, and the restricted production installation for physical iPhone verification. Use synthetic catalog observations only in isolated environments. Keep local keys and provider endpoints out of tracked files and logs.

## Local setup and automated checks

From the repository root, use the project's installed CLI and dependencies. Ensure the configured client URL points to the local stack before starting Expo. Use the local publishable key and place sender test secrets in an ignored env file. Confirm the database target before running the reset command.

```powershell
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:types:check
npm run typecheck
npm run typecheck:edge
npm run lint
npm run test:ci -- --runInBand
npm run test:e2e
```

For a live local worker check, serve the functions with the repository CLI and a local test env file, and run Expo in another shell. Use the test transport by default so isolated fixtures do not contact push providers. Generate a separate preview VAPID pair for the physical delivery check.

```powershell
npx --no-install supabase functions serve --env-file .env.goal-notifications.local
npm run web
npx expo export --clear --platform web
```

Confirm the export includes the manifest link, manifest and push worker. On the isolated HTTPS preview, request `/manifest.webmanifest` and `/goal-push-sw.js` directly. Verify the manifest body parses as JSON and the worker has a JavaScript content type and contains the expected worker code. Cloudflare Pages can serve SPA HTML for a missing asset even when the response is HTTP 200. Check revalidation and worker scope, then reload the alert route directly and confirm that the SPA fallback handles that route. A phone accessing the PC over plain LAN HTTP is not the HTTPS preview.

## Acceptance scenarios

| Exercise | Expected outcome |
| --- | --- |
| Test notification | A user gesture requests permission. Only the requesting installation receives a fixed test message. The UI labels provider acceptance as handoff. Denied permission gives recovery instructions and no repeat prompt. |
| Opt-in to live eligibility | Enable from the active game UI using the controlled transport. Verify registration and acknowledged bind for signed-in, guest and solo play. Seed a pre-existing score and then accept a fresh goal. Only the fresh goal produces a logical delivery. |
| Active-game scope | Seed two active participants, assignments and a common match. Set one player to all-room scope, leave the other at B. Accept fresh changes for an assigned, common and unassigned pool match. Only the eligible player receives each change. Toggle common-match preference and confirm it applies in both scopes. An unassigned fixture with no fresh accepted evidence creates no alert or additional provider demand. |
| Scope and identity boundaries | Reassign and re-add a fixture. Change A/B in two tabs. Reconnect the same participant, then start a new session. Check no historical goal replay, stale revision handling, same-session retention and reset to B. Attempt cross-player changes, wrong grants, revoked or rotated credentials, and a second browser. |
| Solo and stop behavior | Bind a finite solo grant, change the admitted match set and end it with the acknowledged stop operation. End or leave a room and sign out. Verify zero later final authorizations for the stopped scope. Pause a send before final authorization, acknowledge the stop, then resume and confirm no network attempt. Repeat with the stop after final authorization but before network handoff and record the possible racing send. |
| Offline sign-out and account switch | Sign out without connectivity. Verify local sign-out and the pending stop message. Reopen or reconnect and verify retry using the old installation generation without account credentials. Sign in as a different account and verify fresh opt-in. Replay the old stop after new enrollment and verify the new enrollment remains active. |
| Permission and endpoint recovery | Revoke or reset browser permission and reopen DONG. Verify consent clears, recovery instructions appear and fresh opt-in is required. Expire only the endpoint while permission remains granted. Verify repair preserves the same player's settings, uses a fresh baseline and retires the old endpoint. A temporary failure or Apple 403/404 preserves enrollment. |
| Foreground feedback | With host and guest both in a room, accept a fresh provider goal. Toast and sound respect local settings. Rejoin/refresh and verify no replay. With push enabled, a visible game still receives an eligible push. |
| Score and worker failures | Replay adjacent observations, enrich late goal detail, retract an unsent goal, and produce shootout-only and unknown-baseline changes. Simulate parallel claims, worker crash, 429, transient failure, invalid endpoint and a lost send response. Across 100 controlled duplicate, retry and enrichment cases, assert one logical delivery per eligible change and browser, and zero baseline or historical deliveries. Verify stable retry identity, original expiry and intact score acceptance and room replay. Record device presentation separately. |
| Sender compatibility | Verify rounding the remaining TTL to zero produces no HTTP request. Check that the Topic is stable across retries and is 32 lowercase hexadecimal characters. Classify Apple 410 as endpoint expiry, 404 as an invalid path and 403 as an authentication error. Verify Mozilla 404 with errno 102 and documented 410 endpoint errors retire only the invalid endpoint. Check Apple VAPID JWT reuse for the same push origin and key across repeated sends and a worker restart. Record only redacted outcomes. |
| Scheduler boundary | Before writing dispatch, inspect effective read privileges for `net.http_request_queue` in the isolated stack, including app roles and inherited access. Inspect permissions and request shape without dumping credentials. Use only a dispatcher-scoped proof in the queued request. Verify ordinary user and publishable credentials, invalid proof, and invalid, expired or consumed leases are rejected before claims or sends. |
| Permission and rollout states | Count the DONG interactions to enable and disable for an eligible installation. Revoke permission externally, return to DONG and check for recovery guidance with no repeat prompt. Try enrollment without pilot approval and on a public iPhone awaiting verification. Verify neither prompts for permission or sends. |
| Safe link and rollback | Tap an eligible alert, then tap an alert after game exit or access expiry. Confirm guarded routing and generic fallback. Disable the server-side switch and send schedule with pending work. Verify no new final send authorization, no new sender wakes, and database-only cleanup meeting both retention limits. Check that gameplay and history still function. |

Use existing catalog SQL fixtures and the server-authoritative gameplay browser journey. Playwright may simulate push permissions and worker events to validate routing and UI. It cannot prove that the OS presents a delivered notification.

## Enrollment service configuration

The endpoint is disabled by the database policy until a target is approved for testing. Use a server-only database login granted `goal_notification_backend`. For the isolated Supabase Edge container, connect through its `db` alias with `GOAL_NOTIFICATION_ENVIRONMENT=local`. Remote database connections verify TLS. Configure `GOAL_NOTIFICATION_DATABASE_URL`, `GOAL_NOTIFICATION_ENVIRONMENT`, exact `GOAL_NOTIFICATION_ORIGINS`, a 32-byte base64url `GOAL_NOTIFICATION_CONTROL_KEY`, and the environment's `GOAL_NOTIFICATION_VAPID_KEY_ID`, `GOAL_NOTIFICATION_VAPID_SUBJECT`, `GOAL_NOTIFICATION_VAPID_PUBLIC_KEY` and `GOAL_NOTIFICATION_VAPID_PRIVATE_KEY`. Configure `GOAL_NOTIFICATION_DESTINATIONS` as a server-side JSON object keyed by target, with verified `origin`, `pathPrefix` and `provider` entries. Leave `ECE_KEYLOG` unset. Store credentials outside Git.

## Local implementation evidence

- 2026-11-06. Started a dedicated local Supabase stack on API port 59321 and database port 59322. Applied the private enrollment migration there. All 15 focused pgTAP assertions passed. The scheduler queue privilege check is recorded in [research](research.md#bound-independent-scheduling-and-storage). The HTTPS preview is pending.
- The pinned Deno Edge typecheck and five focused contract/transport tests passed. The tests exercise request validation, allowlisting, provider response classification and the encrypted request with a mocked transport. The local Supabase Edge runtime accepted the status and registration flow, rejected incorrect origins, keys and destinations, and returned the same credential for exact registration replay. A controlled push transport verified the fixed alert, replay and cooldown with the real local database. Both notification pgTAP files pass with 38 assertions, including registered session revocation, guest expiry and solo grant authority. Apple cross-worker verification remains open.
- The local Expo export included the manifest link, JSON, icons and push-only worker. On Android 10 and Chrome 156.0.8078.75, Playwright connected to Chrome through an ADB forward. The active game opened Game actions. Preferences opened Sound & notifications. The loopback origin was a secure context with service workers and PushManager. Notification permission was initially default.
- On the phone, axe reported zero violations on the active-game screen and Preferences overview. The existing Sound & notifications screen reported the label rule for its switches. This is baseline UI evidence.
- A simulated Chrome DevTools push exercised the local worker. ARTEMIS observed the fixed DONG test message in the Android tray. This verifies local presentation. The push-provider handoff, closed-tab delivery and phone browser matrix are still pending.
- The in-game controls passed four phone-viewport Chromium scenarios with controlled endpoints. They cover enrollment and test acceptance, direct opt-out, an offline stop retried on reconnect, browser permission revocation, and iPhone tab guidance. The registered controls passed the scoped axe audit. The isolated database passed 46 enrollment and opt-out assertions. The app and Edge typechecks, focused lint, React Doctor and seven existing game screen tests passed.
- The first Android CDP follow-up stopped when the phone slept. With USB reconnected and the phone awake, Playwright passed access-code setup, registration, test acceptance and opt-out in Chrome 156.0.8078.75 on Android 10 using controlled endpoint responses. Axe found zero violations in the setup and registered controls.
- A separate secure loopback fixture used the repository worker, a real Chrome subscription and the encrypted sender. The subscription used `fcm.googleapis.com/fcm/send/[redacted]`. FCM returned HTTP 201 with the tab visible and again after closing the only tab on the fixture origin. Chrome reported the foreground notification. ARTEMIS directly confirmed the exact test title and body under the fixture origin in the expanded Android tray after a closed-tab send. The autonomous tray run had stalled, so ADB opened and scrolled the shade for the ARTEMIS observation.
- The isolated HTTPS preview with actual enrollment, Edge test authorization and the production-style origin remains pending. The loopback fixture used a temporary browser permission override and invoked the encrypted sender directly.
- Browser enrollment prepares the worker and checks pilot access before the enable tap. The tap calls `PushManager.subscribe` directly to preserve user activation. [Apple Web Push guidance](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

To run the focused Deno tests with the pinned package in a local shell, leave encryption key logging disabled.

```powershell
Remove-Item Env:ECE_KEYLOG -ErrorAction SilentlyContinue
npx --yes deno@2.9.6 test --no-config --no-lock --node-modules-dir=none --allow-env=ECE_KEYLOG,DEBUG,NODE_DEBUG supabase/functions/_shared/goal-notifications
```

## Phone evidence and staged enablement

1. Issue invited testers short-lived, single-use grants for the isolated HTTPS preview and target. Enroll Android Chrome, Firefox and Samsung Internet where available on the user's Android device. Record the phone, OS and browser versions. Use Playwright and axe for Android web UI checks and ARTEMIS for the notification tray. Test visible, background and closed-tab delivery, permission revocation/recovery, tap routing and stop behavior. Request the fixed test alert on each configuration and record the handoff result separately from device presentation. Verify the push endpoint family during each enrollment, including Samsung Internet before allowlisting it. Record the host and path pattern with the opaque token segment redacted.
2. Record SC-001 with 20 controlled eligible alerts per supported and healthy configuration. At least 19 must display within 30 seconds after DONG accepts the evidence. Record offline and battery-restricted results separately, with source, handoff and presentation timestamps. Confirm zero extra provider polling and acceptable notification resource usage.
3. Android can pilot after its own gates pass. Issue separate live-pilot grants only after verifying the target configuration. Confirm that another installation or environment cannot reuse the approval.
4. Once automated, capacity and rollback gates pass, issue a production-only verification grant for one physical iPhone. Add the production DONG site to the Home Screen, open it from the icon and redeem the grant there. Check installation guidance, storage separation, sign-in/rejoin, the fixed test alert, closed delivery, Notification Center and opt-out. Tap a live alert with DONG open and again after fully closing the Home Screen website. Confirm both reach the intended authorized game in the installed context. After access expires, confirm the guarded route shows the generic fallback. Record the iOS version and results for both tap paths. Use real accepted goals in the tester's active game for live delivery, tap and SC-001 timing. Confirm another installation sees the awaiting-verification state without a permission prompt and receives no sends. Verify the test approval expires or can be revoked and remove it when testing ends. Keep public iPhone enrollment and sends disabled until these checks pass.
5. Before the first production cohort, record measured limits for p95 queue age, worker CPU, invocation usage and database headroom. Compare score acceptance, room processing and ESPN requests with notifications disabled. Pause sends immediately for any wrong-recipient delivery, privacy disclosure, send past the deadline or notification-caused regression in those gameplay metrics. Hold expansion for a miss on the 19-of-20 device target or any measured capacity limit. Keep handoff metrics and device display evidence separate. Rehearse rollback by disabling sends and the send schedule while keeping database-only cleanup active. A push with final authorization before shutdown can still arrive.

Connect Playwright to the physical Android Chrome browser through an isolated ADB forward and run axe in the page. Use ARTEMIS to inspect the Android notification tray. The physical iPhone check uses the production Home Screen website and Notification Center. Separate lock-screen verification is outside the release matrix.
