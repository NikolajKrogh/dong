# Implementation Plan: Shared History and Player Comparisons

**Branch**: `feat/shared-history-comparisons` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

## Summary

History → Stats presents personal completed-online totals, automatically loaded friend summaries, and inline expanded overall/shared comparison tables. Personal totals remain visible independently of friend failures. Games/Players preserve recorded details and local history; the existing direct comparison route remains compatible. Separate-game records stay private. Reuse completed-participant projections, social authorization, account-scoped TanStack queries and existing UI; no new dependency or Java endpoint. An account-only get_personal_history_stats RPC supports correct totals without requiring any friendship.

## Technical Context

**Language/Version**: TypeScript ~5.9.3, React 19.2.3, React Native 0.86.3, Expo ~57.0.19; PostgreSQL.
**Primary Dependencies**: Existing Expo Router, Tamagui, Supabase JS ^2.114.0, TanStack Query 5.104.0, Zustand. Versions reflect package.json, not independently verified installations.
**Storage**: Existing Supabase results/relationships; in-memory private queries. Preserve local Zustand/AsyncStorage history independently.
**Testing**: Jest unit/component and hook/repository tests; pgTAP. User-approved exception (2026-10-09): do not author or run any E2E tests for this feature on web, Android or iOS. Unit/component, hook/repository and pgTAP tests remain required. This explicitly departs from Constitution V; do not claim full E2E compliance. No mandatory manual journey or mobile harness replaces the removed E2E gate.
**Target Platform**: Web and native (Android/iOS); shared behavior remains in scope.
**Project Type**: Existing cross-platform monorepo.
**Performance Goals**: SC-005: at least 19/20 opens per platform within two seconds with 100 shared games. Complete aggregates independent of detail pagination.
**Constraints**: Actor from auth.uid(); accepted friendship/no bilateral block per read; hide cached social data until fresh checks succeed. Completed online games only, excluding legacy imports, ongoing/local games. Preserved departures counted once.
**Scale/Scope**: One destination, three contextual entry points, bounded pages and indexed on-demand aggregates. No materialized cache or new infrastructure without query-plan evidence.

## Constitution Check

| Principle | Before research | After design |
|---|---|---|
| Cross-platform | Pass: web/native defined | Pass: shared route, responsive accessible UI, visibility adapter |
| Authoritative state | Pass: read-only server results | Pass: database auth/aggregation; no optimistic permission |
| Auditable history | Pass: existing immutable results | Pass: preserve snapshots/departures; no name backfill |
| Supabase-first | Pass: no Java need | Pass: narrow private implementations/public invoker RPCs |
| Required coverage | Explicit user exception: no E2E | Unit/DB/security/performance checks retained; E2E compliance waived by user |
| Skill-first | Pass: plan/Supabase/UI taste | Pass: repository and primary-source research |

Design gates retain the explicit user-approved E2E exception; runtime verification remains pending. Repository reviewed-migration workflow overrides skill suggestions for untracked hosted schema edits.

## Project Structure

### Documentation

`specs/028-shared-history-comparisons/{spec,plan,research,data-model,quickstart}.md`, `contracts/social-history.md`, `checklists/requirements.md`. tasks.md is generated separately.

### Source Code

- Existing: app/history.tsx; components/history/PlayerStatsList.tsx, GameDetailsModal.tsx, PlayerComparisonModal.tsx; features/history/historyRepository.ts, useHistory.ts, index.ts; features/friends/PeopleList.tsx, useFriends.ts, index.ts; lib/queryClient.ts; platform/visibility/.
- Planned: app/history-comparison/[accountId].tsx; features/history/socialHistoryRepository.ts, useSocialHistory.ts, SharedHistoryScreen.tsx.
- Persistence/contracts: supabase/migrations/ new generated migration; supabase/tests/database/ new social-history tests; generated types/database.types.ts.
- Tests: __tests__/features/history/, __tests__/components/history/ and __tests__/app/history.platform.test.tsx.

**Structure Decision**: History owns the screen/read contract. Public feature indexes expose cross-feature entry points/actions; no internal Friends/History imports across domains. Preserve existing local/personal comparison semantics. Reuse Shell components and game details.

## Phase 0 — Research

Complete in [research.md](research.md). Canonical results, legacy exclusions, secure aggregate reads, query lifecycle and pagination resolved. Online provenance is resolved from persistent room codes plus import events/match markers in research.md. The approved dashboard refinement adds a standalone actor-only totals RPC using that same projection, independently of friend reads. Runtime preflight and migration rollout succeeded on 2026-10-10; see quickstart.md for evidence.

## Phase 1 — Design

See [data-model.md](data-model.md) and [contracts/social-history.md](contracts/social-history.md). Private definer implementations with explicit authorization, empty search_path and qualified names; public invoker wrappers. Restrict default PUBLIC/anon EXECUTE, explicitly grant required authenticated wrapper/private-call privileges. Private schema remains unexposed. No underlying history RLS widening.

Account-scoped keys: ['account', viewerId, 'social-history', targetId, ...]. Each open/refresh/return/foreground increments a display generation, hides old payload, and makes a fresh authorized read. Consume AbortSignal and fence results by account plus display generation. Failure or page authorization failure hides social data; no stale/offline fallback. Confirmed local block/unfriend invalidates and hides affected social queries. No continuous polling.

## Phase 2 — Delivery sequence

1. Database contracts, grants, legacy/online fixtures, pgTAP and generated types.
2. Typed repository and permission-gated lifecycle with cancellation/late-response tests.
3. US1 Players discovery, route, contextual shortcuts, shared-game details and Back.
4. US2 overall/shared statistics, complete aggregates and labelled departure timeline.
5. US3 revocation/offline/account-switch behavior, unit/DB/accessibility/performance gates.

Generate tasks with /speckit-tasks. No implementation or migration generated during planning.

## Rollout and recovery

Additive migration; test clean install and upgrade. Reuse indexes, adding only measured missing access paths. Review linked history and db push --dry-run before hosted deployment; schema before client. Roll back client UX or revoke new RPC execution on failure; repair with a forward migration. Never reset hosted data or erase results. Diagnostics record durations/error categories without private payloads. No new monitoring service.

## Complexity Tracking

User-approved exception (2026-10-09): do not author or run any E2E tests for this feature on web, Android or iOS. Unit/component, hook/repository and pgTAP tests remain required. This explicitly departs from Constitution V; do not claim full E2E compliance. No mandatory manual journey or mobile harness replaces the removed E2E gate. Narrow privileged aggregate reads are necessary because friends may see totals without accessing underlying separate games.
