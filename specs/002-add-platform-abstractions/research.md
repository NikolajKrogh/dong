# Phase 0 Research: Introduce Platform Abstractions for Web Blockers

## Decision 1: Add a dedicated top-level `platform/` capability layer

- **Decision**: Create a new top-level `platform/` directory that owns capability-specific adapters for audio, date input, animation, visibility, and gestures, with screens importing those shared contracts instead of reaching platform-sensitive packages directly.
- **Rationale**: The current blockers are spread across `app/gameProgress.tsx`, `components/setupGame/MatchFilter.tsx`, `components/OnboardingScreen.tsx`, `components/gameProgress/TabNavigation.tsx`, `app/index.tsx`, and `components/setupGame/MatchList.tsx`. A dedicated layer keeps those concerns out of screen code, supports incremental adoption, and gives later screen migrations one predictable import surface.
- **Alternatives considered**:
  - Scatter helpers across `utils/` and `hooks/`: Rejected because that would fragment capability ownership and make it harder to discover the supported platform surface.
  - Keep platform branching inside each screen: Rejected because it repeats compatibility work and violates the story goal of centralizing web blockers.

## Decision 2: Keep the existing `expo-av` dependency for now, but hide all audio behavior behind a shared wrapper

- **Decision**: Use a shared audio adapter that continues to rely on the existing `expo-av` package for playback, but moves native-only audio mode setup and playback lifecycle management out of `app/gameProgress.tsx` and exposes a no-throw contract to screens.
- **Rationale**: Expo documents `Audio.Sound` as cross-platform playback infrastructure, but the current screen mixes that with native interruption-mode configuration and lifecycle handling. Wrapping the existing dependency removes the web blocker without expanding scope into a full audio-library migration.
- **Alternatives considered**:
  - Migrate immediately to `expo-audio`: Rejected because `expo-av` deprecation is real but outside this story’s blocker-removal scope.
  - Use raw browser `Audio` on web and `expo-av` on native: Rejected because it would duplicate playback logic and increase behavior drift between platforms.

## Decision 3: Use a split date-input strategy, not a one-size-fits-all picker

- **Decision**: Keep `react-native-date-picker` for iOS and Android behavior, but route web through a separate shared date-input implementation using the already installed `react-native-ui-datepicker`, while normalizing the outward value contract so consuming screens do not know which picker rendered.
- **Rationale**: The current `react-native-date-picker` package documents itself as an iOS/Android native component, while `react-native-ui-datepicker` is already installed and explicitly supports Android, iOS, and web. Using the web-capable dependency only where needed minimizes UX churn on native while unblocking the web build.
- **Alternatives considered**:
  - Replace native pickers everywhere with `react-native-ui-datepicker`: Rejected because this story is about blocker removal, not a cross-platform date UX redesign.
  - Fall back to plain text input on web: Rejected because it would weaken validation and make date/time selection materially less usable.

## Decision 4: Treat Lottie as an enhancement and define explicit fallback renderers for web

- **Decision**: Introduce an animation abstraction that renders `lottie-react-native` only where supported and falls back to simpler supported visuals on web, such as a static logo plus fade for splash and an activity/loading indicator for loading states.
- **Rationale**: The current animation usage is concentrated in `app/index.tsx` and `components/setupGame/MatchList.tsx`, while upstream Lottie React Native documentation targets native platforms rather than web. The safest web-unblocking move is to preserve the user outcome without adding a new web animation runtime.
- **Alternatives considered**:
  - Add a web-specific Lottie library such as `lottie-react`: Rejected because it increases scope, adds another runtime surface, and is unnecessary for blocker removal.
  - Disable all animation behavior on every platform: Rejected because native already has acceptable behavior and only web needs a fallback.

## Decision 5: Abstract app visibility as a shared signal instead of using `AppState` directly in screens

- **Decision**: Create a shared visibility hook/service that maps native app lifecycle state from `AppState` and web page visibility from the browser document into a normalized active/inactive visibility signal.
- **Rationale**: React Native documents `AppState` as the native foreground/background mechanism, but issue #122 explicitly calls for a browser-aware abstraction. Centralizing visibility handling lets audio and any future foreground-sensitive behavior use one source of truth.
- **Alternatives considered**:
  - Leave `AppState` in `app/gameProgress.tsx`: Rejected because it keeps browser-specific visibility logic out of reach and repeats platform reasoning in feature code.
  - Handle visibility only inside the audio wrapper: Rejected because visibility is a reusable capability that may matter beyond sound playback.

## Decision 6: Make gesture fallbacks explicit and keep non-gesture controls primary on web

- **Decision**: Keep gesture-handler and Reanimated interactions on native where they already work well, but define web fallbacks that preserve the same task through explicit controls first, using gesture wrappers on web only when they add value without breaking scroll or discoverability.
- **Rationale**: `components/OnboardingScreen.tsx` already exposes skip/continue buttons, and `components/gameProgress/TabNavigation.tsx` already exposes tab buttons. Web does not need full fling or pan parity if the same task remains available through visible controls. Gesture Handler’s web docs also call out web-specific `touchAction` behavior, which should stay inside a shared wrapper instead of being repeated across screens.
- **Alternatives considered**:
  - Reproduce full native gesture parity on web: Rejected because it adds complexity without improving core task completion for these screens.
  - Disable gestures globally, including native: Rejected because native swipe behavior is already part of the experience and not itself the blocker.

## Decision 7: Focus automated coverage on adapter logic and representative consumer regressions

- **Decision**: Add Jest coverage for platform adapter selection, fallback behavior, and representative consumer logic in the affected screens, but do not require a new end-to-end suite for this story.
- **Rationale**: This feature changes platform behavior and import boundaries, so automated coverage is mandatory under the constitution. The highest-leverage protection is unit and targeted regression coverage for the new abstraction layer and its main consumers, not a broader journey test for an unchanged overall flow.
- **Alternatives considered**:
  - Manual verification only: Rejected because the constitution requires automated coverage for new behavior.
  - New web end-to-end automation for the whole app: Rejected because the story does not introduce a new primary journey or substantial UI redesign.
