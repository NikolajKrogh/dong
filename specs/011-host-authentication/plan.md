# Implementation Plan: Account Authentication

**Branch**: `130-us31-host-authentication` | **Date**: 2026-05-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-host-authentication/spec.md`

## Summary

Build a Supabase-backed account auth flow that lets a user sign up or sign in with email and password, persist the session across launches, bootstrap `public.accounts` client-side on first authenticated access, store the visible multiplayer name in `public.accounts.preferred_display_name`, and gate only multiplayer owner and room-management surfaces while leaving local game setup, history, and preferences public.

## Technical Context

**Language/Version**: TypeScript 5.3.3
**Primary Dependencies**: Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, `@supabase/supabase-js` 2.105.4, Zustand 5, AsyncStorage, `expo-linking`, `react-native-safe-area-context`, `react-native-toast-message`
**Storage**: Supabase Postgres for auth/account rows and RLS; AsyncStorage for the persisted Supabase session and the existing local game state; no new client persistence model
**Testing**: Jest-Expo plus React Native Testing Library for auth hooks/screens, Supabase CLI plus pgTAP for schema and RLS validation, Playwright BDD for the web auth journey
**Applicable Skills**: `supabase`, `database-testing`, `supabase-postgres-best-practices`, `react-native-testing`
**Target Platform**: iOS, Android, and web
**Project Type**: Mobile app with web support
**Performance Goals**: Restore auth state without blocking shell render; sign-up, sign-in, and session restore should feel immediate once Supabase returns state
**Constraints**: Local game progress, history, and preferences must survive auth changes; only multiplayer owner and room-management flows are gated; `preferred_display_name` is non-unique; native and web must share the same auth/account model; no email-verification gate in v1
**Scale/Scope**: One app-shell update, one auth route group, one account surface in preferences, one RLS-protected account table, and focused tests

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Cross-platform behavior is defined for native and web, including recovery/deep-link handling for the reset-password path.
- Supabase auth session state is the canonical source of truth; `public.accounts` is the durable account identity record, and the client bootstrap path writes only the signed-in user’s own row.
- Data-model changes stay scoped to `public.accounts`, with explicit grants, RLS policies, and a validation check for display-name shape; no history backfill is needed.
- The work is split into independently testable stories: sign-up/onboarding, return sign-in/session restore/sign-out, owner-action gating, and password recovery.
- The test plan covers unit tests for the auth hook and screens, database tests for grants/RLS/account bootstrap, and end-to-end coverage for the primary web journey.
- Applicable repository and domain skills were identified and loaded before design work began.

## Project Structure

### Documentation (this feature)

```text
specs/011-host-authentication/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── host-auth-flow.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── _layout.tsx
├── index.tsx
├── userPreferences.tsx
└── auth/
    ├── index.tsx
    ├── onboarding.tsx
    └── reset-password.tsx

components/
├── auth/
│   ├── AuthForm.tsx
│   ├── PasswordResetForm.tsx
│   └── UsernameOnboardingForm.tsx
└── preferences/
    └── AccountSection.tsx

hooks/
└── useAccountAuth.ts

utils/
└── supabaseClient.ts

supabase/
├── migrations/
└── tests/database/

__tests__/
├── components/
│   ├── auth/
│   └── preferences/
└── hooks/

e2e/
├── features/
└── steps/
```

**Structure Decision**: Keep the implementation inside the existing Expo app, add a dedicated auth route group for sign-in, sign-up, onboarding, and recovery flows, surface account management from preferences, and use the existing Supabase client wrapper plus Supabase migrations/tests for the data layer. No separate backend or external API contract is needed beyond the app/Supabase boundary.

## Complexity Tracking

No complexity exceptions or Constitution Check violations need justification for this feature.
