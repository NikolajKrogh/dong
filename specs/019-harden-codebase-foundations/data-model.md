# Data Model: Harden Codebase Foundations

**Feature**: 019-harden-codebase-foundations | **Date**: 2026-07-19

## Persisted data

**None.** This feature makes no database, migration, RLS, or event-schema changes. The Supabase schema is untouched; the only DB-adjacent change is that the existing pgTAP suite gains a CI runner (Phase 1).

## TypeScript type relocations (compile-time only)

Behavior-preserving moves; every consumer keeps compiling via re-exports from the original module.

### Moved in Phase 6 (ESPN consolidation)

| Type | From | To | Consumers to keep green |
|---|---|---|---|
| `MatchWithScore` | `hooks/useLiveScores.ts` | `types/matchScores.ts` | `components/gameProgress/MatchQuickActionsModal.tsx`, `components/gameProgress/MatchesGrid/types.ts`, `MatchesGridContainer.tsx`, `hooks/useGameProgressController.ts` |
| `GoalScorer` | `hooks/useLiveScores.ts` | `types/matchScores.ts` | same as above |
| `MatchStatistics` | `hooks/useLiveScores.ts` | `types/matchScores.ts` | same as above |

`types/espn.ts` (`ESPNResponse`, `ESPNEvent`, `ESPNCompetition`, `ESPNCompetitionDetail`, `ESPNStatistic`, `ESPNCompetitor`) is **extended, not moved**: the consolidated parser in `utils/espnParsing.ts` becomes typed against it, replacing the current `event: any` signatures. Fields the parsers read that the types lack are added during Phase 6 (verify at implementation time; exploration found the types largely complete but bypassed).

### New type home created in Phase 7 (decomposition)

`components/gameProgress/MatchQuickActionsModal/types.ts` — props/state types extracted from the 1,424-line component, following the sibling `MatchesGrid/types.ts` pattern.

### Validation rules

- No type may change shape during a move (pure relocation; TypeScript structural equality).
- Re-exports remain in the original modules at least until all in-repo imports are migrated (Phase 6/7 PRs migrate them in the same PR since none are in-flight files).

## State transitions

None introduced. Existing state machines (`useLegacyHistoryImport` phases, gameProgress UI reducer, toast queue reducer) are relocated (Phase 7) and gain tests (Phase 10) but their transition logic is unchanged — the characterization tests assert this.
