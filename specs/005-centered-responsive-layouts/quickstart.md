# Quickstart: Restore Centered Responsive Layouts

## What this feature changes

This feature restores centered responsive layout behavior across Home, Setup,
Game Progress, History, and Settings. It does not change game data or storage.

## Verification steps

1. Regenerate the Playwright-BDD output before any browser run:

```bash
npm run bddgen
```

2. Run the targeted responsive route and component tests:

```bash
npx jest __tests__/components/ui/ShellScreen.platform.test.tsx __tests__/app/index.platform.test.tsx __tests__/components/setupGame/SetupWizard.platform.test.tsx __tests__/app/setupGame.platform.test.tsx __tests__/app/gameProgress.platform.test.tsx __tests__/app/history.platform.test.tsx __tests__/app/userPreferences.platform.test.tsx --runInBand
```

3. Run the full headed browser pass for the generated app-shell flow on both projects:

```bash
npx playwright test .features-gen/e2e/features/app-shell.feature.spec.js --project=chromium-phone --project=chromium-desktop --headed
```

4. Run the dedicated headed Home shell checks with the standalone config:

```bash
npx playwright test --config=playwright.home.config.ts home-shell-flow.spec.ts --project=chromium-phone --project=chromium-desktop --headed
```

5. If the setup wizard structure changes, rerun the setup route test immediately before widening the scope.

## Manual check list

- Home content stays centered and does not drift left or right.
- Setup keeps the stepper, main panel, and navigation buttons aligned.
- Game Progress and History remain centered after navigation.
- Settings keeps its header and scroll content readable at both narrow and wide widths.
- Rotating or resizing the viewport preserves the same centered axis.

## Success signal

The feature is ready when the targeted responsive Jest suite passes, the full headed `app-shell` browser suite passes on both viewport projects, and the dedicated headed Home shell flow passes through `playwright.home.config.ts` without centered elements drifting out of alignment.
