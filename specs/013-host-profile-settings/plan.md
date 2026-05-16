# Implementation Plan: Host Profile and Synced Settings

**Branch**: `013-host-profile-settings` | **Date**: 2026-05-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-host-profile-settings/spec.md`

## Summary

Extend the existing host preferences experience so a signed-in host can edit profile identity on the account row and keep the supported preferences set synced through the existing settings row. The plan preserves local gameplay state in AsyncStorage, hydrates cloud-backed account state on sign-in and session restore, and keeps device-local state intact when the user signs out or a session expires.

## Technical Context

**Language/Version**: TypeScript 5.3.3  
**Primary Dependencies**: Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, Zustand 5, AsyncStorage, Tamagui 1.141.5, @supabase/supabase-js 2.105.4, react-native-safe-area-context, react-native-toast-message, react-native-reanimated, playwright-bdd 8.5.0, @playwright/test 1.59.1  
**Storage**: Supabase Postgres for account and settings rows; AsyncStorage remains the local device fallback and game-state store  
**Testing**: Jest unit tests, React Test Renderer platform tests, pgTAP database tests, Playwright BDD web coverage, lint  
**Applicable Skills**: supabase, database-testing, react-native-testing, playwright-bdd, tamagui  
**Target Platform**: iOS, Android, and web  
**Project Type**: Cross-platform Expo mobile app  
**Performance Goals**: Keep preferences interactions at current screen responsiveness and hydrate synced state without adding noticeable startup jank  
**Constraints**: Preserve the existing AsyncStorage-based local state, keep RLS/grants in place for exposed Supabase tables, and avoid introducing a custom backend layer  
**Scale/Scope**: One preferences surface, one auth/session boundary, one account row migration, one settings row sync path, and the related unit/database/e2e tests

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Cross-platform behavior is defined for native and web wherever the feature touches user-facing behavior.
- Shared-state changes identify Supabase account and settings rows as the source of truth, with session restore and save paths called out as idempotent app-side writes.
- Data-model changes describe the account-row migration, settings sync shape, and backfill or restore behavior; no game-history events are introduced.
- Work remains sliced into independently testable user stories with Gherkin acceptance criteria.
- The test plan covers unit behavior, database constraints/RLS, and a primary web end-to-end journey for the substantial preferences flow.
- Applicable repository, platform, and domain skills were identified before design work began.

## Project Structure

### Documentation (this feature)

```text
specs/013-host-profile-settings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── _layout.tsx
└── userPreferences.tsx

components/
├── auth/
├── preferences/
└── ui/

hooks/
├── useAccountAuth.ts
└── useGameProgressController.ts

supabase/
├── migrations/
└── tests/

__tests__/
├── app/
├── components/
└── hooks/

e2e/
├── features/
└── steps/

store/
└── store.ts
```

**Structure Decision**: Keep the implementation inside the existing Expo app shell, expand `hooks/useAccountAuth.ts` for account/profile/session orchestration, keep the synced preference payload in `public.settings`, and add the supporting database, unit, and Playwright coverage alongside the current app and Supabase directories. No `contracts/` directory is needed because the feature does not introduce a new public HTTP or CLI interface.

## Complexity Tracking

None. The plan stays within the existing app, Supabase schema, and test harnesses.
