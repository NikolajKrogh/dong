# dong Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-15

## Active Technologies
- TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, `react-native-toast-message`, existing `platform/` adapters, and new `tamagui` + `@tamagui/babel-plugin` foundation dependencies (112-setup-game-assignments)
- Existing Zustand + AsyncStorage persistence remains canonical; no new persisted storage or migration is required for this feature (112-setup-game-assignments)
- TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace + Expo Router 4, React 18.3.1, Zustand 5, AsyncStorage, Tamagui 1.141.5, `@tamagui/babel-plugin` 1.141.5, `react-native-toast-message`, `react-native-safe-area-context`, existing `platform/` adapters, and the current shell theme sources in `app/style/palette.ts` and `app/style/theme.ts` (121-us13-install-tamagui-and-migrate-the-application-shell)
- Existing Zustand + AsyncStorage persistence remains canonical; no new persisted storage or schema changes are planned (121-us13-install-tamagui-and-migrate-the-application-shell)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (124-us14-migrate-core-screens-to-responsive-tamagui-layouts)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (124-us14-migrate-core-screens-to-responsive-tamagui-layouts)
- TypeScript 5.3.3 in Expo SDK 52 / React Native 0.76.9 / React 18.3.1 + Expo Router 4, Tamagui 1.141.5, `react-native-safe-area-context`, `react-native-toast-message`, `react-native-reanimated`, Zustand 5, AsyncStorage (124-us14-migrate-core-screens-to-responsive-tamagui-layouts)
- N/A for this feature; existing Zustand + AsyncStorage state remains unchanged (124-us14-migrate-core-screens-to-responsive-tamagui-layouts)
- TypeScript 5.3.3 + Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, Tamagui 1.141.5, `playwright-bdd` 8.5.0, `@playwright/test` 1.59.1, `react-native-safe-area-context`, `react-native-toast-message`, Zustand 5 (multiplayer)
- N/A for this feature; no persisted data model changes (multiplayer)
- TypeScript 5.3.3 + Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, `playwright-bdd` 8.5.0, `@playwright/test` 1.59.1, `react-native-safe-area-context`, `react-native-toast-message`, Zustand 5 (multiplayer)
- N/A; this feature does not change persisted app data (multiplayer)
- TypeScript 5.3.3 Expo workspace plus SQL migrations executed via Supabase CLI against local Supabase Postgres + Supabase CLI, Supabase Auth/Postgres local stack, pgTAP database tests, `basejump-supabase_test_helpers` for authenticated DB test contexts, existing Expo SDK 52 / React Native 0.76.9 workspace (128-us21-create-the-core-supabase-schema-for-accounts-sessions-participants-matches-assignments-and-events)
- New top-level `supabase/` workspace for SQL migrations and database tests; Supabase Postgres becomes the canonical multiplayer store while the existing locally persisted session snapshot remains the temporary local cache until client integration ships (128-us21-create-the-core-supabase-schema-for-accounts-sessions-participants-matches-assignments-and-events)
- TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace, plus SQL migrations executed through Supabase CLI against local Supabase Postgres + Supabase CLI, Supabase Auth/Postgres local stack, pgTAP database tests, existing Expo Router 4 workspace, existing Supabase `public.accounts` anchor from US2.1 (151-add-data-rls)
- New `supabase/` workspace in the repo, with additional `public` schema tables for profiles, settings, and friendships, and RLS enabled on those tables plus the existing room tables (151-add-data-rls)
- TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace, plus SQL migrations and pgTAP tests executed against local Supabase Postgres + Supabase CLI, Supabase Auth/Postgres local stack, pgTAP database tests, existing Expo Router 4 workspace, Supabase `rpc()` support for SQL functions (126-us23-create-read-models-for-history-comparisons-and-leaderboards)
- Existing `supabase/` workspace with new read-model views/functions and supporting tests; no new business tables are introduced in this feature (126-us23-create-read-models-for-history-comparisons-and-leaderboards)
- TypeScript 5.3.3 in Expo SDK 52 / React Native 0.76.9 / React 18.3.1 + Expo Router 4, Zustand 5, AsyncStorage, `react-native-toast-message`, `@supabase/supabase-js`, Supabase Auth/Postgres local stack, Supabase CLI, pgTAP, `playwright-bdd`, `@playwright/test` (127-us24-add-one-time-local-to-cloud-import-for-existing-registered-users)
- Existing AsyncStorage history snapshot plus new private Supabase import ledger tables; imported sessions land in current `public.game_sessions`, `participants`, `matches`, `assignments`, and `gameplay_events` (127-us24-add-one-time-local-to-cloud-import-for-existing-registered-users)
- TypeScript 5.3.3 + Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, `@supabase/supabase-js` 2.105.4, Zustand 5, AsyncStorage, `expo-linking`, `react-native-safe-area-context`, `react-native-toast-message` (130-us31-allow-a-user-to-create-an-account-and-sign-in-as-a-host)
- Supabase Postgres for auth/account rows and RLS; AsyncStorage for the persisted Supabase session and the existing local game state; no new client persistence model (130-us31-allow-a-user-to-create-an-account-and-sign-in-as-a-host)
- TypeScript 5.3.3 + Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, `@supabase/supabase-js` 2.105.4, Zustand 5, AsyncStorage, `react-native-safe-area-context`, `react-native-toast-message`, `react-native-reanimated`, `playwright-bdd` 8.5.0, `@playwright/test` 1.59.1 (131-us32-allow-a-guest-to-join-a-room-from-their-own-device-without-creating-an-account)
- Existing Supabase Postgres room tables (`game_sessions`, `participants`, `matches`, `assignments`, `gameplay_events`) plus AsyncStorage for a persisted guest-room session grant; no new business tables are required (131-us32-allow-a-guest-to-join-a-room-from-their-own-device-without-creating-an-account)
- TypeScript 5.3.3 + Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, Zustand 5, AsyncStorage, Tamagui 1.141.5, @supabase/supabase-js 2.105.4, react-native-safe-area-context, react-native-toast-message, react-native-reanimated, playwright-bdd 8.5.0, @playwright/test 1.59.1 (131-us32-allow-a-guest-to-join-a-room-from-their-own-device-without-creating-an-account)
- Supabase Postgres for account and settings rows; AsyncStorage remains the local device fallback and game-state store (131-us32-allow-a-guest-to-join-a-room-from-their-own-device-without-creating-an-account)

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
- 131-us32-allow-a-guest-to-join-a-room-from-their-own-device-without-creating-an-account: Added TypeScript 5.3.3 + Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, Zustand 5, AsyncStorage, Tamagui 1.141.5, @supabase/supabase-js 2.105.4, react-native-safe-area-context, react-native-toast-message, react-native-reanimated, playwright-bdd 8.5.0, @playwright/test 1.59.1
- 131-us32-allow-a-guest-to-join-a-room-from-their-own-device-without-creating-an-account: Added TypeScript 5.3.3 + Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, `@supabase/supabase-js` 2.105.4, Zustand 5, AsyncStorage, `react-native-safe-area-context`, `react-native-toast-message`, `react-native-reanimated`, `playwright-bdd` 8.5.0, `@playwright/test` 1.59.1
- 130-us31-allow-a-user-to-create-an-account-and-sign-in-as-a-host: Added TypeScript 5.3.3 + Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, `@supabase/supabase-js` 2.105.4, Zustand 5, AsyncStorage, `expo-linking`, `react-native-safe-area-context`, `react-native-toast-message`



<!-- MANUAL ADDITIONS START -->

  skills before research, planning, implementation, or review. When a relevant
  skill exists, load its SKILL.md first.
  visibility, and gesture behavior in screens instead of importing the
  underlying platform-sensitive packages directly when an adapter exists.
  Jest coverage for the shared adapter behavior and at least one consuming
  screen regression.
materially redesigns a primary flow.
<!-- MANUAL ADDITIONS END -->
