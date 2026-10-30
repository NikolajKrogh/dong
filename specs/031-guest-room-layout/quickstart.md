# Verification

Install the lockfile dependencies with `npm ci`.

```powershell
npm run test:ci -- --runInBand --watchAll=false --cacheDirectory=./node_modules/.cache/guest-room-jest --testMatch '**/*.test.ts' '**/*.test.tsx'
npm run typecheck
npm run lint
npx bddgen
npx playwright test --config=playwright.config.ts guest-room-join guest-room-layout player-picked-two-devices --workers=2
npx react-doctor . --verbose --scope files --include-untracked --no-supply-chain --no-score --no-parallel
```

Use mocked local rooms for browser verification. Never seed production or expose guest credentials. Inspect 320px, 390px, tablet and desktop layouts in both themes; check common-match exclusion, long names, zero cap, modes, saving failure and access recovery.

The Tamagui CLI prompt generator is not installed in this project; implementation uses the actual local configuration, theme and tokens instead of adding a dependency.

Do not use the user's Android phone. Native interaction verification remains outstanding.

## Results — 2026-10-30

- All 166 actual client test suites passed: 1,081 tests. Explicit test filename patterns avoid the existing Windows discovery of fixture-only files as test suites.
- TypeScript and repository ESLint passed.
- All 44 guest-room, responsive-layout and host/member two-client browser scenarios passed across phone and desktop projects. The layout matrix explicitly uses 320, 390, 768 and 1280px viewports in both themes with long names and a 12-match selectable pool.
- Additional responsive reruns passed after visual polish. Screenshots cover both tabs; keyboard switching, Home/resume and persisted picks are asserted.
- React Doctor scanned 554 files, with no errors and three complexity warnings in GuestRoomContent, GuestRoomScreen and PlayerPickPanel. These are maintainability hints; no additional abstraction was added merely to change the metric.
- Visual corrections: room identity gets its own row, tabs align and fit narrow screens, the guest pick header is flat, shared team names wrap instead of truncating, and the VS column reserves less width. Clear picks is a text action for host and guest.
- The initial Android exploration task was stopped immediately when the user prohibited phone testing. No subsequent phone actions or native-device verification were performed.
- No production changes or deployment.

## Simplification follow-up

Tab keyboard handling and guest match rendering now live in focused local components. Status and pick-instruction helpers replace inline branching; disabled match selection is calculated in one place. Public component contracts, rendered layout, session control and credential handling are preserved.

TypeScript, ESLint, 58 focused tests and 22 local browser scenarios passed after the refactor. React Doctor reports no errors and one remaining screen-complexity warning, down from three warnings. The full repository suite was not repeated for this behavior-preserving pass.

## Naming follow-up

Renamed GuestJoinLobby to GuestRoomContent, including its file and component tests. Lifecycle refs now distinguish session IDs from booleans; the screen names its status message, leave-dialog visibility and paused actions explicitly. Home uses handleLeaveGuestRoom for the departure action. Historical migration/spec records retain their original names.
