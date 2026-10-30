# Validation Guide: Responsive Match Discovery

Implementation is complete under the user's unit-only/no-Android validation scope. Current outcomes and limits are recorded in [validation/results.md](validation/results.md). The runtime acceptance matrix below remains a guide for future platform checks; unperformed measurements are not passes.

## Prerequisites

- Use branch `codex/cache-match-discovery`, feature directory `specs/031-cache-match-discovery` and the repository-pinned Node/npm setup. Install locked dependencies if needed with `npm ci`.
- Use the existing application QueryClient/provider and Expo configuration. Module tests inject a controlled one-check discovery adapter; parser/transport and browser cases use the maintained `discover-matches` operation with schema-valid public `SavedMatch` data. They do not require production ESPN access.
- Before authoring interaction tests, explore the actual application and verify controls/transitions according to `AGENTS.md`. For Android use ARTEMIS, first inspect `adb devices -l`, ask the user which device to use if multiple are attached, and diagnose ARTEMIS failures with `mobile_diagnose` before retrying.
- Use existing browser-flow/auth fixtures for room journeys. Do not add service-role keys, real tracking grants or production room data to fixtures or logs.
- Start an optional local client with `npm run web`; for a native development client use the existing `npm run android:dev` workflow. Controlled HTTP fixtures must target Supabase `discover-matches`, not the compatibility Java matches route.

References: [contract](contracts/match-discovery.md), [state model](data-model.md), [source/research decisions](research.md).

## Implementation checks

From the repository root, after the named new tests exist:

```powershell
npm run typecheck
npm run test:ci -- --runInBand __tests__/features/football-matches/matchDiscoveryQueries.test.ts __tests__/features/football-matches/useMatchData.test.tsx __tests__/features/game-setup/useMatchListFilters.test.ts __tests__/features/football-matches/footballMatchService.test.ts __tests__/features/game-setup/MatchList.platform.test.tsx
npm run lint
npx expo export --platform web --output-dir .expo/discovery-web-check
```

No BDD feature or steps were added, and no end-to-end or Android tests are required for this delivery. Before opening a PR, run the full client gate with `npm run test:ci -- --runInBand` and `npm run lint`, plus relevant existing room/live-score regression suites. React changes also require React Doctor per its repository skill; report scanner/setup failures separately from code findings.

No DB reset, migration command, backend deployment or production acquisition toggle is part of this feature's validation.

## Controlled acceptance matrix

Use seven configured eligible leagues, initially selected A/B, a supported source date, and fixtures in the local display time window. For fresh-cache cases, supply a complete group not marked stale whose successful source check is less than 60 seconds old. Match-summary timestamps need not equal the group timestamp. Start with an isolated QueryClient per automated case; retain it across navigation within a case. Exercise policy through the module interface used by the hook and keep hook-only cases focused on projection/activity wiring.

| Scenario | Action and expected result | Coverage |
|---|---|---|
| Selected demand | Open Matches. Only A/B enter discovery requests; all seven remain choosable. Deselect both: zero new requests and a select-league message | FR-001, FR-010, SC-002 |
| Immediate partial use | Return A available and B pending with delay at least 15s. A's fixtures can be added before B's next check; manual team loading cannot block them | FR-005, FR-015, SC-003 |
| Fresh reopen/addition | Close and reopen with retained-fresh A/B: no request. Add C: only C loads. Remove/re-add fresh B: no request | FR-002, FR-003, FR-004, SC-001, SC-002, SC-004 |
| Canonical keys | Reorder/duplicate codes and edit start/end time. No discovery request. Change source date: only that day's rows/status are projected | FR-002, FR-009, SC-004, SC-005 |
| Date and configuration boundaries | Exercise midnight/DST and a fixture whose kickoff date differs from its source group. Existing display-time interpretation remains unchanged. Remove/re-add configured choices while a response is delayed: options follow configuration, old responses cannot restore removed options, and selected game matches survive | FR-002, FR-009, FR-010, FR-011, SC-005 |
| Fixture reuse age | Re-receive old saved facts or update internal bookkeeping: source age does not renew. Before 60 seconds, complete server-nonstale snapshots reuse; at 60 seconds they are outdated. Missing/invalid/future group timing, incomplete status or server-stale status prevents fresh reuse. Different match-summary timestamps alone do not invalidate it. Checked-empty results follow the same rule | FR-007, SC-005 |
| Retained failure | Expire a prior result and trigger allowed activity; hold/fail refresh. Rows and selected pool remain. A complete empty group is distinguishable from pending/error without content | FR-006, FR-007, FR-011, SC-005 |
| Shared cycle | Keep B pending. Exactly initial +2 follow-ups, none before cooldown. A second consumer shares budget; after exhaustion no timers dispatch. Explicit Retry joins/waits or starts one new cycle after cooldown | FR-004, FR-008, SC-006 |
| Long deferral | Advertise delay above 60s. Show pending/Retry without automatic continuation; early Retry dispatches nothing and retains the full wait | FR-008, SC-006 |
| No completed polling | Keep completed picker visible for at least 120 seconds, spanning two client reuse periods: no requests. Reopen, change date/leagues or foreground: stale selected keys refresh, fresh ones reuse. Reconnect alone does not refresh completed keys | FR-014, SC-008 |
| Lifecycle and overlap | Hold A while switching to date B, then release A: B stays correct. With A/B and B/C consumers, B shares work; removing one consumer preserves the other's result. Hide/background all consumers: no new follow-up | FR-008, FR-009, SC-004, SC-006 |
| Retention | Leave entry inactive for 30 minutes with fake clock, then reopen: it may load again. Active entries are not evicted solely for that inactivity duration. Restart has no persistent fixture cache | FR-003, FR-012 |
| Scope and authority | Exercise solo setup, authenticated host configuration and permitted running-game editing. Filters/failure/omission never remove selected or fixed matches; existing save/start rejection paths remain authoritative | FR-011, FR-013, SC-005, SC-007 |
| Account boundary | Sign out/in with public results retained. Private account cache cleanup still runs; inspect query data/keys and request logs for absence of room data, participant details, tracking grants and credentials | FR-013, SC-007 |

Distinguish failure classes in the controlled adapter/parser cases. A structurally malformed body or transport failure fails every key in that submitted batch, keeps their retained fixtures and accepts no new rows from the rejected response. In a schema-valid response, missing/duplicate/wrong-date groups fail only affected keys; valid corresponding groups remain usable. Other submitted batches settle independently. No failure becomes checked-empty. Confirm that default nonpicker service discovery still performs its old bounded follow-ups and saved-score acquisition has no new transport calls.

Exercise the picker-facing interface as documented: explicit selection/activity in, fixture/team projections and league states out, one guarded Retry action. Callers must not inspect counters, invoke raw refetch, calculate freshness or repeat Retry to drive pending checks. Expected errors become returned states. Retain interface-level behavior assertions when replacing older hook tests; do not add parallel helper/counter test suites for the same behavior.

## Deferred web and Android runtime evidence

Record the environment, build/revision, device/browser, source date, fixture clock, selected codes, request log and ready-to-display checkpoint. Android evidence must name the actual device/emulator; a phone-sized browser is web evidence.

1. For SC-001, perform 20 retained-fresh reopen trials per platform. Measure from picker-ready-to-display to fixtures being visible and actionable. At least 19/20 must finish within 200 ms with no new discovery call.
2. For SC-003, perform 20 mixed-speed trials per platform. Measure from acceptance of A's valid response to its fixtures being actionable while B stays pending at least 15 seconds. At least 19/20 must finish within 250 ms. Use instrumented test timestamps, not ARTEMIS/model round-trip time.
3. Capture navigation/date/time/filter interactions, foreground/background transitions, preserved selection and reduced-motion loading behavior. Use deterministic explicit waits in final interaction scripts based on the explored path.
4. Compare identical controlled gameplay demand before/after: discovery-only journeys must produce no additional live-score provider calls, permission changes or history mutations. HTTP mocks establish client behavior; only separately collected backend/provider evidence establishes actual hosted provider counts.

## Rollout and recovery

After implementation gates pass, release the client normally. Backend schema, Cron, request budgets, provider freshness and compatibility clients are unchanged. Roll back to the previous client build if needed; reload/restart discards the public in-memory cache and no data backfill or cleanup is required.

## Validation exception â€” 2026-10-30

The user explicitly requested implementation with unit tests only: "I do not think e2e test is necessary here and unit tests should be enough." No new Playwright/BDD tests, end-to-end runs or per-platform timing-trial gate are required for this delivery. Use module, hook, component and existing compatibility unit tests plus typecheck/lint/build checks. UI latency targets remain unmeasured product targets, not reported passes. Existing device-exploration instructions apply to any preparatory observation; no device acceptance suite is introduced.

Android exception â€” 2026-10-30: The user explicitly said "Do not test on an android device for now." No Android interaction/exploration or acceptance is required in this run. ARTEMIS diagnostics found no connected device and its emulator boot failed; no app interactions ran. Unit tests and local static/build checks are the delivery validation.


## Implementation outcome — 2026-10-30

- `npm run test:ci -- --runInBand --silent`: 161 suites / 1,066 tests passed; the final loading assertion update also passed the focused 45-test module/hook/picker run.
- Typecheck, web export and React Doctor's five-file code scan passed. Changed-file lint passed. Full lint encounters unrelated generated `game-api/target/site/jacoco` JavaScript; the repository lint run excluding only `game-api/target/**` passed. No generated files or unrelated configuration were modified.
- The one-check service option preserves default callers. Query owns retained facts, in-flight deduplication and cycle fencing; transport reservations occur synchronously at dispatch after rechecking demand. The parent supplies existing `MatchFilter`/`LeagueFilter` contracts correctly, so those components needed no source changes.
- No dependency, migration, backend deployment, commit, E2E run or Android interaction was introduced. UI latency and hosted provider-count comparisons remain unmeasured.


## PR preparation on current multiplayer

The isolated `codex/cache-match-discovery` checkout is based on `71decc0` and uses the current feature folders. Final local validation: 167 suites / 1,104 unit tests, typecheck, full lint, league catalog, unused-code gate, React Doctor code scan and web export passed. The unused legacy adapter getter was removed; its normalized factory and service compatibility tests passed afterward. See [validation/results.md](validation/results.md) for evidence boundaries. No Android/E2E tests were run.
