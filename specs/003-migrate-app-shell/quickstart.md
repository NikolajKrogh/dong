# Quickstart: Migrate Application Shell

## Goal

Complete the Tamagui foundation for the Expo shell and migrate the root shell, home screen, and preferences screen without changing the existing user flows or visual language.

## Inputs

- `specs/003-migrate-app-shell/spec.md`
- `specs/003-migrate-app-shell/plan.md`
- `specs/003-migrate-app-shell/research.md`
- `specs/003-migrate-app-shell/data-model.md`
- `specs/003-migrate-app-shell/contracts/application-shell-contract.md`
- `DESIGN.md`
- `app/_layout.tsx`
- `app/index.tsx`
- `app/userPreferences.tsx`
- `app/style/palette.ts`
- `app/style/theme.ts`
- `components/preferences/`
- `components/ui/`
- `e2e/features/`
- `e2e/steps/`
- `tamagui.config.ts`
- `babel.config.js`
- `playwright.config.ts`

## Implementation Steps

1. Finish the Tamagui foundation by defining the root config, compiler wiring, and any required theme bridge helpers so the shell can consume Tamagui tokens and themes.
2. Add the Tamagui provider composition to `app/_layout.tsx`, keeping gesture handling, routed screens, and toast rendering inside the themed shell.
3. Create or complete reusable shell primitives in `components/ui/` for shared cards, sections, buttons, and screen scaffolds that home and preferences can both consume.
4. Map the existing DONG palette and theme roles into Tamagui light and dark themes while keeping a compatibility bridge for non-migrated screens.
5. Migrate the home screen structure to the new shell primitives and themes while preserving splash or onboarding branching, current-game and history summaries, navigation, and existing platform adapter usage.
6. Migrate the preferences shell and any visible modal containers that must match the new shell while preserving store actions, appearance switching, onboarding access, and league-management flows.
7. Add or update Jest coverage for root layout provider activation, migrated home behavior, migrated preferences behavior, and any new shared shell primitives.
8. Add or update Playwright BDD coverage for the shell journeys in a `.feature` file plus shared step definitions for launch, home-shell visibility, and theme switching on the web.
9. Run linting and a post-change React Doctor pass to catch React-specific regressions before implementation is considered complete.

## Verification Commands

```bash
npm test
npm run lint
npx playwright test
npx -y react-doctor@latest . --verbose --diff
```

## Platform Test Strategy

- Use Jest for cross-platform regression coverage of root-shell composition, migrated home and preferences behavior, and shell primitives on native and web render targets.
- Use Playwright BDD for web shell journeys (`launch -> home -> preferences -> appearance change -> continued shell usage`) through `.feature` scenarios and shared step definitions.
- Treat coverage as complete only when both Jest and Playwright checks pass for this feature.

## Verification Journey Map

| Journey ID | Journey | Primary assertions | Automation surface | Task coverage |
| ---------- | ------- | ------------------ | ------------------ | ------------- |
| `journey-launch-themed-shell` | Launch the app into the themed shell and confirm shell-level behavior remains usable. | Root provider is active, theme is applied from persisted preference, global shell behaviors render correctly. | Jest + Playwright BDD | `T007`, `T008`, `T009`, `T012`, `T025` |
| `journey-home-preferences-theme-switch` | Navigate home -> preferences -> appearance switch -> continue using shell without restart. | Home and preferences remain usable, theme updates in-session, chosen mode remains active on continued usage. | Jest + Playwright BDD | `T014`, `T018`, `T019`, `T020`-`T023`, `T025` |

## Smoke Checklist

- The app launches into a visibly themed shell on web and native.
- The home screen still reaches splash or onboarding, current-game, and history-present states as before.
- The preferences screen still exposes appearance settings, league management, and onboarding entry.
- Switching theme from preferences updates the active shell immediately and remains in effect after relaunch.
- Toasts, overlays, and gesture-aware shell behavior still work inside the themed root shell.
- Record the SC-004 design review outcome (zero severity-1 mismatches) in the PR or release notes before closing the feature.

## Future Adoption Guide

- Add future shell-adjacent screens through `components/ui/` shell primitives before introducing one-off layout patterns.
- Treat the Tamagui theme mapping as the canonical shell token source, and keep the legacy theme bridge only for screens that have not yet migrated.
- Preserve store-driven theme selection rather than introducing secondary theme sources for individual screens.
- When automation anchors change, update the Playwright `.feature` scenarios and shared step definitions in the same change.
- Run `react-doctor` after non-trivial React UI migrations to catch correctness and architecture regressions early.

## Test Mock Pattern

Tests that import components using shell primitives must mock `components/ui` to avoid loading the full Tamagui config chain (`tamagui.config.ts` → `tamaguiThemes.ts` → `tamaguiTokens.ts`). Use this pattern:

```ts
jest.mock("../../components/ui", () => ({
  ShellScreen: ({ children, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(RN.View, { testID: "ShellScreen", ...props }, children);
  },
  ShellSection: ({ children, title, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(RN.View, { testID: "ShellSection", ...props },
      title ? R.createElement(RN.Text, null, title) : null,
      children);
  },
  ShellCard: ({ children, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(RN.View, { testID: "ShellCard", ...props }, children);
  },
  ShellActionButton: ({ label, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");
    return R.createElement(RN.View, { testID: "ShellActionButton", ...props },
      label ? R.createElement(RN.Text, null, label) : null);
  },
}));
```

Adjust the relative path (`../../`, `../../../`, etc.) based on the test file location.

## Expected Output

- A working Tamagui-backed root shell exists.
- Home and preferences are migrated to the new shell foundation while preserving current behavior.
- The shell continues to match the documented DONG design language in light and dark modes.
- Jest and Playwright BDD coverage protect the primary launch and theme-switching journeys.
