# Phase 0 Research: Migrate Application Shell

## Decision 1: Complete the Tamagui foundation at the root shell and bind it to the persisted theme preference

- **Decision**: Populate the currently empty Tamagui integration seams (`tamagui.config.ts`, `babel.config.js`, and the root shell wiring in `app/_layout.tsx`) so the app has one root `TamaguiProvider`, with the active Tamagui theme derived from the existing persisted `theme` value in Zustand rather than the device color scheme.
- **Rationale**: The feature requirement is to preserve the current theme-switching behavior and honor saved appearance preferences at launch. Tamagui’s Expo guidance supports installing a provider at the Expo Router root, and the current app already stores theme state in the shared store. Using the store as the shell theme source avoids splitting theme authority between system color scheme and app preferences.
- **Alternatives considered**:
  - Use system theme detection only: Rejected because it would ignore the current persisted preference model.
  - Wrap only the migrated screens in Tamagui providers: Rejected because shell-level elements such as toasts and global overlays would remain outside the shared theme context.

## Decision 2: Translate the existing DONG design language into Tamagui tokens and themes before migrating screens

- **Decision**: Map the current palette and theme roles from `app/style/palette.ts`, `app/style/theme.ts`, and `DESIGN.md` into Tamagui tokens and light/dark themes first, then let migrated shell surfaces consume those shared values.
- **Rationale**: The user explicitly wants the Tamagui migration to match the current design as closely as possible. The repo already has a documented design language and concrete light/dark color roles, spacing rhythms, and surface conventions. Translating those existing roles into Tamagui reduces visual drift and prevents the migration from becoming an implicit redesign.
- **Alternatives considered**:
  - Adopt Tamagui’s default starter tokens and restyle the shell around them: Rejected because it would move the feature away from the accepted visual baseline.
  - Keep using ad hoc style objects alongside Tamagui components with no shared token mapping: Rejected because that would defeat the point of establishing a reusable design-system foundation.

## Decision 3: Keep a compatibility bridge for non-migrated screens instead of forcing a full token cutover

- **Decision**: Treat the current `app/style/theme.ts` and related style files as a compatibility bridge during this feature, so the root shell and pilot migrated screens can use Tamagui while the rest of the app continues to function without immediate rewrites.
- **Rationale**: Only the root shell, home, and preferences flows are in scope. Other routed screens still depend on the current style helpers. A compatibility bridge lets the migration land incrementally, keeps the story bounded, and avoids coupling this issue to an app-wide refactor.
- **Alternatives considered**:
  - Rewrite the entire app to Tamagui in one feature: Rejected because it exceeds the approved scope and would increase delivery risk.
  - Leave legacy style helpers untouched and unrelated to Tamagui themes: Rejected because that would make theme consistency harder to maintain during the hybrid period.

## Decision 4: Introduce a narrow set of shared shell primitives for the pilot migration

- **Decision**: Create a small reusable shell layer under `components/ui/` for high-value primitives such as screen scaffolds, cards, sections, and action buttons that both home and preferences can share.
- **Rationale**: The current design language repeats the same card, section, button, and header patterns across shell surfaces. A narrow primitive layer gives this migration a real design-system foothold without over-engineering a full component library on the first feature.
- **Alternatives considered**:
  - Migrate each screen directly to raw Tamagui primitives with no shared shell abstractions: Rejected because it would duplicate layout decisions and make later screen migrations inconsistent.
  - Design a large app-wide component system up front: Rejected because it would slow the feature and expand scope beyond the pilot shell surfaces.

## Decision 5: Preserve existing home-screen and preferences business logic while translating structure and surfaces

- **Decision**: Migrate the home and preferences screens as structure-first UI translations, keeping current navigation, splash or onboarding branching, current-game/history summaries, store actions, preference sections, and modal flows intact while their outer surfaces move to Tamagui-backed primitives.
- **Rationale**: The current shell behavior is already validated by tests and user flows. The goal of this feature is to change the UI foundation, not to rewrite the home or settings logic. Preserving controllers, state access, and existing modal logic reduces regression risk and keeps acceptance criteria focused on visual/system integration.
- **Alternatives considered**:
  - Rewrite screen logic and UI together: Rejected because it would make regressions harder to isolate.
  - Migrate only the root provider and postpone visible screen translation: Rejected because the issue explicitly includes home and preferences as pilot migrated screens.

## Decision 6: Keep the current testing stack and extend it rather than introducing a new QA strategy

- **Decision**: Extend the existing Jest-Expo regression tests and use web-only Playwright BDD coverage for the shell journeys, authored through `.feature` scenarios and shared step definitions, while treating React Native Testing Library as optional unless it is intentionally added during implementation.
- **Rationale**: The repo already includes `playwright-bdd` plus empty `e2e/features/`, `e2e/steps/`, and Playwright config scaffolds, so the most coherent move is to standardize this feature on Playwright-based web journeys rather than maintaining a separate native E2E layer. The package manifest still does not include `@testing-library/react-native`, so forcing a testing-stack migration inside this feature would add churn unrelated to the app-shell acceptance criteria.
- **Alternatives considered**:
  - Switch all component tests to Testing Library immediately: Rejected because it is orthogonal to the shell migration and not supported by the current dependency baseline.
  - Add a separate native E2E automation layer for this feature: Rejected because the requested automation strategy is Playwright on the web only.
  - Rely on manual smoke testing only: Rejected because the constitution requires automated unit coverage and end-to-end checks for substantial UI changes.

## Decision 7: Treat the existing empty Tamagui config, Babel config, and test helper files as unfinished integration seams

- **Decision**: Plan implementation as if the Tamagui dependency footprint exists but the foundation is incomplete, meaning the feature must verify and finish config, compiler, provider, and test-helper wiring before the migrated screens are considered done.
- **Rationale**: `tamagui` and `@tamagui/babel-plugin` are declared in `package.json`, but `tamagui.config.ts`, `babel.config.js`, and `test-utils/tamagui.tsx` are currently empty in this workspace. The safest plan is to complete those seams explicitly instead of assuming the dependency setup is already production-ready.
- **Alternatives considered**:
  - Assume prior dependency setup is complete and skip foundation validation: Rejected because the current file state does not support that assumption.
  - Replace the current dependency footprint with a different UI library: Rejected because the issue explicitly targets Tamagui.
