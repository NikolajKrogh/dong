# Validation quickstart

This guide describes future implementation validation. No product/tests/runner were implemented or executed during planning.

## Prerequisites

- Read spec.md, contracts/navigation.md, agent-handoff.md and [skills.md](skills.md). Confirm `git branch --show-current` is the intended integration/worker branch and record its SHA.
- Install existing dependencies with `npm install` when needed; use existing env bootstrap documented in CLAUDE.md. Do not print credentials or commit local fixture secrets.
- Use controlled local/test room/account fixtures for host, member, guest, solo, completed history and friend/request data; no mutation of observed production games. Seed only with existing approved fixture mechanisms. Record fixture manifest and identity boundaries.
- Device: `adb devices -l`; unlock/authorize it. If more than one device exists, ask the user which serial to use. ARTEMIS exploration precedes native test authoring; diagnose failures before trial-and-error reruns. Only one owner interacts with the phone at a time.

## Automated checks after implementation

```powershell
npm run test:ci -- --runInBand
npm run typecheck
npm run lint
npm run check:unused
npm run bdd:gen
npm run test:e2e
```

`test:unit` alone excludes `*.platform.test.tsx`; it is not the acceptance gate. Run relevant React Doctor review after React changes. Playwright's configured web server uses controlled fixtures/mocks; report those results separately from deployed/real-account evidence. New BDD stories are listed in tasks.md; retain affected existing game/lobby/guest/auth journeys.

Use installed playwright-best-practices guidance for locators, waits, fixtures, traces and targeted critical-journey repetition while retaining these BDD commands. Use the accessibility skill for rendered names/roles/focus/forms, keyboard, zoom and motion checks on affected screens. Available automated audits supplement manual interaction; they do not prove native TalkBack behavior or accessibility conformance. No new audit dependency/tool is installed implicitly by this guide.

For Android, after the planned runner is implemented, invoke `scripts/android/run-ux-journeys.ps1` with DeviceSerial, Package, Scenario, FixtureManifest and OutputDirectory as defined in agent-handoff.md. Its nonzero failures and unavailable prerequisites are blockers, not skips. `npm run android:dev` supplies the existing USB tunnels/dev-client startup; the installed native client must match required native dependencies. A dev-client run is not packaged release acceptance.

## Runtime matrix and expected outcomes

| Journey | Required evidence |
| --- | --- |
| US1 configuration | Solo same data; registered host/member same room and unchanged permissions; guest stays in guest-authorized status; expired/ended recovery; zero navigation-triggered mutation |
| US2 Back/return | Game actions, History details/sort, default leagues: first Back dismisses; keyboard dismissal does not leave task; Requests → Search/Blocked → arrow restores Requests, next Back leaves Friends; three Home/resume cycles have no duplicate pages; direct entry/recovery works |
| US3 route position | Solo/lobby steps, History tabs/target/sort/detail refresh and Back/Forward; pending player once; invalid prerequisites/unknown values normalize; account change/revoked target hides stale content |
| US4 accessibility | Web keyboard-only Home→setup and forms, named current steps/icons, visible focus, disabled control cannot activate, actual links/main/headings/titles; errors announce once; Android TalkBack/autofill/keyboard submission; hidden goal feedback absent from unrelated announcements |
| US5 geometry/scroll | Web 320/360/390 widths, 640×360 landscape, 200% text; physical Chrome browser bars/IME; Android portrait/enlarged font/IME; long names and 1/20/100 rows where meaningful; final action reachable, no overlap/horizontal overflow; reduced motion |
| US6 Home | Signed-in Friends/History each one activation; signed-out Friends recovery returns; local History retained; populated Home shortcuts reachable without Settings |

For scroll cases, start swipes over each populated list and at top/bottom boundaries; record which container moves. Bounded dialog scrolling may pass unchanged. Capture top/bottom and keyboard screenshots, effective CSS viewport and native font scale. Static screenshots alone do not prove gesture handoff.

## Evidence and completion

During implementation create `specs/029-web-android-ux/validation.md` recording build/SHA, platform, test command/scenario, fixtures, expected/actual and pass/fail/not-run, plus reviewed evidence paths. Add newly reproduced defects immediately. Use an ignored/local output directory for raw diagnostics; commit only reviewed relevant artifacts and no credentials/private hierarchy dumps.

Every story requires unit/component plus primary web/Android journey coverage and separate runtime evidence before acceptance. Manual TalkBack/autofill checks supplement executable tests. Android device/development/release-build and web fixture/live results are distinct. No fabricated room/data or mocked test turns an unexecuted runtime gate green.

## Recovery check

After returning Home, confirm the room can be reopened without joining again; no Leave/End command occurred. After malformed route/account changes, confirm safe fallback and no stale private results. If reverting a slice, retain old bare paths and friendId links and never clear membership/history as cleanup.
