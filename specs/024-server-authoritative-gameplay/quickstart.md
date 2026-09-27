# Quickstart: Validate Server-Authoritative Multiplayer Gameplay

## Automated suites

Docker must be running. Use Java 17 and the normal Supabase publishable/JWT
settings; never expose a service-role key to Expo.

```powershell
npm run lint
npm run test:ci -- --runInBand
Set-Location command-api
.\mvnw.cmd clean verify
Set-Location ..
npm run db:start
npm run db:reset
npm run db:test
npx supabase functions serve refresh-provider-scores
```

pgTAP covers registered/guest authorization, departed users, manual/provider
separation, non-negative values, idempotent replay/conflict, concurrent deltas,
completion ordering, snapshot sequence, reassignment preservation, and event
reconstruction. Jest covers optimistic reconciliation, rollback, stale recovery,
permissions, and the offline solo branch. Jest also covers Edge request helpers,
scoreboard normalization, malformed events, concurrency, and timeouts. JUnit
covers the retained Java discovery integration. Local Edge integration uses an
authenticated test user and a mocked `PROVIDER_SCORE_ESPN_BASE_URL`; CI must not
call live ESPN. Prior tagged Playwright results are historical. Do not add or
run E2E tests for the 2026-09-27 amendment; the user owns the pending manual
browser and physical-device acceptance below.

## Physical Android smoke

Use the web client as the second participant:

```powershell
adb devices
adb reverse tcp:8080 tcp:8080
adb reverse tcp:8081 tcp:8081
adb reverse tcp:54321 tcp:54321
npm run android
```

The user performs this acceptance after an isolated test room is available.
Join/start the same room in browser and on the device; record a manual goal and
half-drink; background/resume; reassign when host; and complete. Confirm
five-second synchronization and terminal-notice targets. Verify the host
reaches unchanged Home directly; the guest sees Room Ended, its five-second
countdown pauses in background and resumes with the remaining time, then routes
Home. With a screen reader enabled, verify the accessible Home button and
absence of timed navigation. Current React Native Web accessibility detection
reports enabled for every browser session, so the browser currently follows
button-only behavior; do not record that as countdown acceptance. Record device
serial, build, date, browser/version, measured times, accessibility mode, and
evidence. No E2E test may be added or run for this amendment.

## Failure checks

- Offline tap: no queue; show reconnect/refresh.
- Reconnect: canonical state replaces stale values within ten seconds before
  controls enable.
- Altered request with reused UUID: reject without mutation.
- Racing decrements at zero: non-negative final value.
- Gameplay/completion race: sequence decides inclusion; nothing mutates after
  completion.
- Missing/expired JWT: Edge Function returns 401 even though gateway
  `verify_jwt` is disabled.
- Concurrent provider refreshes: one lease winner; others return `not_due` and
  do not contact ESPN.
- Partial provider outage: independently validated observations commit with a
  `partial` response; total outage returns 503 and commits none.

Rollback is a forward migration revoking new RPCs and restoring the prior
snapshot function. Retain accepted events and canonical completed history.

## Implementation validation (2026-08-16)

- `npm run lint -- --quiet`: passed.
- `npm run test:ci -- --runInBand --silent`: passed — 93 suites, 538 tests.
- `npm run db:reset`: passed with migrations 001-042.
- `npm run db:test`: passed — 39 files, 553 tests.
- `npx supabase db advisors --local --type all --level info --fail-on none`:
  no error-level findings; remaining warnings/info are existing unindexed
  foreign keys, mutable search paths, unused indexes, multiple permissive
  policies, and intentional deny-by-default RLS tables.
- `command-api/./mvnw.cmd clean verify`: passed — 91 tests, coverage checks met.
- `npx tamagui check`: passed with the 2.5.1 CLI/runtime/animation driver.
- Tagged Playwright smoke (`--grep "server-authoritative"`, desktop Chromium):
  passed — 5 scenarios, including the complete two-client journey.
- `npx react-doctor@latest . --verbose --scope changed`: score 62/100 with
  baseline warnings and two pre-existing errors in `hooks/useRoomConfigure.ts`;
  the new lobby hydration dependency warning was fixed and the remaining
  findings are outside this feature's change boundary.
- Full TypeScript checking still retains pre-existing Supabase override-type and
  test-mock diagnostics; this validation does not block the passing runtime and
  test gates above.

## Physical-device smoke evidence

- Device: `WCR0218C11000221` (`CLT-L29`, Android 10).
- Package/build: `com.krogh.dong.dev`, version `1.0.0`, installed
  `2026-08-16 16:36:38`.
- ADB reverse was active for Metro (`tcp:8080` and `tcp:8081`). The development
  client loaded the current bundle, rendered Home, navigated through
  `home-start-game-button` into `SetupWizardStep-players`, and accepted player
  input. Sampled logcat contained no `FATAL EXCEPTION` or React Native JS error.
- A two-client authenticated multiplayer journey was not run on this device
  because no test room/session credentials were available in the connected
  app; the database/RPC path was validated locally instead.

## Secure provider-ingestion validation (2026-09-03)

- `npm run db:reset`: passed with the service-role-only lease/batch RPCs.
- `npm run db:test`: passed — 39 files, 588 tests.
- Focused Jest gameplay, provider, synchronization, navigation, and disabled-control
  modules: passed — 12 suites, 67 tests.
- The full Jest run completed with 96 suites and 559 assertions passing. The
  command still exits nonzero because the existing Expo preset logs asynchronous
  `ExpoModulesCoreJSLogger` and React `act(...)` warnings after suites finish.
- `command-api\\mvnw.cmd test`: passed from `command-api/`; Java match discovery
  remains covered while the unshipped provider-refresh route is absent.
- Local Edge runtime bundled and served `refresh-provider-scores`; unauthenticated
  POST returned 401, allowed-origin `OPTIONS` returned 204, and an authenticated
  request reached the service-role claim RPC and returned 404 for a nonexistent
  room.
- The server-authoritative Playwright feature passed all 10 scenarios across its
  phone and desktop projects. The complete 124-scenario suite remains blocked by
  the existing Expo Metro process exhausting its 4 GB Node heap (with 55
  scenarios passing before the two-worker retry exhausted the heap).
- Hosted authenticated Android-plus-web validation remains pending under T051;
  browser mocks and local database tests do not satisfy that release gate.

## Room-ended manual checklist (2026-09-27)

Android is user-confirmed working; no agent manual testing was performed.
- End as host: host goes Home; guest sees the explanation without Retry Join.
- Measure detection separately from five foreground seconds; background/resume pauses countdown.
- Check immediate Home button, Android Back, screen-reader button-only dismissal.
- Reconnect: no restored room or stale errors; join a new room from unchanged Home.
- Check dark mode, large text and safe areas.

No E2E tests added/run. Browser uses button-only dismissal because RN Web always reports screen-reader mode; browser countdown preference remains pending.
