# Research and Architecture Decisions

Date: 2026-09-30. These are implementation decisions for this feature, not claims that the refactor is installed. Local code/migrations were inspected; online references are primary sources. No hosted schema, device, or runtime compatibility was verified here.

## R1 — Feature-oriented modules and explicit boundaries

**Decision:** Co-locate changed account, friendship, and cloud-history code under `features/`. Keep Expo routes in `app/`, shared transport/cache under `lib/`, and platform behavior under existing `platform/` abstractions. Use small public feature entry points and ESLint restrictions against cross-feature private imports.

**Rationale:** The existing structure separates hooks, utilities, types, and components globally, making one feature's changes span unrelated directories. Co-location keeps ownership clear; the public boundary limits coupling. Migrate touched domains only.

**Alternatives:** Whole-repository Clean Architecture layers, dependency-injection containers, generic repositories, microservices. Rejected because they add indirection without an additional backend or independent deployment need. Plain repository functions reuse the current pattern; they are not an ORM or class hierarchy.

**Sources:** [Feature folders](https://redux.js.org/style-guide/#structure-files-as-feature-folders-with-single-file-logic), [Repository pattern](https://martinfowler.com/eaaCatalog/repository.html). Borrow module organization without adding Redux.

## R2 — TanStack Query for server data; Zustand for local state

**Decision:** Add TanStack Query v5 for new social reads/mutations and existing cloud-history reads. Preserve Zustand for local games, history, and preferences. Keep private cache in memory. Existing live-game polling, event reconciliation, sequence fences, and optimistic command handling remain unchanged.

**Rationale:** `hooks/useHistory.ts` currently implements account-owned fetch state, request-version counters, mounted guards, and refresh orchestration. Query replaces that repeated lifecycle work and gives Friends the same behavior. Moving gameplay into it would be a separate protocol refactor with much larger correctness risk.

**Contract:** Account-scoped keys; queries enabled only for resolved authenticated identity; auth-generation fencing; cancel and remove old private queries on identity change; prevent stale mutation callbacks updating the new identity. Propagate AbortSignal through every repository request/page. Repositories throw Supabase errors rather than return empty lists on failure. No previous-account placeholder data, offline mutation queue, persisted private cache, or automatic social mutation retry. Invalidate relevant own-account lists/search/history after confirmed changes and refetch after uncertain outcomes. Refetch Friends on each open, navigation return, app foreground return while Friends is active, or manual refresh, even within the cache stale time. No social subscriptions, polling, or request indicators elsewhere. Connectivity recovery may retry a failed requested read; it does not promise live social updates. No cross-client cache invalidation claim.

**Initial policies:** Social lists stale after 30 seconds; cloud history after 60 seconds; prefix search (minimum 3 characters, maximum 20 results) uses input-bearing keys and short-lived cache. At most two read retries for classified transient failures; zero for auth/validation/conflict. Mutations `retry: false`. These are tunable starting values, not performance claims.

**Friends refresh implementation:** Use one feature-owned refresh path for screen entry/return, foreground return while focused, and manual refresh. Explicitly refetch the current account's visible social queries without a stale-only filter; coalesce overlapping focus/mount signals. Disable competing automatic mount/focus/reconnect refetch triggers for these queries and do not configure an interval. Initial loading and confirmed mutation refresh remain supported. A 30-second stale time must never suppress the user-selected return refresh. Other features retain their own policies. This follows the lifecycle integration points in the [TanStack React Native guide](https://tanstack.com/query/latest/docs/framework/react/react-native), with an explicit product-specific refresh policy.

**Native integration:** Reuse platform visibility for Query focus. Add SDK-compatible `expo-network` behind a connectivity adapter for native online state; browser events supply web behavior. Unknown reachability is not proof of offline status. Clean up subscriptions and avoid duplicate focus-triggered fetches.

**Sources:** [React Native integration](https://tanstack.com/query/latest/docs/framework/react/react-native), [defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Expo Network](https://docs.expo.dev/versions/latest/sdk/network/).

## R3 — Transactional social commands and relational invariants

**Decision:** Keep identity/social rules in PostgreSQL. Constraints enforce username and pair uniqueness; narrow commands implement the state machine. Every relationship/block operation shares one transaction-scoped lock for the unordered pair, including when no relationship row exists. Directional blocks remain separate from the bilateral friendship.

**Rationale:** UI-only checks and preflight reads cannot protect against concurrent actions or direct requests. A row lock alone cannot serialize two first requests against an absent pair. A simple namespaced advisory lock derived from ordered account UUIDs serializes that pair; hash collisions only add harmless contention. Re-read state after taking the lock.

**Retry design:** Social mutations carry an operation UUID. A small private receipt table uniquely keyed by actor and operation ID stores operation/input and outcome in the same transaction as the mutation. Replays cannot revive canceled/declined state; reused keys with different inputs conflict. Request generations separately reject first-time stale decisions. This replaces a custom distributed command bus, not database constraints. Account deletion cleans receipts; no time-based receipt expiry is introduced in v1.

**Security:** Derive actor from verified database identity, deny direct client social-table writes, permit narrow authenticated wrappers into private privileged functions with fixed search paths and qualified names. Test grants and function execution as well as RLS. Reuse a block-aware accepted-friend predicate wherever friend-only access is granted. Do not expand room bans into this feature.

**Sources:** [Transaction Script](https://martinfowler.com/eaaCatalog/transactionScript.html), [database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html), [constraints](https://www.postgresql.org/docs/17/ddl-constraints.html).

## R4 — One username and a PostgreSQL 17-compatible comparison rule

**Decision:** Rename `accounts.preferred_display_name` to `username`; remove unused `profiles` after dependency checks. A private normalization function and write trigger preserve normalized display spelling and derive a bytewise unique `username_key`. No frontend-supplied key is trusted. Trim surrounding supported spaces, normalize to NFC, and require 3–30 Unicode letters, numbers, or underscores (user clarification, 2026-09-30). Internal spaces and other punctuation are invalid. Use ICU root-locale lowercase independently per code point, concatenate, then NFC for the key.

**Rationale:** The user chose one unique username, not a display name plus handle. Current config uses PostgreSQL 17. Earlier full Unicode default-casefold wording was an assistant-chosen default, not a user requirement; satisfying it would require a custom Unicode mapping artifact or database upgrade. The spec now documents the smaller lowercase-based rule and its limits: `Straße` and `STRASSE` are distinct. Search and writes use the same database function.

**Alternatives:** `citext` does not implement full Unicode casefold; nondeterministic ICU comparisons have different equivalence rules; a custom Unicode library adds maintenance; PostgreSQL upgrade is unrelated to this feature. Do not silently switch between algorithms.

**Clarification follow-up:** Exact Unicode L/N support cannot be assumed from PostgreSQL POSIX alnum. Generate private category-range reference data from pinned Unicode 16.0.0 UnicodeData.txt, with a reproducible generator and source checksum/license. This implements the selected character policy without a runtime framework. Lower each code point independently with ICU root lowercase before concatenation/NFC: whole-word lowercase can make Greek prefix `ΑΒΣ` fail to match `ΑΒΣΑ`. Prefer native `starts_with` for literal key matching; measure the query plan before choosing escaped LIKE. Test Nd/Nl/No numbers, supplementary-plane letters, and the Greek prefix example.

**Prerequisite:** Verify UTF8 and `pg_catalog."und-x-icu"` availability in target environments, record collation version, and run the data-model examples. If unavailable, fail the setup gate and revise the documented algorithm deliberately. ICU upgrades require canonical-key recomputation and collision audit, not only reindexing.

**Additional sources:** [Unicode Character Database](https://www.unicode.org/reports/tr44/), [Unicode 16 data](https://www.unicode.org/Public/16.0.0/ucd/UnicodeData.txt), [Unicode special casing](https://www.unicode.org/Public/16.0.0/ucd/SpecialCasing.txt), [PG17 pattern matching](https://www.postgresql.org/docs/17/functions-matching.html).

**Sources:** [PG17 string functions](https://www.postgresql.org/docs/17/functions-string.html), [PG17 collations](https://www.postgresql.org/docs/17/collation.html), [citext limits](https://www.postgresql.org/docs/17/citext.html).

## R5 — Generated contracts and one schema authority

**Decision:** Use `createClient<Database>()`, derive database row/RPC types, retain runtime parsing for JSON payloads, and add regeneration/drift/typecheck CI. Keep reviewed SQL migrations authoritative. Pin CLI and supported runtime versions in local/CI tooling; add deterministic local seeds.

**Rationale:** `types/database.types.ts` exists but is not wired into the client. Manual row contracts miss drift. Current config has `schema_paths=[]` and pg-delta disabled; introducing declarative editing now changes the schema-authoring process and its security-diff assumptions at the same time as social authorization.

**Alternatives:** Prisma/Drizzle would add a parallel schema/migration authority and do not replace Supabase access policies. Declarative Supabase schemas are a valid future option after a verified no-diff round trip preserving grants, policies, triggers, functions, and view attributes. A generated read-only schema reference is acceptable now. Do not squash applied migrations in this change.

**Sources:** [generated types](https://supabase.com/docs/guides/api/rest/generating-types), [migrations](https://supabase.com/docs/guides/deployment/database-migrations), [declarative schemas](https://supabase.com/docs/guides/local-development/declarative-database-schemas). Exact CLI commands depend on the pinned installed version; inspect `--help` before adoption.

## R6 — Knip and removal accounting

**Decision:** Add Knip as development-only tooling, configure Expo/routes/tests/scripts and genuine native dependencies, review findings, and establish a CI gate after the initial cleanup. Retire the legacy importer, unused profile storage, demonstration echo handler, redundant row contracts, and verified unused package candidates.

**Rationale:** A one-time manual cleanup will not prevent dead code returning. Knip has Expo support, but dynamic/native usage and peers still require review and build checks. No automatic bulk deletion based on its report.

**Sources:** [Knip getting started](https://knip.dev/overview/getting-started), [Expo support](https://knip.dev/reference/plugins/expo).

## R7 — Preserve Java start-game and gameplay correctness

**Decision:** Remove only the demonstration echo handler. Retain the real command dispatcher, start handler, and persistent retry services.

**Evidence:** `StartGameCommandHandler` calls `start_game_session`; the latest inspected function in `20260926155808_guest_active_roster.sql` rejects non-joinable state before a replay lookup. Java `PersistentIdempotencyService` supplies the currently used replay behavior. Replacing this with a direct call now would regress retries. The existing reserve/mutate/complete steps are separate transactions, so do not describe them as crash-proof exactly-once processing.

**Future option:** Move durable result replay and payload conflict checks into the same start-game transaction, migrate the client/error contract, then remove obsolete Java code. This is explicitly not a prerequisite for friendships.

## Framework Decision Ledger

| Candidate | Decision | Concrete payoff / reconsideration trigger |
|---|---|---|
| TanStack Query v5 | Add in implementation | Shared server-state lifecycle for Friends and cloud history; replaces manual fetch state |
| expo-network | Add SDK-compatible version | Supplies native connectivity to Query through existing platform boundary |
| Knip | Add dev-only | Detects unused exports/dependencies with reviewed framework configuration |
| Supabase CLI type generation | Wire existing capability; pin tooling | Schema/client drift fails before merge |
| Zod | Defer | Existing targeted JSON parsers + generated types suffice; reconsider repeated evolving external JSON contracts |
| XState | Defer | Friendship authority is a small SQL transition table; reconsider complex client-only multi-step workflows |
| Redux Toolkit | Do not add | Would overlap Zustand and Query |
| Prisma / Drizzle | Do not add | Would duplicate Supabase SQL migration/schema authority |
| NestJS / new backend framework | Do not add | No new orchestration or external integration requirement |
| DI container / generic repositories / event bus | Do not add | Plain functions and explicit imports cover the current reuse boundaries |

Sources for deferred candidates: [Zod basics](https://zod.dev/basics), [XState](https://stately.ai/docs/xstate). Decisions are project-specific judgments, not claims these tools are generally unsuitable.
