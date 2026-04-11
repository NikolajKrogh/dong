# dong Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-11

## Active Technologies

- TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, `expo-av`, `react-native-date-picker`, `react-native-ui-datepicker`, `lottie-react-native`, `react-native-gesture-handler`, `react-native-reanimated`, Jest-Expo 52 (111-add-platform-abstractions)
- Existing Zustand + AsyncStorage persistence remains unchanged; no new storage for this feature (111-add-platform-abstractions)

- Markdown documentation artifact inside a TypeScript 5.3.3 / Expo SDK 52 workspace + Expo Router 4, React Native 0.76.9, React 18.3.1, Zustand 5, AsyncStorage, Jest-Expo 52 (110-define-design-language)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

Markdown documentation artifact inside a TypeScript 5.3.3 / Expo SDK 52 workspace: Follow standard conventions

## Recent Changes

- 111-add-platform-abstractions: Added TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, `expo-av`, `react-native-date-picker`, `react-native-ui-datepicker`, `lottie-react-native`, `react-native-gesture-handler`, `react-native-reanimated`, Jest-Expo 52

- 110-define-design-language: Added Markdown documentation artifact inside a TypeScript 5.3.3 / Expo SDK 52 workspace + Expo Router 4, React Native 0.76.9, React 18.3.1, Zustand 5, AsyncStorage, Jest-Expo 52

<!-- MANUAL ADDITIONS START -->

- AI contributors MUST check for applicable repository, platform, or domain
  skills before research, planning, implementation, or review. When a relevant
  skill exists, load its SKILL.md first.
- Use the shared `platform/` adapters for audio, date input, animation,
  visibility, and gesture behavior in screens instead of importing the
  underlying platform-sensitive packages directly when an adapter exists.
- Screen migrations that adopt a new platform capability MUST add or update
  Jest coverage for the shared adapter behavior and at least one consuming
  screen regression.
- Include end-to-end coverage for the primary user journey when a change
materially redesigns a primary flow.
<!-- MANUAL ADDITIONS END -->
