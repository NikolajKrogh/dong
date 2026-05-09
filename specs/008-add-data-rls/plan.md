# Implementation Plan: Protected Multiplayer Data Access

**Branch**: `125-us22-add-row-level-security-for-profiles-friendships-settings-and-room-data` | **Date**: 2026-05-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [spec.md](spec.md)

## Summary

Add row-level security and explicit data grants for the multiplayer schema while introducing the minimal account-linked `profiles`, `settings`, and `friendships` tables required by issue #125. The implementation is database-first: Supabase migrations add the new tables, RLS policies, grants, and supporting indexes; pgTAP tests verify allowed and denied access for profile, friendship, and room data; no Expo UI changes ship in this slice.

## Technical Context

**Language/Version**: TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace, plus SQL migrations executed through Supabase CLI against local Supabase Postgres  
**Primary Dependencies**: Supabase CLI, Supabase Auth/Postgres local stack, pgTAP database tests, existing Expo Router 4 workspace, existing Supabase `public.accounts` anchor from US2.1  
**Storage**: New `supabase/` workspace in the repo, with additional `public` schema tables for profiles, settings, and friendships, and RLS enabled on those tables plus the existing room tables  
**Testing**: pgTAP database coverage for permitted/denied reads and writes across profiles, settings, friendships, and room data; no new UI end-to-end coverage  
**Applicable Skills**: supabase, supabase-postgres-best-practices, database-testing, database-design-expert  
**Target Platform**: Local Supabase/Postgres used by the existing cross-platform Expo app, with behavior shared by native and web clients  
**Project Type**: Cross-platform Expo application with a first-party Supabase database workspace  
**Performance Goals**: Keep policy predicates index-backed; use simple `auth.uid()` checks and `exists` lookups on indexed account/session columns; avoid broad cross-table scans in policy paths  
**Constraints**: Every public table touched by the feature must have explicit grants and RLS; profile reads expand only to accepted friendship participants; settings remain owner-only; room data remains host/participant scoped and privileged writes stay behind approved database commands or service-role paths  
**Scale/Scope**: One Supabase workspace, three new account-linked tables, RLS on those tables and the existing room tables, supporting indexes, and a focused pgTAP validation set

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS: The feature defines consistent native and web behavior by keeping the change in the shared database layer; no UI divergence is introduced.
- PASS: The canonical source of truth for shared room state remains Supabase Postgres, and privileged room mutations stay behind approved database-command or service-role paths.
- PASS: The data model introduces additional account-linked tables and explicitly scopes RLS and migration work for profiles, friendships, settings, and room data.
- PASS: The work is sliced into independently testable user stories with Gherkin-style acceptance criteria and explicit edge cases.
- PASS: The test strategy uses pgTAP to cover allowed and rejected access patterns at the database layer, which is the highest-leverage level for this feature.
- PASS: Applicable repository and domain skills were identified before the plan was written: Supabase, Postgres best practices, database testing, and database design.

## Project Structure

### Documentation (this feature)

```text
specs/008-add-data-rls/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── data-access-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
supabase/
├── config.toml
├── migrations/
└── tests/
    └── database/
package.json
README.md
app/
components/
hooks/
store/
types/
utils/
```

**Structure Decision**: This feature stays database-first inside the existing Expo monorepo. All implementation work lands in `supabase/migrations/`, `supabase/tests/database/`, and the supporting docs under `specs/008-add-data-rls/`; the Expo app itself remains unchanged in this slice.

## Complexity Tracking

No constitution violations or exceptional complexity adjustments are required for this feature.
