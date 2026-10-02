# Implementation Plan: Friendships and Maintainable Foundations

**Branch**: `188-friendships-unique-usernames` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Issue #145 plus user-authorized identity cleanup, legacy removal, reusable patterns, and development-workflow improvements. Implemented locally on 2026-10-01 with the user-authorized unit-only validation exception recorded in verification.md.

## Summary

Deliver unique usernames and safe friendships while consolidating account identity, retiring the pre-release history importer, connecting generated database contracts, and adopting shared server-state management. Use feature-oriented modules with plain repository functions, transactional database commands, normalized relational data, and one migration authority. Add TanStack Query for Friends and cloud history, an Expo connectivity adapter for native reconnect behavior, and Knip for ongoing dead-code analysis. Keep Zustand for local state and preserve the current gameplay synchronization and Java start-game path.

## Confirmed Product Decisions

Home remains unchanged. Friends is reached through existing Settings → Profile & username → Friends. Friends navigation uses Friends and Requests tabs. Blocked accounts is a secondary destination in the header overflow menu, per mockup review; individual Block actions remain in person-row menus.

Visual implementation reference: [approved Canva refinement](https://www.canva.com/M/MAHW38MbDOA), excluding its illustration at the user's request. Friends uses a compact search field, pale selected tabs, blue/mint/cream person rows with contrasting avatars, inline actions, and pull-to-refresh. Search updates after a short typing pause; pending requests retain their cancellation action in the overflow menu. The earlier [workflow v4](mockups/05-profile-friends-workflow-v4.png) and [interaction notes](mockups/README.md) remain navigation references. Home is unchanged; Friends stays under Settings/Profile and blocking remains secondary.

- One unique username: 3–30 Unicode letters/numbers/underscores, enforced by persistence.
- Literal prefix discovery: minimum 3 characters, maximum 20 results, filtering before limiting.
- Decline permits an immediate fresh request; replaying an old operation never creates one.
- Include Cancel request and Unfriend; expected-state checks prevent stale cancellation becoming an unfriend.
- Refresh Friends on opening, returning, or manual refresh; no social live subscriptions or elsewhere indicators.

## Technical Context

**Language/Version**: TypeScript ~5.9, React 19.2, Expo SDK 57 / React Native 0.86; PostgreSQL 17 configured; Java 17 / Spring Boot 3.5.3 retained.

**Primary Dependencies**: Existing Supabase JS ~2.114, Zustand 5, Tamagui 2.7. Planned additions: TanStack Query v5, SDK-compatible `expo-network`, Knip as development tooling; pin supported versions/lockfile during implementation. No new ORM, state-machine framework, dependency-injection container, or generic repository framework.

**Storage**: Supabase Auth/Postgres for identity and social state; existing AsyncStorage/Zustand for local gameplay/history/preferences. Query cache is in memory only and scoped to authenticated identity.

**Testing**: Jest/RNTL, pgTAP, independent-connection database concurrency checks, Playwright BDD, ARTEMIS-backed native exploration/validation, TypeScript, ESLint, generated-type drift checks, Knip. Maven tests for removal of the Java demonstration handler.

**Target Platform**: Web and native parity; physical Android evidence required for native claims.

**Project Type**: Existing client + Supabase + external-integration Java service; no new deployed service.

**Performance Goals**: Spec SC-006; deduplicated cloud reads without cross-account data reuse. Friends refetches on each open/return/manual refresh regardless of cache freshness; no social live subscriptions, background polling, or request indicators elsewhere.

**Constraints**: All current DB data is pre-production test data; preserve real supported local gameplay/history behavior. Review-only until implementation is requested. Schema/API changes may require a coordinated test-client cutover; do not carry obsolete compatibility aliases indefinitely.

**Scale/Scope**: Existing low-traffic application. Refactor account, friends, and cloud-history boundaries; do not relocate the entire repository or replace working game synchronization merely for consistency.

## Constitution Check

| Principle | Pre-research gate | Post-design gate |
|---|---|---|
| I. Cross-platform | Pass: both clients included | Pass: shared feature logic, platform focus/connectivity adapters, web/native acceptance |
| II. Authoritative shared state | Pass: SQL owns identity/social rules | Pass: constraints, narrow RPCs, pair serialization, durable retry contract; Query is only a cache |
| III. Event-backed history | Pass: gameplay events/snapshots retained | Pass: importer retirement does not replace gameplay history with mutable profile data |
| IV. Supabase-first | Pass: no new backend layer | Pass: social commands in Postgres; Java start-game retained because current retries depend on it |
| V. Required coverage | Pass: six stories have acceptance scenarios | Pass: test gates include races, auth transitions, migrations, contracts, UI journeys |
| VI. Skill-first | Pass | Pass: speckit-plan, refactor, code-reviewer, database-design-expert, Supabase/Postgres skills; research agents used as directed by planning skill |

The existing tasks template calls tests optional, contrary to principle V. Correct that template and dependent copies as part of implementation; this plan always requires coverage. No constitution amendment is needed for this correction.

## Project Structure

### Documentation (this feature)

```text
specs/027-friendships-unique-usernames/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/social-api.md
  quickstart.md
  checklists/requirements.md
```

`tasks.md` is generated by the next task-generation phase, not fabricated as an implementation-complete checklist here.

### Target source boundaries

```text
app/                         # Expo routes; composition/navigation only for migrated flows
features/
  account/                   # account repository, identity/domain helpers, supported exports
  friends/                   # repository, query keys/hooks, transition presentation, UI
  history/                   # cloud repository/query hooks and local/cloud composition
lib/
  supabase.ts                # createClient<Database>, configuration/auth transport only
  queryClient.ts             # query defaults and authenticated-cache lifecycle
platform/
  visibility/                # reuse existing lifecycle abstraction
  connectivity/              # web/native network bridge, native expo-network adapter
types/database.types.ts      # generated, never manually repaired
supabase/
  migrations/                # authoritative versioned SQL; keep applied history
  seed.sql                   # reproducible non-secret local fixtures
  tests/database/            # SQL constraints, privileges, transitions, retained regressions
scripts/                     # type generation/drift and independent-session concurrency runner
.github/workflows/           # cross-layer CI rather than isolated schema/client checks
```

Paths are target design, not a claim these modules exist yet. Migrate current `utils/accountRepository.ts`, `utils/historyRepository.ts`, and relevant hooks with their callers. Leave unrelated modules in their existing locations. Extract only transport/configuration from `utils/supabaseClient.ts`; keep domain RPC clients in their owning modules. Update references and remove superseded entrypoints in the same slice rather than leaving permanent re-export shims.

Dependency direction: route → feature UI/query hook → feature repository → typed transport. Database commands own permission and relationship rules. Shared infrastructure never imports features. Cross-feature use is through a small public API, enforced using existing ESLint import restrictions. Pure transformations can be reused by importing functions; do not create base repositories or a service locator.

## Delivery Slices and Order

All slices belong to this feature/PR scope but should remain separately reviewable commits. Estimates are rough engineering effort, not delivery promises; allow 25% contingency for generated-type and database setup issues.

| Slice | Concrete work | Completion gate | Estimate |
|---|---|---|---|
| A. Contracts/workflow foundation | Pin CLI and supported Node range, wire typed Supabase client, derive row types, type generation/drift checks, client typecheck on DB changes, align test templates | Clean database reconstructs; types reproducible; stale contract makes CI fail | 1–2 days |
| B. Identity (US1) | Rename account field to username, server normalization + unique key, pinned generated Unicode L/N ranges and per-code-point lowercase, 3–30 Unicode letters/numbers/underscores, profile retirement, callers including room/history projections, onboarding/profile UI | Uniqueness/direct-write/race tests; UUID ownership and historical snapshots preserved | 1–2 days |
| C. Social authority (US2–4) | Normalize pair relationship + directional blocks, secure reads/commands, generation checks, shared locks, retry receipts | Auth/role matrix and independent-connection races pass | 2–3 days |
| D. Reusable client/data state (US5) | Feature boundaries, Query provider/auth scope, visibility/connectivity adapter; migrate cloud-history reads; keep local composition | A→B/expiry/late mutation/cancellation and offline-history regressions pass | 1–2 days |
| E. Social UI (US2–4) | Profile Friends entry with unchanged Home; v4 card layout; Friends/Requests tabs; header overflow for Blocked accounts; username prefix search (minimum 3 characters, maximum 20 results); send, accept, decline, cancel, unfriend, block, and unblock through shared data layer | Persisted two-user web + native journey from Settings/Profile; unchanged Home; accessible menus/error/pending states; cancel/accept races and unfriend permission revocation | 1–2 days |
| F. Retirement/maintenance (US5–6) | Remove importer and ledger consumers, unused dependency candidates and echo handler, narrow stale lint exceptions, Knip configuration and architecture guide | Removal ledger reconciles files/dependencies; retained journeys/builds pass | 1–2 days |
| G. Release rehearsal | Prior-schema upgrade and empty reset, seeds, full relevant CI, test-client cutover/recovery guide, source/doc consistency | Spec SC-001–010 demonstrated; no unexplained drift or cross-account data | 1 day |

A precedes B/C/D. B+C+D precede E. Import retirement in F is coordinated with D's history rewrite and SQL dependency cleanup; package-only cleanup can be reviewed independently. G follows all slices. Split tasks into bounded changes when generating tasks; do not run a single unreviewable whole-repository rewrite.

## Database and Deployment Workflow

Use reviewed incremental SQL migrations as the only schema authority now. Current configuration is PostgreSQL 17 with no declarative schema paths and no enabled pg-delta engine. Do not introduce a second manually maintained schema tree or switch diff engines as a side effect of this refactor.

For each change: create timestamped migration using the pinned CLI; apply locally; run clean-install and prior-schema upgrade tests; check grants/RLS/function execution; regenerate `types/database.types.ts`; compile client; run focused tests; inspect linked history and a deployment dry-run before eventual deployment. Deploy Edge Functions separately when their code changes. Fixtures are local-only by default and never bundled into normal remote deployment.

A generated current-schema reference may aid review, but is read-only output of migrations. A future declarative conversion requires a no-diff round trip that preserves policies, grants, functions, triggers, and view security attributes. A one-time prelaunch baseline squash is explicitly deferred: it provides no runtime benefit and would add linked-history coordination to the friendship work. Do not delete applied migration files or run migration fetch over the working checkout.

Implementation rehearsal may reset a disposable local DB. Any hosted reset must identify the exact project and recreation plan; the user describing data as test data does not mean every environment may be erased automatically. This planning turn does not mutate databases.

## Deletion and Retention Ledger

| Candidate | Planned decision and required accounting |
|---|---|
| `profiles` table + name/avatar/bio access | Remove after catalog/repository dependency inventory; account UUID/username is canonical. Remove policies/grants/tests that solely exercise the deleted feature, replacing needed authorization tests. |
| `LegacyHistoryImportSection`, claimant modal, `useLegacyHistoryImport`, legacy utilities/types, history-import route | Retire end to end; remove preferences entry, styles and exclusive test fixtures. Keep local game/history functionality. |
| Import SQL/ledger/`get_history_import_links` | Remove active objects in a new migration after deleting current history-loader dependencies and adjusting deletion/read-model paths. Keep original migration files replayable. |
| Handwritten database row/RPC contract copies | Replace with generated types; retain domain/view-model transformations and runtime JSON validation. |
| `EchoCommandHandler` + exclusive tests | Remove demonstration handler; retain tests for actual dispatch/auth/idempotency behavior. |
| `image-size`, `js-base64`, `expo-symbols`, `expo-web-browser`, unused date-picker dependencies | Candidates only until Knip, config/native/peer-dependency checks, and builds confirm removal. Retain any still needed through runtime configuration or peers. |
| Old branch-specific lint exception | Recheck `eslint.config.js` exception for branch 153; fix underlying JSX then remove exception if no longer needed. Do not switch off broader React lint rules to achieve green. |
| Java start-game dispatcher/idempotency | Retain: SQL currently rejects replay after room state changes; deleting Java would regress retries. |
| Guest access, sequence fences, gameplay events, platform adapters | Retain and test. These implement actual security/correctness behavior, not disposable compatibility. |

Record the actual removed files, dependency counts, replacement paths, and test evidence during implementation. Never present static absence of imports as proof that a native package is safe to remove.

## Risks and Verification Gates

- Unicode: generate exact L/N ranges from pinned Unicode 16.0.0 data; test supplementary letters and all Number categories. Per-code-point lowercase avoids Greek prefix context errors. Server-defined NFC/root-locale lowercase differs from full casefold; document examples and test actual ICU availability/version before schema deployment. No fallback to environment-dependent comparison.
- Authorization: generated TypeScript and Query cache isolation are not security boundaries; database roles, grants and every RPC remain tested with hostile calls.
- Concurrency: sequential pgTAP alone cannot establish race correctness; use independent connections and transaction barriers.
- Cache: auth transitions and mutation callbacks need identity-generation fencing even after query cancellation; do not persist private cache or queue offline social mutations.
- Contracts: typing the shared client can expose pre-existing loose JSON/RPC assumptions. Fix parsers/contracts, not by casting the client back to `any`.
- Migration: preserve all account-ID references and history projections; blocked friend access and existing room access are distinct permissions.
- Tooling: CLI runtime version was not verified in this sandbox (cache/telemetry permissions); inspect/pin it during setup. No feature depends on an unverified new CLI subcommand.

## Complexity Tracking

No constitution violations. Added complexity has concrete replacement targets: Query replaces manual cloud-fetch lifecycle logic; expo-network supplies native connectivity; Knip replaces repeated manual unused-code hunting. Small social retry receipts support durable replay, not a general command bus. No generic framework is added for hypothetical future features.

## Warning-free acceptance update — 2026-10-01

FR-026 / SC-011 includes existing lint/compiler/unused-code warnings in cleanup. Enforce `eslint . --max-warnings 0`, native `knip` without a baseline, clean type checks and unit execution. Preserve useful runtime error logging and document narrow tool/framework false positives. T061 is complete; non-unit verification tasks remain deferred under the user's explicit execution exception. See verification.md for exact results and limits.


## Tooling scope correction — 2026-10-02

At the user's request, removed the added upgrade runner, dependent generic concurrency-barrier runner, their package commands and CI steps, and the unused development-only pg dependency. Existing db:start/db:reset/db:test and generated-type checks remain. No additional database test runner is required. Restored .gitignore byte-for-byte to HEAD; this change contains no .gitignore edits. Earlier references to a recreated/ignored scratch workspace are historical and superseded. Upgrade/race execution remains unverified.
