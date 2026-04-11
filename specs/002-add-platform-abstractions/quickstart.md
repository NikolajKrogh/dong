# Quickstart: Introduce Platform Abstractions for Web Blockers

## Goal

Implement a shared `platform/` layer that removes current web blockers from screen code while preserving current native outcomes and providing explicit web fallbacks.

## Inputs

- `specs/002-add-platform-abstractions/spec.md`
- `specs/002-add-platform-abstractions/plan.md`
- `specs/002-add-platform-abstractions/research.md`
- `specs/002-add-platform-abstractions/data-model.md`
- `specs/002-add-platform-abstractions/contracts/platform-capability-contract.md`
- `app/gameProgress.tsx`
- `components/setupGame/MatchFilter.tsx`
- `components/OnboardingScreen.tsx`
- `components/gameProgress/TabNavigation.tsx`
- `app/index.tsx`
- `components/setupGame/MatchList.tsx`

## Implementation Steps

1. Create the shared `platform/` directory and define stable consumer-facing entry points for audio, date input, animation, visibility, and gestures.
2. Implement the audio adapter so `gameProgress` no longer imports `expo-av` directly and native-only audio mode details stay inside the adapter.
3. Implement the visibility adapter so foreground/background or page-visibility behavior is normalized before `gameProgress` consumes it.
4. Implement the date-input adapter so `MatchFilter` uses one shared contract while native keeps the existing picker and web uses the installed web-capable picker.
5. Implement animation adapters or wrappers for splash/loading and any transition-sensitive onboarding behavior so unsupported animation runtimes do not block web rendering.
6. Implement gesture wrappers or policies so onboarding and tab navigation keep native gesture enhancements while retaining obvious web-safe primary controls.
7. Replace direct capability-specific imports in the affected screens with imports from `platform/`.
8. Add Jest coverage for adapter logic and representative consumer regressions.
9. Run native and web smoke checks for splash/loading, onboarding progression, setup-game date filtering, tab switching, and game-progress sound behavior.

## Verification Commands

```bash
npm test
npm run lint
```

## Smoke Checklist

- Web can load the home screen without Lottie-related crashes.
- Web can progress through onboarding without relying on fling gestures.
- Web can open the setup-game filter and choose date/time values through the shared date-input contract.
- Web can open game progress without direct native-only imports breaking the screen.
- Native still plays the goal cue, respects visibility changes, and preserves the current tab/onboarding gesture enhancements.

## Future Adoption Guide

- Import covered platform behavior from `platform/` rather than directly from native-sensitive packages inside screens.
- Use `useGoalSound` together with `useAppVisibility` for foreground-gated audio behavior.
- Use `PlatformDatePicker`, `PlatformTimePicker`, and the shared date/time normalization helpers for schedule or filter state.
- Use `PlatformAnimation` for splash and loading states, and always provide an explicit fallback when the animation is decorative.
- Use `PlatformGestureRoot`, `PlatformGestureView`, or `PlatformSwipeTabs` only when visible primary controls still let the player complete the same task.
- When a new screen adopts a shared platform capability, add or update Jest coverage for the shared adapter behavior and one consuming-screen regression.

## Expected Output

- A new reusable `platform/` capability layer exists.
- The affected screens stop importing platform-sensitive packages directly for the blocker areas in scope.
- Jest coverage protects the adapter logic and the main consumer regressions.
