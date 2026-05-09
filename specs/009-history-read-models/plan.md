# Implementation Plan: History, Comparison, and Leaderboard Read Models

**Branch**: `126-us23-create-read-models-for-history-comparisons-and-leaderboards` | **Date**: 2026-05-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [spec.md](spec.md)

## Summary

Deliver a read-model layer in Supabase Postgres for completed session history, lifetime player stats, head-to-head comparisons, and ranked leaderboards so the client can stop recomputing those aggregates locally. The design uses `security_invoker` views for the unparameterized read surfaces and stable SQL RPC functions for comparison queries, with pgTAP tests and query benchmarks proving that the contracts are deterministic, guest-scoped where required, and index-backed.

## Technical Context

**Language/Version**: TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace, plus SQL migrations and pgTAP tests executed against local Supabase Postgres  
**Primary Dependencies**: Supabase CLI, Supabase Auth/Postgres local stack, pgTAP database tests, existing Expo Router 4 workspace, Supabase `rpc()` support for SQL functions  
**Storage**: Existing `supabase/` workspace with new read-model views/functions and supporting tests; no new business tables are introduced in this feature  
**Testing**: pgTAP schema, result-shape, and performance validation for completed-session summaries, overview totals, lifetime stats, comparisons, and leaderboards; no new end-to-end UI coverage in this slice  
**Applicable Skills**: `supabase`, `supabase-postgres-best-practices`, `database-design-expert`, `database-testing`  
**Target Platform**: Local Supabase/Postgres backing the existing cross-platform Expo app on native and web  
**Project Type**: Cross-platform Expo application with a first-party Supabase database workspace  
**Performance Goals**: Keep read-model queries deterministic and index-backed; avoid client-side aggregation for the affected history, player, comparison, and leaderboard views; validate query plans on representative completed-session fixtures  
**Constraints**: Expose read models with explicit grants; use `security_invoker` for views so underlying RLS remains authoritative; keep guest participants session-scoped; avoid materialized views unless benchmarking shows a clear need; do not introduce a custom backend just for these aggregates  
**Scale/Scope**: One Supabase workspace, four read surfaces in the data layer (history overview, lifetime stats, comparisons, leaderboard), a small set of SQL migrations, pgTAP coverage, and documentation for the client contract

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS: Cross-platform behavior is unchanged in the UI layer; the feature defines one shared data contract for native and web clients.
- PASS: Supabase Postgres remains the canonical source of truth for the new read models, and the write path is not expanded by this story.
- PASS: The design is read-model oriented, with no new mutable history tables; migration and backfill impact is limited to derived queries and supporting indexes.
- PASS: The work is sliced into independently deliverable user stories with Gherkin acceptance criteria and explicit edge cases.
- PASS: The test plan includes unit-equivalent database coverage for every new read-model contract and query-performance validation for the sensitive paths.
- PASS: Applicable repository and domain skills were identified before planning began and directly informed the security and performance choices.

## Project Structure

### Documentation (this feature)

```text
specs/009-history-read-models/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── read-model-contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
supabase/
├── config.toml
├── migrations/
└── tests/
    └── database/
app/
├── history.tsx
└── style/
components/
├── history/
├── ui/
└── AppIcon.tsx
store/
README.md
package.json
```

**Structure Decision**: This feature stays database-first inside the existing Expo monorepo. Implementation work lands in `supabase/migrations/`, `supabase/tests/database/`, and the documentation under `specs/009-history-read-models/`; the current Expo screens remain unchanged until a later client-integration story consumes the new read models.

## Phase 0 Output

- `research.md` resolves the choice of `security_invoker` views for the unparameterized surfaces, SQL RPC functions for comparison queries, and the initial no-materialized-view approach.
- The read-model contract is scoped against the current history screen shapes so the derived data can replace the client’s local history, stats, and comparison aggregation.

## Phase 1 Output

- `data-model.md` defines the derived read-model entities, their fields, and how they map to completed sessions, participants, and leaderboard rows.
- `contracts/read-model-contracts.md` documents the public view/function names, response shapes, and guest-vs-registered comparison rules.
- `quickstart.md` documents the Supabase CLI workflow, database-test execution, and benchmark validation steps.
- The copilot agent context is refreshed after the design artifacts are written.

## Post-Design Constitution Check

- PASS: No UI divergence is introduced; the same contract can be consumed by native and web clients later.
- PASS: The read models remain database-derived and do not redefine the server-authoritative mutation model.
- PASS: There is no new mutable history store; the feature only adds read surfaces and supporting validation.
- PASS: The test plan covers shape, access, and performance behavior in the database layer where these contracts live.
- PASS: All applicable skills remained explicit throughout planning and design.

## Complexity Tracking

No constitution violations or exceptional complexity adjustments are required for this feature.
