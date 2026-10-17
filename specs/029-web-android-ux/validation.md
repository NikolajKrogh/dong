# Implementation validation ledger

Started: 2026-10-17. Integration branch: `web-navigation`. Original source baseline: `3750010e50d38c9a5f05330993d75cc6e4462845`.

## Current status

Application source is integrated through `7f40c70`. Final client gates pass: 141 Jest suites / 910 assertions (process exit 0), 130 UX browser cases (0 failed/skipped), TypeScript, ESLint and unused-code checks. Changed-source React Doctor exits 0 at 84/100 with 11 reviewed warnings and no blocking finding. The final generated web export at `7f40c70` also passes all seven runtime smoke checks; physical keyboard/list evidence is recorded below.

The Huawei development client passes the six solo/signed-in smoke scenarios, registered owner/member and guest in-progress configuration/status and safe Home/resume cycles. Pre-start owner/member and guest journeys preserve local room invariants. Physical Chrome passes empty/20-player IME gesture checks and a 100-friend read-only scroll. Physical landscape is inconclusive because Chrome reproduces incorrect viewport dimensions on a blank control page. Packaged Android, deployed web, TalkBack and actual autofill remain separate acceptance gates; automated or development-client passes do not imply release acceptance.

Three isolated implementation workers and a fresh independent reviewer contributed. All source was reviewed and integrated serially into this branch. Existing user skill changes remain outside feature commits. No push, PR, deployment, new dependency or application schema change was made.

## Baseline and ownership

The user authorized implementation with three isolated subagents. Coordinator owns integration, shared exports/configuration and serialized Android checks. Workers follow spec.md, plan.md, contracts/navigation.md, agent-handoff.md, skills.md and assigned task IDs.

Planning baseline commit includes feature 029 artifacts, managed plan references and the two audit reports/evidence. Existing skill installation changes (deleted project RNTL skill, skills-lock.json and new accessibility/Playwright/web-guidelines directories) are preserved outside the scoped planning commit. Workers use the current skill catalog/canonical `C:/src/dong/.agents/skills` when an uncommitted skill is absent in their worktree; do not restore removed skills or install dependencies.

Required checklist: requirements.md 16/16 complete. Spec Kit prerequisites resolve feature 029. Optional whole-tree auto-commit hooks are not used; scoped commits preserve unrelated changes.

## Initial environment and runtime gates (historical)

- ADB outside restricted shell sees Huawei CLT-L29 `WCR0218C11000221` authorized. The user unlocked it; ARTEMIS diagnosis/probe is ready. No credentials requested or entered.
- Current Android read-only exploration completed for populated Home/game actions and Friends Requests/search return. Previous audit evidence remains useful but does not establish new-code acceptance.
- Browser fixture helpers and existing Jest/component tests will be reused; mocked hosted/auth evidence is labeled as such. No production game/relationship mutation is authorized for fixtures.
- Worker slices are integrated serially below. Native coverage is partial; packaged release gates remain not run.

## Results

Record exact commands, build/commit, fixture versus live platform, expected/actual behavior, reviewed evidence paths and pass/fail/not-run here as implementation progresses.

### Initial baseline

- Planning/audit commit: `2604e1a`; workers A/B/C start from this exact commit on separate `ux/game-navigation`, `ux/return-routes`, `ux/accessibility-layout` branches in managed worktrees.
- Existing six focused Jest suites (controller solo/multiplayer, FooterButtons, SetupWizard, History, Home): 55/55 tests pass. First run failed before executing any tests due sandbox temporary-cache rename EPERM; workspace-local `--cacheDirectory ./test-results/jest-baseline-cache` resolved it. This is tooling evidence, not a DONG regression.
- `npm run typecheck`: passes on baseline.
- Current web fixtures: existing browser-flow helpers intercept local mock Supabase/API origins; host/guest/solo/history fixture mechanisms exist. These are browser fixtures, not an Android auth/session seed or hosted permission proof.
- Current phone remains PIN-locked; ARTEMIS observation complete but interactive app exploration/new-test authoring gate remains pending unlock.
- New installed accessibility/Playwright skill guidance applies from the current canonical skill catalog. No removed RNTL skill restored and no new testing dependency installed.

### First integration slices

- Full original baseline: 130 suites / 817 tests pass, JSON at ignored `test-results/ux-baseline-jest.json`.
- A `18dea8e` integrated as `4ef2500`: preserve solo/registered/guest configuration identity and add read-only room status. C `e5d634e` integrated as `aefe748`: shared controls/forms semantics. Independent combined check: 8 suites / 41 tests pass. Review identified malformed status-copy characters; correction assigned back to A before final acceptance.
- B `b6fb923` integrated as `7147e3a`: Friends caller return/recovery and pure route parsers. Independent check: 2 suites / 9 tests pass. Full route/History/Wizard integration still in progress.
- Existing BDD generation failed on two non-destructured fixture callbacks in player-picked-two-devices.steps.ts. Minimal compatible destructuring fix committed as `024a222`; `npm run bdd:gen` and focused ESLint pass. No existing scenario behavior changed.
- Phone unlocked and current ARTEMIS/ADB exploration reconfirmed populated Home → Continue Game → Game actions → hardware Back returning Home on the baseline, without a game mutation. ARTEMIS diagnosis/probe ready. Prior audit explored the same source baseline and supports regression authoring; new native behavior still requires acceptance.
- Native read-only runner foundation added with explicit device/package/fixture guard, dynamic locators, bounded waits and a single calibrated fallback. First execution was inconclusive during Metro hot refresh while integration advanced. Keep device runs and integration changes serialized; do not count this as accepted runtime coverage.

### Overlay design decision

The web history-sentinel prototype was rejected before implementation because scoped cleanup could not remove stale entries after arbitrary route-away. Use an actual router-owned transparent taskOverlay route with bounded in-memory owner registration, graceful unavailable-owner fallback and serialized dismissal/navigation. Native retains existing modal/request-close behavior. A owns route/adapter, coordinator wires root Stack.Screen/export; B consumes it for transient History sort. Browser lifecycle tests are required before acceptance.

### Browser-led integration corrections

- C `67fcf5d` → `0915ae8` corrects Tamagui 2.7 actual `render` semantics (the older `tag` prop did not produce the intended DOM) and route titles. C `e85d1f1` → `7b4a721`, `9b87643` → `6cf28f7`, `73f1b19` → `a0ca359`: Home shortcuts, named player controls/hidden toast, link typography and native/web role forwarding. Worker rendered browser checks: 10 cases at phone/desktop passed; combined coordinator six suites/34 tests pass using `npm run test:ci`.
- B `9cdbd86` → `ced5cc1`, `f821dc2` → `8cc990a`: optional controlled Wizard and solo route state; actual navigation-container readiness prevents direct-entry normalization before Root Layout mounts. Initial raw `npx jest` invocation exited 1 after passing assertions because it bypassed the repository's Node/Expo CI preload; the supported CI command exits 0. No test configuration changed.
- A `daffeb3` → `271cd97`: separate safe lobby Home from terminal cleanup, use dismissTo for Home/game re-entry. Coordinator now owns lobby route-step integration.
- Native current-source exploration: populated Home scroll reaches Friends/History and room actions; Friends → Requests → Find friends → header Back returns Received/Sent on Requests. These were real signed-in native reads; no game or relationship mutations performed.
- Real Expo web Back reconstruction may remount gameplay, so optional `gameTab=players` (matches default) is approved as incidental route state to retain the underlying selection; public contract updated. Stale transient overlay Forward/refresh must show safe unavailable-owner recovery rather than retaining dead closures.

## Integrated implementation and review

All three implementation workers used isolated worktrees from `2604e1a`, GPT-6.1 Sol with high reasoning, and the role-specific skills in skills.md. The coordinator reviewed and cherry-picked each slice into `web-navigation`; a fourth independent reviewer checked combined behavior after handoffs. No worker merged independently or controlled the phone concurrently. User skill installation/removal changes remain outside feature commits. No dependency, application schema or remote migration change was introduced.

| Area | Material integration commits and result |
| --- | --- |
| Game context, safe Home, task overlays | `4ef2500`, `baa9f70`, `078f738`, `271cd97`, `231515b`, `44b6089`; scoped Back, room identity, read-only guest status and explanatory recovery |
| Friends and meaningful route state | `7147e3a`, `ced5cc1`, `8cc990a`, `91d14bc`, `3e63258`, `4212351`, `671486e`, `2866579`; validated route parameters, caller return and controlled Wizard |
| Actual web semantics, forms and Home | `aefe748`, `0915ae8`, `7b4a721`, `6cf28f7`, `a0ca359`, `f50aa07`, `e6e3806`; rendered DOM, labels, headings, titles and destinations |
| Compact layout and motion | `1f7060d`, `4ac965a`, `b56cb6a`, `5540521`; narrow labels, short-height scroll ownership and live reduced-motion preference |
| Integration defects found by review/runtime | `5326e7d` allows available local detail during cloud failure; `5627e44` preserves each mounted setup route rather than optimistically overwriting its predecessor; `a0fd107` applies the same correction to History; `983d541` gates the body-portal detail presentation on route focus while preserving its selected game |
| Browser regressions and fixture compatibility | `024a222`, `c21b08b`, `6d48a75`, `fbb9023`, `d486f91`, `d9fc85f`, `74dad43`, `50b0c31`, `f4c7547`; existing BDD helpers use supported fixture callbacks and visible accessible actions |

Independent review found no remaining blocking source finding after the History focus gate. The subsequent FR-018 reconciliation identified unconditional game-menu/player-removal animations; `5540521` extends the existing native policy through a shared platform hook and adds web media-query subscription. Native initial preference remains conservative, newer events win over a delayed initial read, and subscriptions clean up.

Meaningful setup/History navigation changes state only after the destination route commits. A pending-step guard prevents duplicate advancement. Explicit Wizard Back pops an owned preceding step and otherwise replaces safely. History detail ownership stores bounded opaque browser-entry IDs, never private result data. If session storage is unavailable or its marker has been evicted, recovery conservatively may add an extra Games entry on reload; safe Close/Back still work. Transient overlay refresh/Forward uses explanatory Home recovery because its in-memory owner cannot be resurrected safely.

### Runtime-led corrections and final review

- `36bad02` removes duplicate Friends parents after sign-in/username completion through normalized `dismissTo`. Four browser cases failed before/passed after. Live native Friends recovery also passes: sign in as the local member, open Requests, then one header Back returns Home without another Friends screen.
- `c99975a` wraps setup navigation actions at 320px/200% text. The original action area had client width 318 and scroll width 345; corrected button, label and icon bounds remain visible.
- `c95d151` fixes a real private-room Realtime collision during retained gameplay/re-entry. The installed SDK returns the same cached channel for the same topic and rejects adding presence handlers after subscription. A client/topic registry shares leases for the same participant, retires old identities, and serializes replacement after asynchronous cleanup. Failed/unowned cached channels fall back to existing polling; private topic and authorization boundaries are unchanged.
- `a9ce096` and `99d6b70` fence unmounted room work and retry entry before it can overwrite another room's pending state. Realistic SDK and delayed-RPC tests cover concurrent leases, last cleanup, remount/identity changes, failed teardown, stale snapshots/errors/completion/reassignment and retry callbacks. Independent source review found no remaining blocking finding after these corrections.
- `2519cf1` preserves the actual web input and ancestor nodes through keyboard resize; switching wrapper types had remounted and blurred the focused player input. `5655d69` removes the web-only `touch-action:none` caused by disabling the PlayerList FlatList, preserving native behavior. Trusted drag tests replace programmatic scrolling as evidence for this defect.
- Physical Chrome then exposed a second condition: layout height 623, visual height 304, `offsetTop=319`. A height-only scroll cap left the entire scroll area above the visible window. C `4dabfc5` integrates as `7f40c70`: an independent stable frame anchors the local scroll area inside the panned visual viewport. Scoped resize/scroll observers clean up; there is no global viewport/meta, focus or scroll mutation. The independent reviewer checked the source and 319-offset traces/images without a blocking finding. Final BDD covers offsets 0/140/319 with empty and 20-player lists.

The `5655d69` cherry-pick conflict in PlayerList tests retained both reduced-motion cases and the new platform scroll-policy case; focused integration then passed 48 tests. All later viewport source integrated cleanly. Reviews were performed by the separate reviewer and reported to the coordinator; they are source assessments, not additional executed device checks.

Final Spec Kit analysis found 20 FRs, 7 SCs, six stories and 52 unique tasks, all mapped, with no constitution conflict or missing implementation task. One medium documentation ambiguity (Friends child query vocabulary) and two low progress/index inconsistencies were reconciled in the contract/task ledger. Optional whole-tree commit hooks were omitted to preserve scoped ownership.

## Automated evidence

These browser runs use intercepted service/auth fixtures at local Metro URLs. They establish rendered behavior, not hosted authorization or physical Android acceptance.

| Gate | Command / evidence | Result |
| --- | --- | --- |
| Full Jest, final source `7f40c70` | `npm run test:ci -- --runInBand --json --outputFile=test-results/ux-final-candidate-jest.json` | 141 suites, 910 assertions pass, exit 0; log `test-results/ux-final-candidate-jest.log` |
| Integrated motion correction | Same CI entry point, FooterButtons/PlayerList/useReducedMotion and animationReducedMotion suites | 4 suites / 15 tests pass across `ux-motion-integration-jest.log` and `ux-motion-adapter-jest-host.log` |
| TypeScript, lint, unused code, `7f40c70` | `npm run typecheck`, `npm run lint`, `npm run check:unused` | All exit 0; logs `ux-final-typecheck.log`, `ux-final-lint.log`, `ux-final-check-unused.log` |
| Complete UX BDD, `7f40c70` | Port 8301; `npm run test:e2e -- ux- --workers=2 --output=test-results/ux-final-candidate-browser --reporter=line` | 130/130 pass, 0 failed/skipped, exit 0, 3.1 minutes; includes all following feature subsets and offset-aware trusted drags |
| Tagged UX browser cases | `PLAYWRIGHT_WEB_PORT=8295`; installed Playwright CLI `test --grep '@ux-' --output=test-results/ux-final-combined-browser --reporter=line` | 88/88 pass, phone + desktop; log `ux-final-combined-browser.log` |
| Route cases without tags | Port 8296; `test ux-route-state.feature --output=test-results/ux-final-route-browser --reporter=line` | 22/22 pass; log `ux-final-route-browser.log`; 110 distinct feature cases total with tagged run |
| History detail → shared Stats → Back | Port 8294; `test --grep '@ux-history-focus' --output=test-results/ux-history-focus-browser-host` | 2/2 pass; old body portal hidden, shared page usable, original game restored |
| Affected existing setup/host/guest BDD | Scoped existing configure/start, room create/resume, guest join/re-entry and empty guards | 16 distinct cases pass, logs `test-results/a-existing-bdd/fixed-run.log` and `configure-run.log` |
| React Doctor, `7f40c70` | `npx react-doctor@latest . --verbose --scope changed --base 2604e1a` | 99 changed files, 84/100, zero errors, 11 reviewed warnings, exit 0; `ux-final-candidate-react-doctor.log` |
| Native runner guard self-check | `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/android/test-ux-journey-guards.ps1` | 22 mocked assertions pass; no device action. Includes failed-before/passed-after stale XML and clipped-control scrolling regressions |
| Production web export, `7f40c70` | `npx expo export --platform web --output-dir test-results/ux-export-web-final`; local public environment process-only, `EXPO_NO_DOTENV=1` | Exit 0; `test-results/ux-web-export-final.log`. No deployment/configuration mutation. |
| Final export runtime | `node test-results/ux-export-smoke-final/run-export-smoke.cjs` | 7/7 pass, exit 0; `results.json` and three reviewed screenshots in that folder. Home→Setup, touch focus, player add, direct route/refresh, actual Ionicons fonts 200/font/ttf/binary, missing assets404/traversal rejected. Zero page/console errors or external requests. Owned Chromium and loopback8490 server stopped. |

React Doctor warnings concern existing large/complex controllers and route synchronization. Shared dynamic `render` button/anchor label warnings were checked against actual DOM roles, names and hrefs in BDD. History/lobby restoration effects and task-overlay synchronization have explicit regression coverage; no broad refactor was made solely to alter the score.

Full Jest finishes assertions but can retain asynchronous work for several minutes before exiting; focused suites exit normally. An earlier detectOpenHandles run eventually exited 0 without a handle trace. Do not describe assertions alone as a timely clean process shutdown or hide the delay using forceExit. The supported CI preload avoids an unrelated Expo fetch teardown error from bare Jest.

The broader existing BDD run exposed stale Settings History-import/onboarding, Overall Statistics wording and guest departure-toast expectations. The same failures were reproduced at planning baseline `2604e1a`; they are not counted as new UX regressions or silently passed. Browser startup/cache and restricted-host Chromium failures were rerun using the installed host browser. Every subsequent Playwright invocation uses its own output subdirectory: default cleanup previously removed older ignored artifacts, including baseline JSON, so those original files are historical results rather than durable deliverables.

## Device and disposable local environment

The user reconnected/unlocked Huawei CLT-L29 `WCR0218C11000221` (Android 10, 1080×2240, default font scale 1), granted exclusive use, and subsequently authorized disposable account/room changes after starting Docker. ARTEMIS diagnosis and real screenshot/hierarchy probe pass. The installed native target is `com.krogh.dong.dev/.MainActivity`, served by the current Expo development bundle; it is not a packaged release build.

The old local stack had existing schema/history drift; its attempted pending-migration transaction rolled back. Rather than repair/reset that history, a separate `dong-ux029` stack applied all 61 existing migrations cleanly. Other DONG/TrackMate stacks were preserved. API 47321, DB 47322; a loopback-only gateway on 47325 forwards API/Realtime and supplies the existing guest ingress's trusted local caller address. No application authorization was bypassed. Existing RPC/Edge checks confirm registered/guest snapshots, Realtime heartbeat, member `not_host`, running-owner `room_not_joinable`, cross-room rejection and forbidden direct guest RPC.

Reproducible preparation, public environment, role manifest and instructions are ignored under `test-results/android-ux-local/`; credentials/grants stay in fixture-secrets.json and are never committed. Stack sources are nested under node_modules so copied Deno functions do not enter the client TypeScript scan. Native Metro uses that local public environment with USB reverse mappings for 8081 and 47325. The command API is pinned to unused local 48080 to avoid remote fixture commands; a prepared running room supplies navigation/status checks. This does not prove the native Start button against Java.

The checked-in `scripts/android/run-ux-journeys.ps1` uses an explicit serial/package/approved manifest, package-scoped dynamic UIAutomator selectors, bounded readiness/keyboard/scroll checks, foreground guards, screenshots and nonzero failure exits. Only Open game actions has one device/font-calibrated coordinate fallback; unavailable/unstable hierarchy output is rejected. Its six scenarios are deliberately narrower than the full acceptance matrix.

Current native results: solo game-context and scoped Back/three safe Home-resume cycles passed on `5627e44`; the route-state smoke then reproduced mounted History Players-state corruption. After `a0fd107`, a fresh local-device route-state run passes (`test-results/android-ux/final-local/route-state/results.json`). An all-scenario run from a scrolled Home missed its first Continue activation; a separate inspected activation succeeded. The fresh run on `5540521` passes all six scenarios (`test-results/android-ux/final-local/six-scenarios-retry/results.json`), including named controls/IME Back and shortcut return. The live sign-in journey exposed an extra Friends parent after auth return; `36bad02` uses normalized `dismissTo` on auth/username completion, with failed-before and four passing phone/desktop browser regressions. These failures are retained separately from accepted results.

| Additional native journey | Source / result / local evidence |
| --- | --- |
| Registered owner in-progress configuration | `c95d151`, pass; `test-results/android-ux/local-owner-running/context-normalized/results.json`. Same three participant identities, owner End control, no solo input, safe Return to game/Home. |
| Registered owner overlay Back + three Home/resume cycles | `a9ce096`, pass; `test-results/android-ux/local-owner-running/back-return/results.json`. No private-channel collision after the lifecycle correction. |
| Registered member in-progress configuration | `5655d69`, pass; `test-results/android-ux/local-member-running/context/results.json`. Same three identities, no owner-only End control, no solo input. |
| Registered member overlay Back + three Home/resume cycles | `7f40c70`, pass; `test-results/android-ux/local-member-running/back-return/results.json`. |
| Pre-start registered owner | `7f40c70`, actual ARTEMIS/ADB exploration passes Room → Next/Matches → hardware Back/Room → Home → Return to room. Join code visible to owner. Match discovery reports the intentionally unavailable local command API; this does not establish native Start-button acceptance. |
| Pre-start registered member | `7f40c70`, same step/Back/Home path passes; join code absent and Matches says the host picks the six room matches. |
| Native guest pre-start | `7f40c70`, joined through the actual Room Code/Guest Name form as a disposable guest. App-created SecureStore grant, four participant identities, final Leave Guest Room action reachable by scrolling. Back/Close → Home → Return to Guest Room preserves identity and joinable status. |
| Native guest in-progress | `7f40c70`, game-context and three Back/Home/resume cycles pass; `test-results/android-ux/local-guest/game-context/results.json` and `back-return/results.json`. Read-only status shows four players/six matches; End Game is disabled. Existing polling observes fixture start and enters gameplay. |
| Native 130% system text | `7f40c70`, Home counts/shortcuts/Settings and guest status's complete Close/Home actions reachable and visually reviewed. `test-results/android-ux/local-guest/font130-*.png`; original font scale 1.0 restored and read back. |
| Native auth return | After `36bad02`, local member sign-in via Friends recovery → Requests → header Back returns Home in one transition. Subsequent owner/member fixture sign-ins use the same existing form; credentials remain local. |

Room data comparisons use read-only repeatable-read snapshots, excluding only operational activity timestamps and guest credential rotation. Owner `owner-running-fixed-before` → `owner-cycles-after`, member `member-running-before` → `member-running-after`, lobby `lobby-owner-before/after`, `lobby-member-before/after` and guest `guest-joined-before/after` all compare unchanged. State/owner/config, membership/leftAt/roles/drinks, scores, match/assignment identity, immutable event sequences and command counts are included. Snapshot files and the reusable capture/compare helper are ignored under `test-results/android-ux-local/invariants/`. These are paired UI/data checks, not a hosted two-device gameplay test.

Fixture setup intentionally adds the native guest and starts that disposable lobby with the existing owner RPC. Baselines are captured after each intentional setup mutation, so setup events are not confused with navigation mutations. Before joining, that lobby had three participants/nine events; after joining four/ten; after starting four/twelve. No gameplay or room command row was created by the navigation checks.

The runner now supports the explored role paths and a separate 22-assertion guard self-check. It rejects blank locators, malformed/out-of-display bounds and invalid identity fixtures. Independent runner review reproduced stale XML consumption when a dump failed without replacing its prior file; deleting only the owned temporary XML before every dump fixes it, with a failed-before/passed-after mocked regression. A missing new dump can no longer reuse a previous screen's bounds. Enlarged text exposed a second runner edge: a partially off-screen Continue Game node prematurely stopped scroll discovery. Scroll discovery now continues until its complete bounds fit the display; only the bounds-validation exception is caught, while ADB/display-discovery failures propagate. Both regressions failed before and pass after; no destructive action was added.

Guest `guest-running-before` → `guest-running-after` also compares unchanged after the in-progress status and all three Home/resume cycles. Both disposable rooms retain their post-setup membership, scores, assignments, event sequences and zero command rows.

After the final runner guard changes, a fresh native guest `layout-scroll` run passes at default text size (`test-results/android-ux/local-guest/final-layout-scroll-ready/results.json`): Friends/History/Settings and full Continue Game are reachable. The first attempt ran immediately after opening the dev client, before its prepared Home fixture was ready, and correctly failed; it is not counted as a product regression or a pass.

## Physical Chrome follow-up

Chrome 155.0.8059.39 on the same Huawei uses the local Metro build `7f40c70`, with ADB reverse and CDP only for fixture preparation/DOM measurements. Real input, keyboard, swipes and the final empty-list Next activation are executed on the phone. A full local-tab reload precedes the final checks, avoiding stale hot-refresh evidence.

| Case | Actual result / evidence |
| --- | --- |
| Trusted input + IME | Pass. Same input node stays focused; layout height 623, visual height 304. `test-results/android-ux/physical-chrome/final-7f40c70-focus.log`. |
| Empty list + keyboard + page pan | Pass. Real swipes move the outer owner from 0 → 150.33 → 372.33. At visual offset 319 the scrollport is exactly 319..623 and Next is 564..606, completely visible above the IME. Physical Next advances to Matches and commits exactly one `PhysicalWebFinal` player. `final-7f40c70-after-list-swipes.json/.png`, `final-7f40c70-once.json`. |
| 20-player list + keyboard | Pass. Twenty disposable local names were prepared through existing controls. Real list gestures produce 29 trusted touchmove events, outer scrollTop 1765.33/clientHeight 304/contentHeight 2069. Same focused input retains `PhysicalPending21`; saved count stays 20 and Next remains 564..606 at offset 319. `final-7f40c70-20-scroll.json/.png`. |
| 100 authenticated friends | Pass. Existing owner sign-in recovery loads 50 actual local friends; physical swipes reach Load more and then the second page's final row/action. 100 rendered names, 639 trusted touchmove events, scrollTop 12185.33/clientHeight 564/contentHeight 12749. Friend100 row y459.17..478.17 and complete action y490.67..535.67 fit the 360×623 visible viewport. No friendship action is sent. `final-7f40c70-friends100.json/.png`. Final room invariants remain unchanged. |
| Physical landscape | Inconclusive environment result, not accepted. Rotated screen reports 747×360 CSS pixels, but Chrome's outer/inner viewport reports approximately 680×623 and crops below the physical screen. A new blank HTML page with only a viewport meta tag reproduces the identical mismatch without DONG code (`landscape-blank-control.json`). Reload, fresh local tab, process restart and clearing a possible metrics override did not resolve it. Do not claim the cause was Playwright screenshots: installed screenshot code has no explicit metrics override, and a Chromium side effect is unproven. No app workaround was introduced. Original accelerometer rotation 1/user rotation 0 restored and read back. |

The intentionally unused command API produces a development error overlay after entering Matches. It intercepted a diagnostic Back click; browser Back and a Players reload cleared that development-only obstacle before preparing the 20-player fixture. This is distinct from the successful real Next transition and does not establish native/web match-discovery service acceptance.

## Visual evidence and requirement disposition

Reviewed screenshots and selected secret-free diagnostics are retained in `docs/ux-029-evidence/`; its README identifies build, platform, fixture and limitation. They include 320px/200% text, simulated landscape final actions, long team names, 100-item History/Friends fixtures, native role/status and physical Chrome keyboard/list checks. Cropped intermediate cards are scroll-position evidence; final controls/rows are checked against actual bounds. Physical testing confirmed a specific disabled-FlatList touch blockade and keyboard viewport/ancestry defects. Useful bounded lists and native virtualization remain; there was no blanket removal of scroll containers.

| Requirements | Implementation and remaining acceptance |
| --- | --- |
| FR-001–002 / SC-001 | Context-specific configuration/status and recovery implemented; native solo/owner/member/guest primary paths pass. Ended/expired/revoked recovery has automated coverage; full real-service negative-state matrix remains separate. |
| FR-003–006 / SC-002 | Scoped overlays, caller return, safe Home and direct/auth recovery implemented. Native primary overlay/Home cycles, Friends child return and sign-in recovery pass; broader release matrix remains separate. |
| FR-007–009 / SC-003 | Route parsing, hydration/readiness, Wizard/History restoration, missing data and account fences implemented; native History/lobby step Back passes. Real-service permission-revocation acceptance separate. |
| FR-010–014 / SC-004 | Actual DOM actions/links/focus, names, forms/errors, hidden feedback, main/headings/titles implemented and browser covered; real TalkBack, autofill and native announcements pending |
| FR-015–018 / SC-005 | Compact/landscape/200%-text and reduced motion automated checks pass; real IME empty/20-list gestures, 100 Friends and native 130% text pass. Physical landscape inconclusive and collapsed browser bars not established. |
| FR-019 / SC-006 | Home shortcuts, signed-in native return and signed-out native/web recovery pass; local History retained. |
| FR-020 | Navigation preserves authorization/history/identity boundaries. Real local owner/member/guest navigation leaves state, membership, scores, assignments, events and command counts unchanged. No schema/policy change. |
| SC-007 | Not fully accepted until separately listed runtime/release gates pass; automated tests are not substituted for them |

Audit disposition: N01 context, N02/W04 route position, N03–N07/N09 recovery/Back/caller/Home, N08 discovery, W01/W05/W06/W08/W09 semantics/forms/names/feedback and W02/W03 compact geometry have implementation and regressions. W07 Terms document/link is deferred by explicit user decision. Runtime-led T050–T052 additionally fix verified Realtime lifetime and web touch/IME defects.

Remaining acceptance: physical Chrome landscape on a browser/device with correct viewport reporting and collapsed browser bars; TalkBack/autofill/error announcements; packaged Android and deployed web; full real-service ended/expired/revoked recovery matrix. Native Start against the local Java API is not run. No story is labeled fully accepted merely because its implementation task is checked. No push, PR, remote deployment or release occurred.

Task reconciliation: 50 of 52 tasks complete. T041 retains the inconclusive/unestablished physical viewport matrix; T048 retains the separate manual and packaged-release acceptance gates above. T049 reconciliation is complete without promoting those checks to accepted. The final client source remains `7f40c70`; later runner/documentation/evidence commits do not change the tested client bundle. All three Spec Kit analysis findings were rechecked as resolved, with 100% FR/SC task mapping and no remaining critical/high artifact conflict.

Rollback requires no data migration/backfill: revert the affected delivery slice, rerun cross-story navigation, keep legacy bare paths/friendId compatibility, and never clear authoritative membership/history or revoke a guest grant as a navigation rollback.
