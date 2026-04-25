# dong Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-19

## Active Technologies
- TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, `react-native-toast-message`, existing `platform/` adapters, and new `tamagui` + `@tamagui/babel-plugin` foundation dependencies (112-setup-game-assignments)
- Existing Zustand + AsyncStorage persistence remains canonical; no new persisted storage or migration is required for this feature (112-setup-game-assignments)
- TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, Tamagui 1.141.5, `@tamagui/babel-plugin` 1.141.5, `react-native-toast-message`, `react-native-safe-area-context`, existing `platform/` adapters, and the current shell theme sources in `app/style/palette.ts` and `app/style/theme.ts` (121-us13-install-tamagui-and-migrate-the-application-shell)
- Existing Zustand + AsyncStorage persistence remains canonical; no new persisted storage or schema changes are planned (121-us13-install-tamagui-and-migrate-the-application-shell)

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
- 121-us13-install-tamagui-and-migrate-the-application-shell: Added TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, Tamagui 1.141.5, `@tamagui/babel-plugin` 1.141.5, `react-native-toast-message`, `react-native-safe-area-context`, existing `platform/` adapters, and the current shell theme sources in `app/style/palette.ts` and `app/style/theme.ts`
- 112-setup-game-assignments: Added TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, `react-native-toast-message`, existing `platform/` adapters, and new `tamagui` + `@tamagui/babel-plugin` foundation dependencies

- 111-add-platform-abstractions: Added TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, `expo-av`, `react-native-date-picker`, `react-native-ui-datepicker`, `lottie-react-native`, `react-native-gesture-handler`, `react-native-reanimated`, Jest-Expo 52


<!-- MANUAL ADDITIONS START -->

  skills before research, planning, implementation, or review. When a relevant
  skill exists, load its SKILL.md first.
  visibility, and gesture behavior in screens instead of importing the
  underlying platform-sensitive packages directly when an adapter exists.
  Jest coverage for the shared adapter behavior and at least one consuming
  screen regression.
materially redesigns a primary flow.
<!-- MANUAL ADDITIONS END -->
