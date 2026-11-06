# Tasks: Active Game Goal Notifications

**Input**: [Spec](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [contracts](contracts/goal-notifications.md), and [validation guide](quickstart.md) in `specs/032-goal-notifications/`.

**Tests**: Constitution V requires unit, pgTAP and primary browser-journey coverage. Use one happy path for the notification browser suite. Use isolated fixtures. Explore the real Android browser with Playwright and axe before authoring mobile journeys. Use ARTEMIS to verify the Android notification tray. A separate lock-screen check is outside this validation matrix. Track a skipped device gate as unverified.

**Format**: `T### [P?] [US#?] Description`. Paths are relative to the repository root. `[P]` tasks in each listed parallel group can run once their prerequisites are complete. Generate migration timestamps with the repository migration command rather than using literal placeholders.

**Skills**: Before starting a task or review, use the [stage-to-skill guide](plan.md#skills-by-implementation-stage).

## Phase 1: Setup

- [x] T001 Reconciled CHK003, CHK008, CHK011 and CHK020 in `specs/032-goal-notifications/checklists/notifications.md`. Documented all-room score coverage, the final-authorization stop cutoff, logical deduplication and rollout verification in the feature spec, plan and supporting contracts.
- [ ] T002 Prepare the isolated local stack and HTTPS preview described in `specs/032-goal-notifications/quickstart.md`. Keep preview keys outside Git in `.env.goal-notifications.local`. Verify the target before resetting the local database. Leave goal delivery disabled. Check effective reader grants on `net.http_request_queue` in the isolated stack and record the dispatcher-only credential path in `specs/032-goal-notifications/research.md` before T016.

## Phase 2: Foundational work

- [x] T003 [P] Add browser and request contract types, limits and validators in `supabase/functions/_shared/goal-notifications/contracts.ts`. Define the registered, guest and solo proof variants, opaque identifiers, bounded payload and sanitized error outcomes from `specs/032-goal-notifications/contracts/goal-notifications.md`.
- [x] T004 [P] Define private subscription, consent, generation and delivery policy records, unique endpoints, default-disabled targets and enrollment limits in the notification migrations and pgTAP tests. Keep consent and generation separate from endpoint material. Verify environment isolation and that multiple iPhone Home Screen installations can enroll under the same limits.
- [x] T005 [P] Explore the existing active-game and settings entry points on the user's Android device, using Playwright over Chrome DevTools on the physical phone and axe for web accessibility. Record observed navigation and browser permission prerequisites in `specs/032-goal-notifications/quickstart.md` before authoring executable mobile journeys.

**Checkpoint**: Private storage and shared contracts are ready. Review and run local tests before using any external sender.

## Phase 3: User Story 1 — Enable and receive active-game goal alerts (P1)

**Goal**: An opted-in browser receives an eligible fresh goal alert when the game is visible, backgrounded or closed.

**Independent test**: With a fixture active game and default match scope, opt in, establish a baseline, introduce a new accepted score and observe one logical alert. Check visible and closed-tab presentation on a supported device. Permission denial and a pre-existing score leave gameplay usable and create no goal alert.

### Required coverage

- [ ] T006 [P] Keep one Playwright happy path in `e2e/features/goal-notifications.feature` and `e2e/steps/goal-notifications.steps.ts`. Exercise code-free opt-in, test handoff and opt-out with controlled responses, then cover game binding and a fresh goal in the main journey when live delivery is ready. Cover permission revocation, denied or disabled enrollment, and endpoint repair with focused checks outside the E2E suite.
- [ ] T007 [P] [US1] Add `supabase/tests/database/336_goal_notification_eligibility.test.sql` for registered host/participant, guest and solo proof, wrong-room and expired grant rejection, initial score baseline, unrelated matches and no growth in provider demand.
- [ ] T008 [P] [US1] Add sender and committed-evidence cases in `supabase/functions/_shared/goal-notifications/webPush_test.ts` and `supabase/functions/_shared/goal-notifications/scoreChange_test.ts`. Cover destination rejection, remaining TTL, accepted handoff versus receipt, normal score increases, unknown baselines, corrections, shootouts and late detail. Cover zero-rounded TTL, Apple 403/404 versus 410, and VAPID JWT reuse for the same origin and key across sends and worker restarts. Cover the 32-character hexadecimal Topic and distinguish Mozilla 404 with errno 102 and documented 410 endpoint errors from Apple's invalid-path response.

### Implementation

- [x] T009 [P] [US1] Add `public/index.html`, `public/manifest.webmanifest` and `public/goal-push-sw.js`. Preserve Expo SPA boot and same-origin asset paths. Display a valid received push promptly with the stable tag. Keep manifest scope and identity stable and omit general offline caching.
- [ ] T010 [US1] Implement bounded Web Push request generation and Fetch transport in `supabase/functions/_shared/goal-notifications/webPush.ts`. Validate HTTPS destinations, keys and provider paths, reject redirects, enforce timeouts, and redact secrets. Pin the sender candidate from research and extend `package.json` Edge checks. Confirm local Deno and Edge compatibility before preview. Skip sends without a positive remaining TTL. Reuse Apple VAPID JWTs by push origin and signing key with refresh no more than once per hour. Verify reuse before enabling production Apple sends.
- [x] T011 [US1] Implement registration, status and a throttled fixed test notification in `supabase/functions/goal-notifications/index.ts`. Use status to check target policy before permission. Recheck policy, current game proof and enrollment limits at registration. Restrict the test alert to the requesting installation and preserve safe registration replay.
- [x] T012 [US1] Add the platform adapter and unsupported/native fallback in `platform/notifications/goalNotifications.web.ts` and `platform/notifications/goalNotifications.ts`. Add explicit permission, setup/recovery and test controls in `features/game-progress/GoalNotificationSettings.tsx` and wire them into `features/game-progress/GameProgressScreen.tsx`. Distinguish registration, game enablement and receipt. Reconcile permission and subscription on launch or return to the foreground. Show Enable notifications directly once the server and browser are ready. Explain iPhone Home Screen setup and preserve tab data on sign-in/rejoin.
- [ ] T013 [US1] Validate the test-alert slice on Android Chrome in the isolated HTTPS preview. Verify exported assets and endpoint family. Check Android web UI with Playwright and axe and foreground/closed-tab presentation in the tray with ARTEMIS. Record version, evidence and observed failure/recovery in `specs/032-goal-notifications/quickstart.md`. This is the test-alert commit checkpoint.
- [x] T014 [US1] Add the `goal_notification_game_associations` migration via `supabase/migrations/` and implement bind/refresh in `supabase/functions/goal-notifications/index.ts`. Resolve authoritative room membership or finalized solo grant, persist the consent association and committed baselines, and use assigned-plus-common as the initial multiplayer scope. Wire the opt-in flow in `features/game-progress/GoalNotificationSettings.tsx` and `features/game-progress/useGameProgressController.ts` to bind after registration and show game enablement only after acknowledgment. Recheck consent, current identity, preference and finite eligibility at final send authorization.
- [x] T015 [US1] Implement match observation classification in `supabase/functions/_shared/goal-notifications/scoreChange.ts`. Read committed adjacent catalog versions. Use known goal details only when supported by evidence. Use neutral score updates when detail is uncertain and suppress baselines, retractions and enrichment replays.
- [x] T016 [US1] Add the `goal_notification_delivery` migration via `supabase/migrations/` and implement the independently scheduled sender in `supabase/functions/dispatch-goal-notifications/index.ts`. Bound scans, claims, attempts and expiry. Deduplicate by installation, match and accepted observation. Authenticate the scheduler and consume its short-lived wake lease once before claims. Check target policy, consent and current eligibility at final send authorization. Release database locks before HTTP and keep the send schedule disabled at install. Queue only a short-lived dispatcher proof bound to the wake lease. Keep project-wide credentials and signing secrets out of queued requests.
- [ ] T017 [US1] Add pgTAP cases in `supabase/tests/database/337_goal_notification_dispatch.test.sql` for baseline, concurrent claim, lease expiry and failure isolation. Use committed fixtures to prove dispatch does not mutate scores, block room processing or increase provider polling. Add Edge boundary tests in `supabase/functions/dispatch-goal-notifications/index_test.ts` for missing or invalid scheduler credentials and invalid, expired or replayed wake leases. Assert rejection before claims or sends. Exercise T006 from UI opt-in through one fresh goal in the controlled delivery path. Cover ordinary user and publishable credentials and a valid lease paired with an invalid or wrong-purpose proof. Verify effective queue reader grants without logging queue credentials.

**Checkpoint**: The test-alert milestone can be validated behind its control. The US1 goal path runs in isolated preview with default scope. Public live enablement still depends on the later lifecycle, routing and rollout checks.

## Phase 4: User Story 2 — Control and end delivery (P2)

**Goal**: Each player can choose their own match scope for the active multiplayer session, and ended authorization stops future dispatch.

**Independent test**: Give two players different scopes in the same room. Submit accepted changes for an assigned, common and unassigned match. Reassign or remove a match, acknowledge opt-out, leave a room, switch account and expire a solo grant. Check only currently eligible recipients remain and a new multiplayer session resets to B.

### Required coverage

- [ ] T018 [P] [US2] Add `supabase/tests/database/338_goal_notification_lifecycle.test.sql` for per-player choice isolation, both options and common-match preference, new-session default, stale revision, same-session reconnect, guest rotation, scope expansion/re-add baselines, and both stop orderings. A stop acknowledged before final authorization prevents the network attempt. A stop acknowledged after final authorization but before handoff can race with that attempt. Cover idempotent stops scoped to the old enrollment generation and rejection of old-generation mutation after a fresh opt-in.
- [ ] T019 [P] Cover personal scope changes and opt-out in focused notification state and lifecycle tests. Check offline pending stop, credential clearing, reconnect, separate participants and fresh consent after account switch.

### Implementation

- [x] T020 [US2] Add the `goal_notification_session_scope` migration via `supabase/migrations/`. Store the versioned choice per participant/session and reconcile eligibility boundaries using current assignments, match membership and solo selection revisions. Use a conservative baseline where ordering is ambiguous. Apply fresh acknowledged scope and common-match preference to pending work before handoff.
- [x] T021 [US2] Add compare-and-set scope, association refresh and idempotent disable operations in `supabase/functions/goal-notifications/index.ts`. Reject cross-player access and stale writes. Distinguish offline pending stops from server acknowledgment and handle already authorized attempts separately from later attempts that the stop must prevent. Use the installation credential and expected generation for pending stops. Repair a retired endpoint only with current same-identity authorization and retained consent, using a fresh baseline.
- [x] T022 [US2] Expose the personal A/B choice and opt-out inside `features/game-progress/GoalNotificationSettings.tsx` and connect active game changes in `features/game-progress/useGameProgressController.ts`. Explain that all-room alerts cover provider-backed fixtures with fresh accepted score evidence, including unassigned matches, within existing coverage. Reuse existing session and preference ownership.
- [ ] T023 [US2] Wire deactivation/refresh to `features/account/useAccountAuth.ts`, `features/rooms/useRoomExit.ts` and `features/football-matches/soloTrackingService.ts` where these actions acknowledge state changes. Apply server-side termination and expiry independently of open tabs. Ensure a new game or identity cannot inherit stale match eligibility. Attempt the stop before clearing credentials when online. Persist one pending stop per installation separately from account tokens when offline. Retry on launch, foreground return or reconnection while open.
- [x] T024 [US2] Add bounded database-only cleanup in the `goal_notification_lifecycle_cleanup` migration via `supabase/migrations/`. Cover 24-hour expired/revoked record limits and seven-day diagnostics in `supabase/tests/database/338_goal_notification_lifecycle.test.sql`. Keep cleanup scheduled when the send schedule is disabled and verify it does not wake the sender. Preserve source history and dedupe through the delivery window. Purge invalid endpoint material within the retention window while preserving valid same-identity consent for repair.

**Checkpoint**: Scope, ownership and stop behavior can be validated with fixtures and the test transport. Use this as the active-game eligibility commit checkpoint.

## Phase 5: User Story 3 — Open an alert and trust its meaning (P3)

**Goal**: The alert identifies the accepted change and opens only a game the recipient may still access.

**Independent test**: Open fixture alerts for an active and expired session. Replay the same observation, enrich goal detail, and induce a lost send response. Check routing and protected content separately from logical dedupe and observed presentation.

### Required coverage

- [ ] T025 [P] Cover current, ended, access-lost, malformed and other-active-game alert targets in `__tests__/features/game-progress/goalNotificationRoute.test.ts`. Verify test alerts carry no game route. Exercise an authorized tap in the physical delivery check.
- [ ] T026 [P] [US3] Add transport replay and contract cases in `supabase/functions/_shared/goal-notifications/delivery_test.ts` for stable identity, uncertain sends, payload redaction, provider expiry, throttling and remaining TTL across attempts. Across 100 controlled duplicate, retry and enrichment cases, assert at most one logical delivery per eligible change and browser and no baseline or historical deliveries. Test outcome reporting separately from device display.

### Implementation

- [x] T027 [US3] Implement opaque reference resolution in `supabase/functions/goal-notifications/index.ts` and a thin guarded route in `app/goalNotification.tsx` backed by `features/game-progress/goalNotificationRoute.ts`. Validate current access and exact active game before routing. Use an ended/access-lost fallback and never join or replace a game implicitly.
- [x] T028 [US3] Add safe notification tap handling in `public/goal-push-sw.js`. Use the allowlisted same-origin route, preserve the current app context where possible, and tolerate the previous payload version. Do not attach credentials or a user-supplied URL.
- [x] T029 [US3] Complete status transitions and retry semantics in `supabase/functions/dispatch-goal-notifications/index.ts` and `supabase/functions/_shared/goal-notifications/webPush.ts`. Use bounded backoff with the original deadline, a stable Topic/tag and token-guarded attempt completion. Retire confirmed invalid endpoints and separate accepted, failed, suppressed and expired results. Classify Apple 410 as endpoint expiry and 403/404 as sender errors. Keep consent and endpoint state intact for sender configuration and transient failures. Use the delivery UUID without hyphens as the Topic. Retire only provider-confirmed invalid endpoints, including documented Mozilla Autopush 404/410 cases.
- [ ] T030 [US3] Run the opening and replay scenarios from `specs/032-goal-notifications/quickstart.md`. Validate visible-push handling and record observed presentation and any duplicate display separately from logical delivery, including after an uncertain handoff.

**Checkpoint**: The live dispatch milestone includes the safe tap route and end-to-end fixture evidence. Keep live rollout controls off.

## Final Phase: Foreground fix, capacity and staged rollout

- [ ] T031 [P] Add focused coverage in `__tests__/features/game-progress/useGameProgressController.multiplayer.test.ts` for fresh host and guest goals, preference suppression, corrections and initial snapshot or reconnect replay.
- [ ] T032 [P] Define and cover the bounded committed provider-feedback projection in a `room_provider_goal_feedback` migration via `supabase/migrations/` and `supabase/tests/database/339_room_provider_goal_feedback.test.sql`. Reuse the authorized host/guest snapshot surface. Exclude raw credentials and preserve scoring and room write behavior.
- [x] T033 Wire accepted room feedback through `features/rooms/useActiveGameRoomSync.ts`, `features/rooms/roomSnapshotAdapter.ts`, `types/room.ts` and `features/game-progress/useGameProgressController.ts`. Reuse toast and DONG sound with a sequence baseline and no replay. Physical host and guest feedback checks remain part of preview validation. Keep T031–T033 in a dedicated foreground-fix commit in the same pull request.
- [ ] T034 Measure scan/claim plans, worker CPU, queue age, expected monthly invocations, seven-day storage and unchanged provider demand under fixture fan-out. Record observed capacity, limits and rollback steps in `specs/032-goal-notifications/research.md` and `specs/032-goal-notifications/quickstart.md`. Rehearse the server-side kill switch and disabled send schedule with pending work. Verify no new authorizations or sender wakes, continued database-only cleanup within both limits, and preserved score history. Record numerical queue-age, CPU, invocation and database limits before the first production cohort. Pause sends on safety or gameplay regressions and hold expansion on SC-001 or measured capacity misses.
- [ ] T035 Run the local checks in `specs/032-goal-notifications/quickstart.md` with the repo scripts in `package.json`, including generated database type checks. Record outcomes. Verify preview assets and authorization without changing production configuration. Assert the deployed worker returns the expected JavaScript content type and body and the manifest parses as JSON. Verify the alert route still loads through the SPA fallback.
- [ ] T036 Check Android Chrome, Firefox and Samsung Internet where available in the isolated HTTPS preview. Use Playwright and axe for the main web flow and ARTEMIS for the tray. Record handoff and physical display separately. Confirm the Samsung Internet push host and redacted path pattern on a real subscription before enabling Samsung sends.
- [ ] T037 After production enablement, collect feedback from iPhone Home Screen users on setup, session recovery, closed delivery, Notification Center, taps and opt-out. Record observed iOS versions and limitations in `specs/032-goal-notifications/quickstart.md`. Complete sender compatibility checks before enabling Apple sends.

## Dependencies and parallel work

| Stage | Depends on | Independent milestone |
| --- | --- | --- |
| Setup | Feature documents | Review decisions and isolated validation target |
| Foundation | T001–T002 | Contracts, private tables and Android exploration |
| US1 | Foundation | T013 proves test push, then T014–T017 prove controlled live delivery |
| US2 | T014 and its shared delivery authorization | Session scope and stop behavior with fixtures |
| US3 | T016 delivery records and T021 lifecycle enforcement | Safe opening and reliable delivery outcomes |
| Foreground fix | Existing room contracts | T031–T033 can proceed independently of Web Push |
| Rollout | Story gates, capacity evidence and relevant device checks | Android preview evidence and iPhone production user feedback |

- **US1 parallel examples**: T006, T007 and T008 cover distinct boundaries after setup and device exploration. T009 can proceed while T010 validates the sender after the shared contract is available.
- **US2 parallel example**: T018 and T019 cover database and browser journeys in separate files before T020–T023.
- **US3 parallel example**: T025 and T026 can be authored in parallel after the delivery and lifecycle contracts settle. T031 and T032 can run alongside notification work on separate paths.

## Implementation strategy

Start with a test alert on the Android phone (T003–T013) using the isolated preview. Use one pull request targeting `multiplayer`. Group T014 with T018–T024 in focused eligibility commits, then group T015–T017 with T025–T030 in live delivery commits. Keep T031–T033 as a dedicated multiplayer foreground-fix commit. Complete US1 against controlled evidence, including UI opt-in and game binding, for the MVP. Keep general live delivery disabled until the per-player lifecycle, safe opening, foreground fix and relevant verification are ready. Keep foreground feedback independent of push and record iPhone feedback from production users.
