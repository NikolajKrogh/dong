# Implementation Plan: One-Time Local-to-Cloud Import

**Branch**: `127-us24-add-one-time-local-to-cloud-import-for-existing-registered-users` | **Date**: 2026-05-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [spec.md](spec.md)

## Summary

Build a one-time import pipeline for signed-in users that reads legacy AsyncStorage history, asks the user to choose one local participant to claim as their account, sends a normalized session batch to a secure Supabase RPC, and writes imported sessions into the existing cloud tables while recording account-level completion and per-session fingerprints in a private import ledger. The Settings screen exposes progress, retry, and already-imported states; the cloud path guarantees idempotency and guest-preserving session snapshots.

## Technical Context

**Language/Version**: TypeScript 5.3.3 in Expo SDK 52 / React Native 0.76.9 / React 18.3.1
**Primary Dependencies**: Expo Router 4, Zustand 5, AsyncStorage, `react-native-toast-message`, `@supabase/supabase-js`, Supabase Auth/Postgres local stack, Supabase CLI, pgTAP, `playwright-bdd`, `@playwright/test`
**Storage**: Existing AsyncStorage history snapshot plus new private Supabase import ledger tables; imported sessions land in current `public.game_sessions`, `participants`, `matches`, `assignments`, and `gameplay_events`
**Testing**: `npm run db:reset`, `npm run db:test`, Jest/RNTL unit coverage for the Settings import flow and claimant selection, Playwright BDD web E2E for the full import journey, `npm run lint`
**Applicable Skills**: `supabase`, `supabase-postgres-best-practices`, `database-testing`, `react-native-testing`
**Tooling Preference**: Use the Supabase MCP/CLI path for schema inspection and local validation; keep privileged import code in the private schema and expose only a minimal public RPC wrapper
**Target Platform**: Cross-platform Expo app on native and web backed by local Supabase/Postgres during development
**Project Type**: Cross-platform mobile/web application with a first-party Supabase database workspace
**Performance Goals**: Per-session fingerprint lookups and completed-import checks should be index-backed; the import RPC should process batches without blocking the Settings UI longer than necessary and should surface partial results quickly enough for retry UX
**Constraints**: No new custom backend; no direct client writes to protected session tables; preserve the original local history; keep guest participants session-scoped; make the import one-time per account with server-side dedupe; do not store the privileged import helper in an exposed schema
**Scale/Scope**: One new Settings entry point, one secure import RPC surface, one or two private import ledger tables, a handful of database tests, and one browser E2E flow

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS: Cross-platform behavior is defined in the spec for native and web, and the new Settings journey applies to both.
- PASS: Shared-state writes are server-authoritative through a secure Supabase RPC plus a private import ledger, with explicit idempotency and conflict handling.
- PASS: The existing event-backed gameplay history remains canonical; the import only hydrates normal session tables and preserves guest session scope.
- PASS: The work is sliced into independently testable user stories with Gherkin acceptance criteria and explicit edge cases.
- PASS: The test plan includes unit coverage for claimant selection and import status, database coverage for ledger and RPC behavior, and end-to-end coverage for the new Settings journey.
- PASS: Applicable skills were identified before planning began and directly informed the schema, security, and testing choices.

## Project Structure

### Documentation (this feature)

```text
specs/010-local-cloud-import/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── legacy-history-import-contract.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── _layout.tsx
├── userPreferences.tsx
└── style/

components/
├── preferences/
│   ├── AppearanceSettings.tsx
│   ├── LeagueSettings.tsx
│   ├── SoundNotificationSettings.tsx
│   └── ...
├── history/
└── ui/

hooks/
├── useGameProgressController.ts
└── useLegacyHistoryImport.ts   # new

store/
└── store.ts

supabase/
├── config.toml
├── migrations/
└── tests/
    └── database/

e2e/
├── features/
└── steps/

tests/
├── app/
└── components/
```

**Structure Decision**: Keep the feature inside the existing Expo app and Supabase workspace. Client work lands in the Settings screen, a claimant-selection import hook, and a small Supabase client/service module. Database work lands in private import-ledger migrations and pgTAP tests; web journey coverage uses the existing Playwright BDD setup.

## Phase 0 Output

- `research.md` resolves the private import ledger vs client-only marker decision, the secure RPC wrapper vs Edge Function tradeoff, the claimant-selection flow, the server-computed source fingerprint, and the completion gate for repeat imports.
- The research also records that the Supabase changelog currently shows no blocking function/RLS breaking changes for this slice, but any new public database object would need explicit grants because Supabase no longer auto-exposes new public tables.

## Phase 1 Output

- `data-model.md` defines the import-state tables, source fingerprint semantics, claimant mapping, and per-session status model.
- `contracts/legacy-history-import-contract.md` documents the RPC payload and result shape for the client/server boundary.
- `quickstart.md` documents the Supabase CLI workflow, claimant-selection smoke check, and validation commands for database, unit, and E2E coverage.
- The copilot agent context is refreshed after the design artifacts are written.

## Post-Design Constitution Check

- PASS: The design keeps the new journey cross-platform and explicitly scoped to Settings on native and web.
- PASS: The design keeps the server authoritative by routing writes through a secure RPC and a private ledger instead of direct client writes.
- PASS: The event-backed gameplay model remains unchanged; the import only hydrates canonical session tables.
- PASS: The verification plan covers the new UI flow, the import ledger, and the secure RPC contract at the right test layers.
- PASS: Applicable skills and the Supabase security guidance remain explicit throughout the plan.

## Complexity Tracking

No constitution violations or exceptional complexity adjustments were required.
