# Implementation Plan: Per-Player Match Counts

**Branch**: `191-per-player-match-counts` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Status**: Planning complete; ready for `/speckit-tasks`. Runtime/release checks are implementation gates, not completed validations.

**Validation override (2026-10-30)**: User requested unit tests instead of E2E and no Android-device testing for now. Client/domain/component and database unit tests plus static/non-UI runtime checks remain required. Android/ARTEMIS, visual, E2E and real-backend browser journeys below are deferred follow-up coverage, not prerequisites or passed gates for this run. This explicit instruction supersedes earlier exploration/E2E task ordering.

**Input**: `specs/031-per-player-match-counts/spec.md`

## Summary

Add a game default plus optional per-player additional-match targets to local games and multiplayer. Counts remain exact; unequal automatic games optimize a sharing preference. The user selected hosted HiGHS with a portable offline fallback and authorized refactoring the existing generators. Keep equal-count exact-sharing/explicit-relaxation rules and existing settled games compatible. Normalize all kickoff displays to 24-hour HH:mm through the existing formatter.

A Supabase Edge function prepares automatic assignment previews with HiGHS. Postgres stores trusted, expiring proposals and remains the only authority that validates and commits shared configuration and assignments. Start/save consumes the reviewed proposal, so optimization never runs while a room lock is held and a preview never silently rerandomizes. Local games and hosted optimizer failure use a small portable exact-count fallback; no solver is bundled into Android.

The RoomAssignments module owns preview ordering, expiry, consent and replay across the lobby/editor. Its interface exposes preview and commit; transport phases and version selection are internal. All-zero v2 games are Common-Match-only even when a positive sharing preference is stored.

## Technical Context

**Language/Version**: TypeScript ~5.9, React 19.2, React Native 0.86, Expo 57; Postgres/PLpgSQL; Deno Supabase Edge runtime.

**Primary Dependencies**: Existing Zustand 5/AsyncStorage, Supabase client ~2.114, Tamagui ~2.7, Zod 4, TanStack Query 5. Add `highs` 1.15.4 only to the new Edge function's pinned imports and WASM assets after compatibility validation; retain its MIT notice. No YALPS, native solver, extra server, or new client dependency.

**Storage**: Existing `dong-storage`, game sessions, participants, assignments and gameplay events; nullable participant target override, explicit assignment-policy version, and a private expiring proposal table.

**Testing**: Jest/jest-expo; pgTAP; Playwright BDD; ARTEMIS exploration before authoring executable UI tests; local Supabase Edge runtime smoke/performance checks.

**Target Platform**: Android and web, offline local games, registered members and session-scoped guests. Hosted optimization is host-only; all viewers receive accepted canonical state through existing refresh paths.

**Project Type**: Existing mobile/web application with database-owned commands and one bounded optimizer Edge orchestrator.

**Performance Goals**: Start with a 1.5-second whole-generation computation deadline including construction/validation/assessment, at most 0.75 seconds in HiGHS, 20,000 binary-variable / 30,000-constraint / 8 MiB model-input guards, and a linear-work fallback. Full pair assessment stops after 50 ms or 50,000 membership comparisons; partial summaries are explicitly labeled. Validate total cold/warm request CPU below the documented 2-second Edge allowance and memory below 256 MB; lower budgets if needed. Basic v2 input is limited to 8 MiB and generated additional assignments to 10,000; resource-capacity errors are distinct from count infeasibility. Preview admission permits one live 10-second reservation and at most one new reservation per 2 seconds per actor/room/purpose, with at most two sequential client retries. Never solve on room polling. No optimality promise after timeout.

**Constraints**: Exact individual counts; Common Match separate; selected-pool-only assignments; server validation under lock; replay/conflict protection; immutable prior gameplay; legacy compatibility; no global roster cap introduced just to accommodate a solver. Count feasibility remains distinct from solver availability.

**Scale/Scope**: Local setup and persistence, three multiplayer lobby modes, running automatic/host-assigned editing, snapshots/history, and kickoff formatting. New/edited v2 count and sharing inputs use 0..100. Preserve 100-new-match and 10,000-assignment running payload limits. Existing legacy values remain readable; no destructive normalization.

## Constitution Check

| Principle | Research-exit check | Post-design check |
| --- | --- | --- |
| I. Cross-platform first | PASS: web/Android and offline scope defined | PASS: shared controls and portable local fallback; hosted WASM stays outside Expo |
| II. Canonical shared state | PASS: retain database ownership | PASS: trusted proposal, host JWT commit, lock/token/replay validation; no client assignment authority |
| III. Event-backed history | PASS: preserve scores/drinks and assignment history | PASS: existing replacement event extended with targets; snapshots preserve participation; no backfill of invented targets |
| IV. Supabase first | PASS: no duplicate CRUD service | PASS: Edge optimizes; Postgres validates/persists; existing Java start remains legacy compatibility |
| V. Required coverage | PASS: per-story unit/DB/journey scope identified | PASS: quickstart maps tests, negative boundaries and platform journeys; implementation release gates explicit |
| VI. Skill first | PASS: planning/domain skills consulted | PASS: see research R8, primary solver/runtime documentation and source research |

No constitutional exception is required. The user resolved the algorithm direction by selecting Option B on 2026-10-30. The former unbounded exact-sharing promise has been replaced in FR-008 with bounded optimization and explicitly labeled best effort.

## Project Structure

### Documentation (this feature)

```text
specs/031-per-player-match-counts/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/assignment-optimization.md
  contracts/assignment-module.md
  contracts/room-commands.md
  contracts/ui-and-time.md
  quickstart.md
```

`tasks.md` is produced later by `/speckit-tasks`, not this workflow.

### Source Code (repository root)

```text
shared/assignments/                         # New pure targets, fallback, validation, overlap calculations
features/game-setup/                        # Existing controls, local generator adapter and setup
features/rooms/                            # Existing RPCs, lobby/member/guest caps, running draft/editor
features/rooms/roomAssignments.ts           # New deep module owning preview/commit lifecycle
features/history/                          # Actual per-player participation and history mapping
features/football-matches/matchTime.ts       # Existing shared kickoff formatter
store/gameStore.ts                          # Local targets, policy, persistence/history/reset
supabase/functions/room-assignment-preview/ # New authenticated bounded HiGHS orchestration
supabase/functions/_shared/assignments/      # HiGHS model/runtime adapter, server-only WASM loading
supabase/config.toml                        # Function configuration and static WASM asset packaging
supabase/migrations/                        # New additive migration, current body safeguards retained
types/room.ts, types/guestRoom.ts            # Runtime requests and projections
types/database.types.ts                     # Regenerated, never hand-maintained DB definitions
__tests__/shared/assignments/                # New invariant and fallback coverage
__tests__/features/                         # Extend setup, room, history and formatter tests
supabase/tests/database/                    # Target/proposal/RPC/history pgTAP coverage
e2e/features/, e2e/steps/                    # Extend primary journeys and scalar-only fixtures
```

**Structure Decision**: One portable generation module, one server-only solver adapter, and a RoomAssignments module at the owned-remote seam. Existing hooks inject current context and a transport adapter; screen callers learn preview/commit rather than the protocol. Reuse `AssignmentCounter`, `MatchSelectionCard`, `SelectableMatchList` and wizard/editor ownership. No generic workflow framework or backend CRUD layer.

## Phase 0 — Research Outcomes

[research.md](research.md) records owning-source evidence, current scalar assumptions, limits, alternatives, Exa links, and actual desktop solver trials. HiGHS solved the 3/3/1 and 2/2/1 examples optimally, an 8-player synthetic case in about a second, and returned a valid 10-player incumbent at a 1.5-second limit. These results support bounded optimization; they do not establish hosted runtime compatibility.

Final decisions:

1. Nullable participant override plus sparse local map; null follows default, zero is Common Match only.
2. Explicit policy version preserves existing unmodified games and safely gates v2 writers.
3. HiGHS server-only, polynomial incidence model with guards, constructive candidates and independent result validation.
4. Expiring actor/configuration-bound proposals prevent preview/start divergence and stale commits.
5. Existing permission/event/catalog protections remain around refactored assignment generation.
6. Stable h23 HH:mm kickoff formatting, including raw clock normalization; unrelated history completion timestamps remain outside scope.
7. Design-review corrections: immutable preview-bound relaxation consent; reserved request identity and compare-and-set publication; bounded fallback/assessment; Common-Match-only zero exception; one owning preview/commit module with interface-level tests.

## Phase 1 — Data, Interfaces, and User Flows

See [data-model.md](data-model.md) and [contracts](contracts/room-commands.md).

### Counts and compatibility

New rooms/local games created by the upgraded client use policy 2. Legacy rows/storage hydrate as policy 1 with no overrides and unchanged assignments. A host can adopt v2 with an explicit atomic configuration save; no migration silently adopts or rerandomizes a game. Existing unmodified v1 start behavior remains available.

In v2 every resolved count is exact. Positive equal automatic targets retain exact pair sharing and explicit pool-shortfall relaxation; a positive count below the pair minimum is reported for correction rather than silently raised. All-zero v2 targets use `common_only`: no additional matches, sharing minimum or consent, including offline local games with stored sharing1. Keep that preference unchanged for later positive counts. Setting a default or restoring an override below existing picks/allocations fails before any target is written. Roster growth can make positive strict equal settings invalid; surface the requirement without changing counts.

Legacy calls cannot replace v2 automatic assignments: return `assignment_policy_upgrade_required` or preserve/validate the existing v2 semantics where the command is safe (for example own picks). New fields are additive for readers, but old binaries are not safe v2 configuration writers. A server capability field gates editing on upgraded clients during rollout.

### Automatic sharing

For unequal targets, minimize total absolute pair-overlap deviation from the preference with hard quotas and distinct pool membership. Keep a valid fallback candidate from the beginning, including the tested 3/3/1 preference-2 arrangement. A better validated incumbent may replace it. Match identifiers are randomized once after optimizing anonymous slots; a saved preview holds the actual identifiers and is reused at commit.

Cheap exact/disjoint/core constructions avoid optimization when already optimal or the model exceeds limits. A cyclic count-only baseline takes linear input/output work; remove greedy per-slot pair scoring from the fallback. Bound full objective comparison and summarize individual pair overlap on demand if aggregate assessment runs out of budget. Runtime failures cannot turn sufficient distinct counts into `insufficient_match_pool`; basic request/output capacity has its own error. Result quality distinguishes optimal, best effort and fallback. Positive equal compatibility generation and common-only require no HiGHS.

### Multiplayer preview and commit

The RoomAssignments module asks for a preview only when needed. The Edge function verifies the JWT and obtains canonical inputs through host-scoped prepare, which reserves the private request identity under a short room lock before solving. Identical input is reused/pending; different input while a lease is active is busy, with bounded sequential retries owned by the module. Computation runs outside the transaction. Service-only publication compares the reserved current identity/lease and rechecks actor/token, so a late A result cannot replace B. Commit serializes with admission on the same room lock and preserves catalog cutoff/capacity, assignment/history and replay safeguards.

Preview derivation distinguishes exact, preference, relaxed and common-only. If positive equal targets fit individually but strict sharing does not, return a fixed relaxed preview with an explicit consent requirement. Start/save accepts only confirmation of that proposal; confirmation cannot change the sharing policy or regenerate assignments. Bind policy and consent requirement to proposal identity, and accepted consent to command fingerprint/history.

Picks or roster changes after preview invalidate its token. The preview is visibly stale, not silently regenerated during Start. Replaying an already-accepted commit returns its original result before token/expiry checks. Preview failure leaves the room untouched; local draft changes remain available.

The existing hooks bind current room/draft context to `features/rooms/roomAssignments.ts`. Screens call preview/commit and present explicit consent; the module hides request revisions, token/hash mapping, expiry, busy retries, lost-response replay and v1/v2 transport selection. See [module interface](contracts/assignment-module.md). Tests use that same interface with production/in-memory transport adapters. Replace obsolete scalar-formula and transport-choreography tests after equivalent module-level coverage exists; retain meaningful UI/database regressions.

Manual host allocations and player picks use target-aware SQL caps/filling without calling HiGHS. The existing running editor still accepts automatic or host-assigned, not a new mid-game player-picking workflow. Draft new matches are resolved by existing client-ID mapping inside the atomic save and assignments are revalidated after mapping.

### UI and histories

The default counter is labeled as a default. Each existing player row gets an individual counter, resolved total, and a reset-to-default action, editable only by the organizer/host. The player's accessible label names the player. Existing lists/cards are reused; errors, busy state and focus stay in context.

Guest/member progress and start-time shortfall filling use each participant's target. Hydration carries defaults/overrides without leaking the entire room pool into the active gameplay pool. History displays actual per-player assignment counts; never use a rollup average to assert equality. Extend immutable departure and replacement snapshots, preserving past scores/drinks and frozen provider metadata.

### Time formatting

Update the shared formatter, not every screen. Normalize valid H:mm/HH:mm/HH:mm:ss to HH:mm, validate ranges, keep absent/unknown handling, and render real instants with the existing viewer timezone plus an explicit 00–23 clock cycle. Test midnight, noon, leading zeroes, date rollover, locale preferences, and fallback inputs. No new kickoff UI is required on surfaces that currently show none.

## Implementation Slices and Dependencies

These define task-generation order, not implementation completed in this command.

| Slice | Scope and concrete owners | Required evidence |
| --- | --- | --- |
| Runtime prerequisite | Server-only HiGHS import/static WASM packaging in local Edge runtime | Whole-operation CPU/memory including bounded fallback/assessment, model guards and timeout decoding; no native client import; stop architecture integration if incompatible |
| US1 targets | `gameStore.ts`, target resolution, participant column/policy, atomic settings, existing counters/rows | Unit persistence/identity/default/reset; pgTAP host authority/conflicts/legacy compatibility; local and room BDD |
| US2 automatic | Generation module, HiGHS adapter, reserved private proposals, Edge preview, RoomAssignments, start/preview wiring | Counts/sharing invariants, 3/3/1 K2, zero with stored positive sharing, bounded fallback/quality, relaxed-preview consent, overlapping/resumed request ordering, malicious/stale proposals and lost-response retries |
| US3 allocation/picks | Own member/guest pick commands, host allocations, progress/fill, snapshot projections | Per-player caps, zero/partial picks, default-reduction rejection, identity isolation, host/member/guest journey |
| US4 running/history | Running save/token/event, draft preview, history/departure mapping | Atomic edits with new matches, old scores/drinks unchanged, replay/conflicts/retention, reconnect/history journey |
| US5 time | `matchTime.ts` and existing tests/list consumers | Fixed-zone boundary and input-shape tests; actual match lists under en-US/12-hour preference on web/Android |
| Release | Additive migration, generated types, capability activation, recovery guidance | Database reset/tests, full client checks, affected Edge checks and relevant BDD/device journeys |

## Validation and Release Gates

[quickstart.md](quickstart.md) contains commands, setup and expected outcomes. Before writing executable UI tests, inspect the actual app with ARTEMIS and follow device selection/diagnosis rules. Mocked BDD journeys cover client orchestration, not proof of real PostgreSQL authorization; pgTAP and an isolated local integration journey cover that boundary.

Required before merge: unit and relevant component suites; pgTAP including current 230/240/250/290/313/314 behaviors; Playwright primary journeys; TypeScript, lint, Edge typecheck and generated-type checks. Run React Doctor after React changes. Add explicit validation of proposal authorization, stale snapshots, forged quality flags, expiry, host handover, event preservation, and provider catalog checks.

Server-first additive release: deploy schema/projection/commands, deploy and verify Edge WASM packaging, then release the capability-gated UI. No production deployment is part of planning. Recovery retains target/proposal-aware readers and commits for adopted games, stops new v2 adoption if needed, and never discards saved overrides or rewrites historical assignments.

## Complexity Tracking

No constitutional violations or additional paid infrastructure. User-approved complexity is confined to HiGHS orchestration, a private preview record needed to commit exactly what was reviewed, and an explicit version boundary needed to preserve old games. Avoid exhaustive subset enumeration, extra solver packages, a second event system, persistent account preferences, new Java CRUD, and unrelated timestamp/UI changes.
