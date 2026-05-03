# Implementation Plan: Cloud Gameplay Core Data Model

**Branch**: `128-us21-create-the-core-supabase-schema-for-accounts-sessions-participants-matches-assignments-and-events` | **Date**: 2026-05-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [spec.md](spec.md)

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Introduce the first local Supabase workspace for DONG and implement the core relational schema that backs authenticated hosts, join-code sessions, registered and guest participants, session-scoped matches and assignments, and immutable gameplay events with guest reclaim and idempotency protections. The implementation stays database-first: SQL migrations, database-level integrity, pgTAP coverage, and a documented secure RPC write contract that future Expo client integration and the follow-up RLS/read-model/import stories can build on without reshaping the schema.

## Technical Context

**Language/Version**: TypeScript 5.3.3 Expo workspace plus SQL migrations executed via Supabase CLI against local Supabase Postgres  
**Primary Dependencies**: Supabase CLI, Supabase Auth/Postgres local stack, pgTAP database tests, `basejump-supabase_test_helpers` for authenticated DB test contexts, existing Expo SDK 52 / React Native 0.76.9 workspace  
**Storage**: New top-level `supabase/` workspace for SQL migrations and database tests; Supabase Postgres becomes the canonical multiplayer store while the existing locally persisted session snapshot remains the temporary local cache until client integration ships  
**Testing**: `supabase test db` with pgTAP coverage for schema shape, constraints, authenticated host behavior, guest reclaim, assignment integrity, idempotent event append, and completed-session guards; no new UI end-to-end coverage in this story  
**Applicable Skills**: `supabase`, `supabase-postgres-best-practices`, `database-testing`, `database-design-expert`  
**Tooling Preference**: Prefer the Supabase MCP server for inspection, SQL execution, and other supported Supabase operations when available; fall back to the CLI only when MCP does not cover the required action or when a local migration file must be created or committed  
**Target Platform**: Local Supabase/Postgres development stack supporting the existing Expo Android, iOS, and web clients later  
**Project Type**: Cross-platform Expo application with a first-party Supabase database workspace  
**Performance Goals**: Keep join-code lookups, session hydration, guest reclaim, assignment resolution, and per-session event/idempotency checks index-backed; preserve deterministic per-session event ordering for replay and later read models; keep future RLS policies anchored on indexed ownership and session columns  
**Constraints**: Must add the first `supabase/` workspace without disrupting the current Expo app; must align durable identity with Supabase Auth rather than duplicating credentials; must keep immutable event history and reject post-completion writes; must enforce cross-session integrity and duplicate prevention in the database; must keep Supabase schema changes in ordered migration files so local resets can replay or roll them back cleanly; must avoid browser or UI login flows in schema tests; must leave RLS, read models, and import/backfill work unblocked but out of scope  
**Scale/Scope**: Introduce one Supabase CLI workspace, core tables/enums/indexes/helper triggers or functions, pgTAP tests under `supabase/tests/database/`, and small supporting updates to `package.json`, `README.md`, and `.gitignore`; no current React screen, router, or Zustand integration lands in this story

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS: No new user-facing behavior ships here; native and web clients remain on current local flows until later integration, and the future shared-state authority is explicit.
- PASS: Canonical shared state is Supabase Postgres; planned writes go through validated Supabase RPC or database-command surfaces, with session-scoped idempotency and completion conflict handling defined up front.
- PASS: The data model stays event-backed, includes migration/testing and future RLS review scope, and explicitly defers import/backfill and read-model work to follow-up stories.
- PASS: Work remains sliced into the clarified user stories for hosted sessions, persisted setup, and auditable gameplay history.
- PASS: The test strategy supplies required unit-level coverage at the database layer and does not claim unnecessary UI end-to-end work for a schema-only change.
- PASS: Applicable skills were identified before planning began and directly informed the schema, performance, and DB testing decisions.
- VARIANCE: The constitution's general RLS requirement is acknowledged, but this feature intentionally defers RLS policy work to the follow-up authorization story per spec FR-014; this plan only claims schema, index, migration, and database-test delivery for the current slice.

## Test Strategy

- Use Supabase CLI migrations under `supabase/migrations/` as the source of truth for schema changes.
- Use pgTAP tests under `supabase/tests/database/` as the required unit coverage for the new database behavior.
- Bootstrap `basejump-supabase_test_helpers` inside the DB test harness so tests can create Auth users and impersonate authenticated hosts without driving a UI login flow.
- Verify active join-code uniqueness, registered-participant uniqueness, guest reclaim, cross-session assignment protection, per-session idempotency, and completed-session write rejection with explicit DB tests.
- Keep any future `@supabase/supabase-js` client smoke checks out of this story unless the schema implementation itself requires a narrow integration check.

## Project Structure

### Documentation (this feature)

```text
specs/007-core-supabase-schema/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── shared-session-write-contract.md
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
.gitignore
app/
components/
hooks/
store/
types/
utils/
```

**Structure Decision**: This remains a single Expo application, but it gains a first top-level `supabase/` workspace because Supabase CLI expects migrations, local config, and database tests to live together. The React and Expo code stays in place and is not integrated yet; this story is isolated to SQL migrations, database tests, and the documented secure write contract that later client stories will consume.

## Phase 0 Output

- `research.md` resolves the first-time Supabase workspace layout, Auth-to-account mapping, common-match representation, session and participant invariants, guest reclaim strategy, idempotent event model, and authenticated database test approach.

## Phase 1 Output

- `data-model.md` defines the physical tables and logical tokens and keys, their relationships, validation rules, and lifecycle transitions.
- `contracts/shared-session-write-contract.md` defines the secure write path and read expectations for session creation, join and rejoin, setup persistence, and history-affecting event append.
- `quickstart.md` defines the Supabase CLI setup, migration order, authenticated test workflow, and schema smoke checks.
- Copilot agent context is refreshed after the design artifacts are written.

## Post-Design Constitution Check

- PASS: No immediate cross-platform UI behavior changes are introduced, and future Android, iOS, and web integration will rely on the same authoritative model.
- PASS: The design makes Supabase Postgres the canonical source of truth and documents secure RPC or database commands, session-scoped idempotency, and completed-session conflict handling.
- PASS: The schema preserves immutable event history while leaving RLS, read models, and import/backfill scope to their follow-up stories without blocking them.
- PASS: The verification plan covers the highest-risk auth, persistence, multiplayer, and integrity behaviors with executable database tests.
- PASS: The applicable Supabase and database skills remained explicit throughout planning and design.

## Complexity Tracking

No constitution violations or exceptional complexity adjustments were required.
