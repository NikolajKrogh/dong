# Validation quickstart

Feature 029 implementation is integrated on `web-navigation`; this guide describes the implemented paths and executable checks, not a claim that every runtime gate passed. Reconciled against the integrated implementation and current runner source on 2026-10-17. [validation.md](validation.md) owns execution results and acceptance; [tasks.md](tasks.md) owns completion status. History shared-comparison/detail focus and Back regressions pass on both browser viewports.

## Prerequisites

- Read spec.md, contracts/navigation.md, agent-handoff.md and [skills.md](skills.md). Record `git branch --show-current` and `git rev-parse HEAD` for every validation run.
- Reuse installed dependencies and the existing environment bootstrap in CLAUDE.md. Run `npm install` only when dependencies are missing; do not print credentials or commit local fixture secrets.
- Use approved local/test fixtures for solo, registered host/member, guest, completed History and friend/request data. Browser service mocks are not an Android session seed or hosted permission proof. Do not create or mutate production games or relationships for these checks.
- Before Android interaction run `adb devices -l`, unlock/authorize the selected device, and ask the user which serial to use if selection is ambiguous. The coordinator serializes phone access and source updates. Follow AGENTS.md ARTEMIS exploration and diagnosis rules before adding native scenarios.

## Implemented journeys

| Area | Current behavior to verify |
| --- | --- |
| Active game context | Solo Setup returns to solo configuration. Registered configuration/status uses the existing room route and permissions. Guest status remains read-only inside gameplay, using the current guest grant/snapshot. Ordinary Home navigation preserves the active game/room; Leave/End remain explicit separate actions. |
| Back and overlays | Web game actions, room status, History sort and default-league panels use the router-owned transparent `/taskOverlay` route. First Back dismisses the panel; Close and Back share its lifecycle. Native retains existing modal/request-close presentation. A stale overlay entry recovers safely when its owner is unavailable. |
| Task position | Solo and pre-start lobby steps use stable query keys. Meaningful step/tab/target/detail changes create history; normalization and sort replace owned state. Wizard Back uses the owned previous task entry or a safe prior-step fallback. Hydration and navigation readiness precede normalization. |
| Friends and History | Search/Blocked header Back restores the caller's Friends/Requests tab. Signed-out Friends offers Sign in and Home with a validated return. History tab, comparison, sort and authorized detail resolve from URL state; legacy friendId links and local History still work. Unavailable detail explains recovery within main. |
| Semantics and Home | Destinations render as links and commands as buttons; shared controls retain native names/states. Affected pages have main/headings/titles; forms expose labels, purpose, password toggles and associated errors. Home has labeled Friends/History shortcuts within its established layout; Game Stats is display-only. |
| Compact layout | Schedule badges wrap below the title on narrow layouts; selected long team names wrap. Web viewports shorter than 480 CSS pixels use an outer Wizard page scroller so content and navigation remain reachable. Other layouts preserve the existing content scroller and native virtualization. Reduced-motion handling uses existing platform adapters. |

Exact route values and normalization rules remain in [contracts/navigation.md](contracts/navigation.md). These behaviors require the separate checks below; a source implementation or worker commit is not acceptance.

## Automated checks

Run from the checkout being validated:

```powershell
npm run test:ci -- --runInBand --cacheDirectory ./test-results/jest-cache
npm run typecheck
npm run lint
npm run check:unused
npm run bdd:gen
npm run test:e2e
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/android/test-ux-journey-guards.ps1
npx react-doctor@latest . --verbose --scope changed --base 2604e1a
```

Use `test:ci`, which supplies the repository's Node/Expo preload and includes platform component suites. Bare Jest bypasses that preload; `test:unit` excludes `*.platform.test.tsx` and is insufficient. Inspect relevant React Doctor findings rather than treating its score as acceptance.

For the feature's generated BDD files, including the coordinator's new History focus regression, use the existing entry point:

```powershell
$env:PLAYWRIGHT_WEB_PORT = '8196'
npm run test:e2e -- ux- --workers=2 --output=test-results/ux-browser-final
npm run test:e2e -- ux-route-state.feature --workers=1 --repeat-each=3 --trace=retain-on-failure --output=test-results/ux-route-repeat
```

`npm run test:e2e` runs generation before Playwright. The projects are `chromium-phone` and `chromium-desktop`; the phone project is a Chromium viewport, not an Android browser/device. The config starts or reuses an Expo web server and supplies mock service defaults; use a free dedicated port to avoid reusing a server from another checkout. Existing environment overrides can change those defaults, so record the effective fixture environment without secrets. Preserve affected existing game/lobby/guest/auth journeys alongside the new UX cases.

Use the installed Playwright skill for role/name locators, explicit state waits, isolation and targeted repetition. Use the accessibility skill for actual rendered DOM names/roles, keyboard focus, labels/errors, main/headings, text enlargement and motion checks. Renderer mocks do not establish actual DOM semantics. No new audit dependency is required. Copy reviewed screenshots/scroll diagnostics to a durable evidence location before another Playwright invocation: its output cleanup can delete previous `test-results` artifacts and caches.

## Android runner: current executable scope

The coordinator owns `scripts/android/run-ux-journeys.ps1`. It observes an already-open approved fixture; it does not install/launch DONG, log in, provision rooms, or grant guest access. Start the matching installed dev client with the existing `npm run android:dev` workflow when needed, then stop source integration/hot refresh during device checks. A dev-client pass is separate from packaged release acceptance.

Example invocation after preparing the selected fixture on Home:

```powershell
adb devices -l
.\scripts\android\run-ux-journeys.ps1 `
  -DeviceSerial '<approved-serial>' `
  -Package 'com.krogh.dong.dev' `
  -Scenario 'back-return' `
  -FixtureManifest 'C:\local\dong-ux\fixture.json' `
  -OutputDirectory '.\test-results\android-ux-back-return'
```

Accepted packages are `com.krogh.dong.dev` and `com.krogh.dong`. Scenario values are `game-context`, `back-return`, `route-state`, `accessibility`, `layout-scroll`, `home-shortcuts`, or `all`. See [agent-handoff.md](agent-handoff.md) for manifest fields and exact scenario limits. `all` runs the six implemented checks in sequence; it does not cover the entire acceptance matrix.

The runner checks explicit authorized device, foreground package, read-only manifest approval and scenario prerequisites. It uses fresh UIAutomator name/resource-ID/content-description matches, bounded polling/scrolling and hardware Back. Unsupported state or missing prerequisites produce exit 1 with `results.json` and a failure screenshot where available; they are not passing skips. Successful results describe only the selected scenario. Review screenshots before committing any evidence; raw hierarchy/account data stays local.

## Runtime matrix and remaining acceptance

| Journey | Required evidence beyond implementation/browser fixtures |
| --- | --- |
| US1 configuration | Same solo data; registered host and member stay in the same room with unchanged edit/start permissions; guest remains guest-authorized; expired/ended recovery; zero navigation-triggered mutation. Runner configuration checks support solo, registered owner/member and guest fixtures; results remain role/build-specific. |
| US2 Back/return | Overlay dismissal, keyboard-first dismissal, History detail/sort, default leagues, Requests child return, direct entry and repeated Home/resume cycles on Android. Current runner covers a narrower game-actions cycle and Friends search return. |
| US3 route position | Setup/lobby/History task Back, hydration, invalid prerequisites, refresh/Back/Forward, pending player once, account change and revoked-target privacy. Runner checks History Players-to-Games Back and the explored pre-start registered Room/Matches/Back path. History shared-comparison/detail focus and Back regression passes. |
| US4 accessibility | Native TalkBack, announcements, real autofill and keyboard submission; form/guest flows and hidden feedback. Runner checks named solo controls and IME dismissal only. Automated web checks do not establish accessibility conformance. |
| US5 geometry/scroll | Physical Chrome expanded/collapsed bars and IME; Android enlarged system font/IME; populated list gesture/boundary behavior and reduced motion. Browser 320/360/390, 640x360, 200% text simulation and 1/20/100-row evidence remain separate. Runner layout coverage is populated Home top/bottom reachability only. |
| US6 Home | Signed-in and signed-out shortcuts/recovery, local History, populated Home room re-entry on device. Runner Friends return requires the approved signed-in fixture. |
| Release | Matching packaged Android build plus production web build/runtime checks on approved fixtures; record build IDs, effective viewport/font and evidence separately. Dev-client, mocked browser and unit passes do not satisfy this gate. |

Registered host/member/guest Android acceptance remains pending unless validation.md explicitly records a completed run for that role/build. Do not infer it from solo or signed-in Friends checks. Retain not-run/blocked labels for unavailable prerequisites and any remaining physical/release checks.

For scroll cases, begin gestures over each populated list and at top/bottom boundaries; record which container moves, viewport, scroll offset and final-action reachability. Intentional bounded dialog scrolling may pass unchanged. Static screenshots alone do not prove gesture handoff or physical browser-bar behavior.

## Evidence and recovery

Record command/scenario, commit/build, platform, fixtures/role, expected/actual result, pass/fail/not-run and reviewed evidence paths in validation.md. The coordinator alone updates shared task checkboxes and acceptance status. Keep fixture/browser, real-account/device, development and release evidence distinct. Do not write credentials or private hierarchy dumps into committed reports.

After Home, reopen the same context without joining again; verify no Leave/End command occurred. After malformed routes/account changes, verify safe fallback and no stale private results. Reverting a slice must preserve bare paths, legacy friendId links, membership and History; do not clear user state as cleanup.
