# Implementation Plan: Canonical Player Assignments on Game Start

**Branch**: `135-us54-generate-and-persist-canonical-player-assignments-on-game-start` | **Date**: 2026-07-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/020-canonical-assignment-generation/spec.md`

**Scope**: the **#135 row** of the spec's Delivery Slices table only — automatic
generation, the shortfall warning and host override, the room's two assignment
settings, and retry safety. Issues #184 (assignment mode + host-assigned), #185
(player-picked), and #186 (mid-game reassignment) are specified in the same
document but are **not** planned or implemented here.

## Summary

Move multiplayer assignment authorship from the host's device to the server. The
`start_game_session` Postgres RPC — already holding a `FOR UPDATE` lock on the
room row — gains generation: it computes each participant's matches from the
room's pool, writes them, and transitions the room to `in_progress` in one
transaction, so no observer can ever see a started room without its assignments.

Generation honours two new room settings: how many matches each participant gets
beyond the Common Match, and how many matches any two participants hold in common.
The second is the pool-cost dial — at its default of zero the pool requirement is
linear (`1 + P×N`), and raising it to one reproduces the solo game's pairing at a
quadratic cost. When the pool cannot satisfy the configured rules, the lobby says
so from a read-only feasibility computation carried in the room snapshot, and the
host may start anyway by sending an explicit `relaxConstraints` flag on the single
mutating call — which means the room is never touched while they decide.

The Java `StartGameCommandHandler` sheds its duplicate validation and becomes pure
dispatch, auth, idempotency, and error mapping. The client's local randomiser is
deleted.

## Technical Context

**Language/Version**: Java 17 for `command-api`; TypeScript in an Expo SDK 57 /
React Native workspace; PL/pgSQL for the generation algorithm.

**Primary Dependencies**: Spring Boot 3.3 (web, security, validation), Supabase
JS client, Expo Router, Zustand, Tamagui.

**Storage**: PostgreSQL via Supabase, with migrations under `supabase/migrations/`
and RLS/`SECURITY DEFINER` RPC boundaries.

**Testing**: pgTAP (the generator's unit-test level — see research.md R8), JUnit 5
+ MockMvc (command service), Jest-Expo (hooks/components), Playwright BDD (E2E).

**Target Platform**: JVM web service + Expo native (iOS/Android) and web.

**Project Type**: Monorepo feature spanning database migrations, a Java command
service, and an Expo client.

**Performance Goals**: generation and the start transition complete within the
existing <300ms command budget for rooms up to 8 participants; clients observe the
transition within the existing ~4s snapshot poll (SC-012).

**Constraints**: stateless command service; no Realtime subscription; generation
must be atomic with the state transition; the feasibility computation must be a
pure read so it can ride the snapshot poll.

**Scale/Scope**: 1 new migration, 1 new RPC + 1 internal helper, 3 modified RPCs,
4 new error codes, 1 simplified Java handler, lobby settings + requirement display,
1 deleted client randomiser.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Justification |
|---|---|---|
| **I. Cross-Platform First** | **PASS** | Generation is server-side and platform-neutral. The new lobby surface — two numeric settings and the pool-requirement display — is shared Expo code with no platform branch. The Playwright journey runs against web; native parity follows from the shared component tree. |
| **II. Server-Authoritative Shared State** | **PASS** | This is the principle the feature exists to serve: assignment authorship moves off the client entirely (FR-001, FR-050). Every new mutation defines its conflict behaviour — `start_game_session` generates under the row lock it already holds; `set_room_assignment_settings` is naturally idempotent; retry safety is inherited from `command_idempotency` (FR-025). A latent gap in that guarantee is fixed here: `join_room_as_registered` did not lock the room row, so a join could race the roster enumeration (research.md R6). |
| **III. Event-Backed Game History** | **PASS** | Settlement emits `assignment_replaced` carrying the full set, and `session_started` carries the relaxation flag (FR-016, FR-023). Both event types already exist, so no CHECK-constraint migration. Assignments remain independently queryable, as `specs/018` FR-011 established. |
| **IV. Supabase-First, Custom Backend by Exception** | **PASS** | Generation moves *into* Postgres rather than into Java, and the Java handler *loses* logic — its duplicate five-rule validation is deleted, leaving dispatch, auth, idempotency, and error mapping. No new endpoint, no duplicate CRUD. |
| **V. Story-First Delivery With Required Coverage** | **PASS** | The slice is four independently testable stories (US1, US2, US4, US8). pgTAP is the generator's unit-test level and covers invariants, boundaries, atomicity, and the join race; MockMvc covers the handler; Jest covers the client; a Playwright BDD journey covers the primary flow, required because the lobby gains controls and the start flow changes materially. |
| **VI. Skill-First AI Execution** | **PASS** | Loaded `supabase-postgres-best-practices` (locking and `SECURITY DEFINER` boundaries — this surfaced R6), `database-design-expert` (backfill-free column defaults, R4), `database-testing` (isolation testing for the join race, R8), and `java-springboot` (confirmed the existing `command/` package-by-feature layout needs no change). Recorded in research.md. |

**Post-Phase-1 re-check**: no violations introduced. The design removes a
component (Java-side validation) rather than adding one, and adds no new service,
table, or persistence layer. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/020-canonical-assignment-generation/
├── spec.md              # Shared spec for #135/#184/#185/#186
├── plan.md              # This file
├── research.md          # Phase 0 — R1..R9
├── data-model.md        # Phase 1 — schema, derived quantities, transitions
├── quickstart.md        # Phase 1 — validation guide
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── room-rpcs.md     # Supabase RPC contracts
│   └── start-game-api.md# Java command contract
└── tasks.md             # Phase 2 — created by /speckit-tasks, not here
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 036_canonical_assignment_generation.sql   # NEW
│       ├── ALTER game_sessions: matches_per_player, shared_matches_per_pair
│       ├── private/public.set_room_assignment_settings          (new)
│       ├── private.compute_room_assignment_plan                 (new helper)
│       ├── private.build_guest_room_snapshot                    (+ assignmentPlan)
│       ├── private/public.start_game_session                    (+ generation, + relax flag)
│       └── private.join_room_as_registered                      (+ FOR UPDATE)
└── tests/database/
    └── 230_canonical_assignment_generation.test.sql             # NEW

command-api/src/main/java/com/dong/commandapi/
├── command/StartGameCommandHandler.java     # drop validate(); pass relaxConstraints; extend mapSupabaseError
└── error/ErrorCode.java                     # + 4 codes; retire UNASSIGNED_PARTICIPANTS

command-api/src/test/java/com/dong/commandapi/
└── command/StartGameCommandHandlerTest.java # rewrite around the new contract

hooks/useRoomConfigure.ts                    # delete randomizeAssignments; add setAssignmentSettings; startGame(relax)
types/room.ts                                # + AssignmentPlan on RoomSnapshot
app/lobby/[sessionId].tsx                    # remove randomise control; add settings + requirement display + shortfall choice
__tests__/hooks/useRoomConfigure.test.ts     # update
e2e/features/ + e2e/steps/configure-start-game.steps.ts  # extend journey
```

**Structure Decision**: no new top-level structure. The feature lands in the three
existing subsystems along their established seams — one sequential migration, the
existing `command/` package, and the existing lobby screen and room hooks. The
solo flow (`utils/setupGameAssignments.ts`, `app/setupGame.tsx`) is untouched per
FR-052.

## Phase 2 Notes (for `/speckit-tasks`)

Suggested ordering, driven by the dependency chain rather than by story priority:

1. **Foundational** — migration 036's schema change and
   `compute_room_assignment_plan`, since every other piece reads the plan.
2. **US1** — generation inside `start_game_session`, the `assignment_replaced`
   payload, and the pgTAP invariant suite.
3. **US2** — the two rejection paths, the `relax_constraints` parameter, and the
   relaxed generation branch.
4. **US4** — `set_room_assignment_settings` and its guards.
5. **R6** — the `join_room_as_registered` lock fix plus its race test. Independent
   of the stories; can land first if convenient, and arguably should, since it is
   a correctness fix to shipped code.
6. **Java** — handler simplification and error codes, once the RPC contract is real.
7. **Client** — snapshot type, settings UI, requirement display, shortfall choice,
   deletion of the randomiser.
8. **E2E** — the extended journey, last.

Steps 2–4 all modify `start_game_session`; expect them to be one implementation
task with three test groups rather than three independent edits.

## Complexity Tracking

No constitutional violations to justify. The design is net-simplifying: it deletes
the Java-side validation duplicate and the client-side randomiser, and adds no new
service, table, or abstraction layer.
