# Implementation validation — 2026-10-30

## PR validation on current multiplayer

The PR branch `codex/cache-match-discovery` is based on `multiplayer` commit `71decc0`. Discovery code/tests now live under `features/football-matches` and `__tests__/features/football-matches`; picker files use `features/game-setup`. The original dirty checkout was not committed or rebased.

| Final PR check | Outcome |
|---|---|
| Locked dependency install (`npm ci`) | PASS in the isolated checkout; Node 26.8.1 locally, repository/CI pin 26.3.1 |
| Full client unit gate | PASS: 167 suites, 1,104 tests, 65.477 seconds |
| Final adapter/service/hook regression after unused-wrapper removal | PASS: 3 suites, 41 tests |
| Typecheck | PASS |
| Full repository lint | PASS on the current base; no generated-directory exception required |
| League catalog consistency | PASS: 121 leagues |
| Unused-code gate | PASS |
| React Doctor | PASS: no findings in six changed production files; code scan only, dependency supply-chain scan excluded |
| Web export | PASS: `.expo/discovery-web-check` |

The rebase preserved the current team-directory, batch-insertion, team-name and room-screen modules. The new cache replaced the old adapter singleton, so its unused getter/cache and request-type export were removed. The normalized adapter factory and default service behavior remain covered. A remaining old test import was corrected before the passing full unit run.

The PR also includes the earlier requested Lottie player change and its web peer dependency (`@lottiefiles/dotlottie-react`). No cache dependency, backend/schema change or migration is introduced. Android/E2E, platform timing trials and hosted provider comparisons remain excluded as requested. GitHub CI is separate from these local results.

## Earlier implementation evidence

The remaining notes record the implementation's original checkout and pre-rebase checks. The PR results above supersede its older path/lint/count observations.

Branch: `codex/cache-match-discovery`. Local Windows workspace: `C:\src\dong`. Existing dirty package, animation, skill, generated-config, backend rollout and untracked `game-api` work was preserved. No dependency installation/upgrade, migration, backend deployment or commit was part of this implementation.

## Scope and user exceptions

The user explicitly requested unit tests instead of E2E and then said, "Do not test on an android device for now." No Playwright/BDD feature or steps were authored or executed; no Android app interactions or tests ran. Earlier ARTEMIS diagnostics found no connected device and an attempted emulator boot failed before any app interaction. Device exploration, platform timing trials and hosted provider comparisons are not delivery gates for this run. Their absence is not a passed runtime result.

Both requirements-quality checklists passed review before implementation: requirements 16/16 and discovery 37/37. These counts describe reviewed requirements, not test outcomes.

## Executed checks

| Check | Result |
|---|---|
| Service test-first regression | New one-check case initially failed: expected one call, received three. After the factory option, all 26 service cases passed, including default follow-ups, errors and cancellation |
| Full client Jest: `npm run test:ci -- --runInBand --silent` | PASS: 161 suites, 1,066 tests, 65.985 seconds |
| Final focused module/hook/picker Jest run | PASS: 3 suites, 45 tests; includes final accessible-loading assertions |
| `npm run typecheck` | PASS |
| Changed feature source/test files through ESLint, zero warnings | PASS |
| `npm run lint` | Initial failure: one new hook-test render mutation plus unrelated generated Java reports. The hook probe now publishes from an effect; its changed-file lint passes. Unrelated `game-api/target/site/jacoco/jacoco-resources` files remain outside this feature |
| `npx eslint . --ignore-pattern 'game-api/target/**' --max-warnings 0` | PASS: confirms no remaining lint findings outside generated Java reports; this is not an unqualified full-lint pass |
| React Doctor on five changed production files | PASS: no issues; 1.2-second scan. `--no-score --no-supply-chain --no-parallel --max-duration 120`; dependency security scan was excluded because this feature changes no dependency |
| `npx expo export --platform web --output-dir .expo/discovery-web-check` | PASS: production web bundle exported; no hosted/browser interaction claim |
| `git diff --check` | PASS; existing CRLF normalization notices only |

The component test's previous full React Native replacement omitted Expo's required NativeModules/Animated stubs. Those two actual mocked runtime exports are retained by that test; production behavior is unchanged. An initial configured-option assertion also needed to accept canonical league category metadata.

## Requirement evidence

| Requirement | Evidence and limit |
|---|---|
| FR-001/002/010, SC-002/004 | Module canonical selected-only batch/empty tests, UI seven configured/two selected and local time edits, hook add-only-missing league projection. Requests contain only date/codes; all choices remain configuration-owned |
| FR-003/004/012 | Fresh reopen, overlap A/B plus B/C, 16+1 independent batches, 128 selection validation, 30-minute collection and in-flight retention tests. Existing service enforces request body limits. No persistence/new schema |
| FR-005/015 | Module available-A/pending-B publishes immediately; UI fixture actions stay enabled during pending/team loading; football accessibility and old caption absence asserted. Existing reduced-motion/platform animation suites pass. Actual 200/250 ms targets are unmeasured |
| FR-006/007, SC-005 | Retained partial/failed refresh, exact source +60-second boundary, old response not renewed, invalid/missing/future check times, stale server flag, checked-empty distinction and metadata-only initial state tests |
| FR-008, SC-006 | Initial +2 follow-ups, shared exhaustion across observers, early/concurrent Retry, 120-second deferral, failed continuation, inactive/focus suppression/resumption. Retry joins current work with cancellation disabled; cooldown is enforced internally and pending/deferred messages expose the retry time |
| FR-009/014, SC-008 | Valid new-date result stays selected after old response completes; overlap survivor, no observers/inactive/background, paused initial online recovery, no completed reconnect refresh, zero completed idle requests across 120 seconds |
| FR-011/013, SC-007 | Public-only exact keys and normalized projections; module has no room, account, tracking, gameplay or history writes. Full Jest includes existing setup, lobby, running-edit, room pool, live-score, permissions, history and lifecycle regression suites. UI keeps selected/fixed pools independent. No hosted provider-request count comparison or real authenticated journey was performed |
| SC-001/003 | Functional reuse/partial availability covered; 20-per-platform timing trials explicitly waived, so latency pass rates remain unknown |

Whole-body parsing still happens in the existing service before the normalized cache seam. Existing service/catalog parser suites pass. A rejected batch updates no new fixture facts and retains old rows; a separate batch can succeed. Missing, duplicate and wrong-date groups in an otherwise validated response fail affected keys only. A fixture's kickoff date need not equal its source group date.

## Implementation refinements

- Query's per-key in-flight promise fences cycles; no extra cycle ID/store is required. A shared reservation is written immediately before transport after demand/cooldown revalidation. This avoids spending allowance on queued work whose last observer left.
- `MatchFilter` and `LeagueFilter` already support the needed inputs. Only their shared parent changed: initial fixture loading is passed separately from manual-team work, configured chooser choices are independent of results, and ready actions stay usable.
- Removed obsolete response-derived `syncSelectedLeagues` action/export and its mirrored implementation test. Hook tests now focus on adapter wiring/projection/activity; domain behavior belongs to the module interface suite.
- Existing QueryLifecycle remains the focus/connectivity bridge. Shared batches do not consume an observer's abort signal. Submitted exact-key results can complete after detachment.

## Delivery and recovery

Client-only changes are ready within the requested validation scope. The unchanged root lint command remains non-green because it includes unrelated generated Java reports; no unrelated cleanup was performed. No browser/device latency or hosted/provider behavior was measured. Roll back the client build if needed; restart discards the in-memory cache. No database repair or data backfill is required.
