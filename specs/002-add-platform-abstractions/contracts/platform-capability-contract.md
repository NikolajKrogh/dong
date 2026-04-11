# Platform Capability Contract

## Purpose

Define the internal contract that the new shared `platform/` layer must expose so DONG screens can consume audio, date input, animation, app visibility, and gesture behavior without importing platform-sensitive packages directly.

## Deliverable Location

- Shared implementation root: `platform/`
- Planning contract artifact: `specs/002-add-platform-abstractions/contracts/platform-capability-contract.md`

## Consumers

- `app/gameProgress.tsx`
- `components/setupGame/MatchFilter.tsx`
- `components/OnboardingScreen.tsx`
- `components/gameProgress/TabNavigation.tsx`
- `app/index.tsx`
- `components/setupGame/MatchList.tsx`

## Required Capability Contracts

| Capability   | Required contract outcome                                                                                   | Native expectation                                                       | Web expectation                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `audio`      | Screens can request cue playback and stop playback without handling platform-specific audio mode details.   | Preserve current cue playback behavior using the existing audio runtime. | Do not crash or expose native-only config; play supported audio when possible and otherwise fail safely without blocking the flow. |
| `dateInput`  | Screens receive a controlled date/time input surface with stable output values.                             | Preserve the current native picker experience.                           | Render a supported web picker with the same outward value contract used by the screen.                                             |
| `animation`  | Decorative or transitional motion never blocks screen render.                                               | Render existing native animations where already used.                    | Replace unsupported animation runtimes with explicit fallbacks that preserve user comprehension.                                   |
| `visibility` | Screens can determine whether the app/page is interactive through one normalized signal.                    | Use app lifecycle state.                                                 | Use page visibility state.                                                                                                         |
| `gesture`    | Screens can expose gesture-enhanced interactions without making gestures the only way to complete the task. | Preserve current swipe/fling behavior where already implemented.         | Prefer visible primary controls and only use web-safe gestures where they do not interfere with scroll or discoverability.         |

## Authoring Rules

- Consuming screens must import only from the shared `platform/` layer for the five capability areas in scope.
- The contract must expose platform-agnostic names and data shapes; screens must not branch on package-specific return types.
- Every capability must define both the full behavior and the fallback behavior.
- Fallback behavior must preserve task completion, not just prevent runtime failure.
- Gesture-enhanced screens must always retain a visible non-gesture path for the same action.
- Decorative animation failure must never block the surrounding screen or loading state.
- Visibility state must be reusable by consumers beyond audio playback.

## Capability-Specific Acceptance Rules

### Audio

- Consumers can request playback without importing `expo-av` directly.
- Native-only audio-mode configuration stays inside the adapter.
- Playback requests resolve safely even if the current platform restricts immediate playback.

### Date Input

- Consumers receive the same value semantics on native and web.
- The shared date-input contract owns confirm, cancel, and normalization behavior.
- Consuming screens do not import `react-native-date-picker` directly.

### Animation

- Screens can request a named animation use case without importing `lottie-react-native` directly.
- Web fallback visuals are explicit for splash and loading states.
- Decorative transitions cannot be a hard dependency for reading content or progressing through onboarding.

### Visibility

- Consumers can subscribe to a normalized active/inactive signal without direct `AppState` usage.
- The signal must be suitable for gating audio or similar foreground-only behavior.

### Gesture

- Consumers can opt into gesture behavior without importing gesture packages directly for the covered use cases.
- Tab switching and onboarding progression must remain possible through visible controls even when gesture fallback is active.
- Web gesture behavior must not break vertical scrolling in the surrounding view.

## Adoption Contract

The implementation is acceptable only if all of the following are true:

- The affected screens no longer import the capability-specific packages directly for the blockers in scope.
- Each capability in scope has a documented native path and a documented web path or fallback.
- Representative native and web smoke checks can verify the same surrounding user task still completes.
- The abstraction layer is reusable enough that future screen migrations can adopt it without re-solving package compatibility in the screen itself.
