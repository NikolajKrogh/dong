# Implementation Plan: Assignment Mode Setting + Host-Assigned Allocation

**Branch**: `184-us55-host-assigned-allocation` | **Date**: 2026-07-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-host-assigned-mode/spec.md`,
which is itself the #184 slice of
`specs/020-canonical-assignment-generation/spec.md` (User Story 3's mode
setting, User Story 5, FR-011, FR-026–027, FR-029–030, FR-034–037, plus
FR-030a/FR-034/FR-035a/FR-037 amendments from this slice's own clarification
session).

**Scope**: the #184 row only — the room's persisted assignment mode setting
(automatic / host-assigned to start; `player_picked` exists as a value but is
inert until #185) and host-assigned manual allocation. Issues #185
(player-picked selection) and #186 (mid-game reassignment) are out of scope.
`#135`'s already-shipped artifacts (`specs/020/plan.md`, `specs/020/tasks.md`,
migration `036_canonical_assignment_generation.sql`) are read as fixed
inputs, not modified in place.

## Summary

Add a persisted `assignment_mode` to `game_sessions` (default `automatic`,
FR-026/FR-027) and a host-only, lobby-only `set_room_assignment_mode` RPC to
change it, gated client-side by a discard-draft confirmation (FR-030a).
Promote the pre-existing `set_room_assignments` RPC — already host-only,
`joinable`-only, already emitting `assignment_replaced` — from a vestigial
draft-editing seam into the real host-allocation mechanism for the new
`host_assigned` mode: no schema change needed there, because nothing else
writes to `public.assignments` before start (research.md R2). The only
non-additive change is inside `start_game_session`: a third generation branch
that, in `host_assigned` mode, keeps existing allocation rows instead of
deleting them, fills each participant's shortfall from the pool, and reports
which participants were filled in. `compute_room_assignment_plan` and
`set_room_assignment_settings` both become mode-aware so the FR-009 automatic
minimum stops leaking into a mode it doesn't apply to (FR-011). No changes to
the Java `command-api` — mode and allocation are direct-to-Supabase RPC calls
on the same path `setAssignmentSettings`/`setAssignments` already use.

## Technical Context

**Language/Version**: PL/pgSQL for the migration; TypeScript in the existing
Expo SDK 57 / React Native workspace. No Java changes this slice (research.md
R8).

**Primary Dependencies**: Supabase JS client, Expo Router, Zustand, Tamagui —
unchanged from `specs/020`.

**Storage**: PostgreSQL via Supabase. One migration:
`037_host_assigned_mode.sql`, adding the `public.assignment_mode` enum, the
`game_sessions.assignment_mode` column, and replacing
`compute_room_assignment_plan`, `set_room_assignment_settings`, and
`start_game_session` (all via `CREATE OR REPLACE`, matching arity — no
`DROP FUNCTION` needed since no signature changes). Adds
`set_room_assignment_mode` as a new RPC pair. `public.assignments` and
`set_room_assignments` are unchanged (research.md R2).

**Testing**: pgTAP (`supabase/tests/database/240_host_assigned_mode.test.sql`)
for the generation-branch invariants and the two RPC guards; Jest-Expo for the
lobby's mode selector, allocation UI, and confirm-first gate; Playwright BDD
extending `e2e/steps/configure-start-game.steps.ts`.

**Target Platform**: Expo native (iOS/Android) and web — no platform branch
needed, this is server-driven room state plus shared Tamagui UI.

**Project Type**: Monorepo feature spanning one database migration and an
Expo client. No Java service change (a first for this delivery's issues).

**Performance Goals**: unchanged from `specs/020` — start transition and
generation within the existing <300ms command budget for rooms up to 8
participants; clients observe changes within the existing ~4s snapshot poll
(spec.md SC list).

**Constraints**: `start_game_session`'s host-assigned branch must remain
inside the same all-or-nothing transaction and row lock #135 already
established (FR-021) — no new transaction boundary, no new lock.

**Scale/Scope**: 1 new migration, 1 new RPC pair, 3 modified functions (no
signature changes to any of them), 0 Java changes, 1 new enum type, 1 new
column, lobby mode selector + allocation UI + confirm dialog, 1 new pgTAP
file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Justification |
|---|---|---|
| **I. Cross-Platform First** | **PASS** | The new lobby surface (mode selector, allocation UI, confirm dialog) is shared Expo/Tamagui code with no platform branch. Playwright runs against web; native parity follows the shared component tree, same as `specs/020`. |
| **II. Server-Authoritative Shared State** | **PASS** | Host allocations remain drafts until the server settles them at start (FR-010/FR-011 unchanged principle from #135); `set_room_assignment_mode` and the host-assigned branch of `start_game_session` both run under the room's existing `owner_account_id`/`joinable` guards and `FOR UPDATE` lock. No new conflict-handling case is introduced — allocation reuses `set_room_assignments`'s existing replace-all idempotency. |
| **III. Event-Backed Game History** | **PASS** | Allocation continues to emit `assignment_replaced` via the unchanged `set_room_assignments` (migration 035). Mode changes emit no event, matching the existing precedent of `set_room_assignment_settings` — a deliberate, documented choice (research.md R7), not an oversight. Settled assignments (including host-assigned ones) remain independently queryable via the unchanged `assignments` table. |
| **IV. Supabase-First, Custom Backend by Exception** | **PASS** | Everything lands in Postgres RPCs; the Java `command-api` gains no new endpoint and loses none — it simply isn't touched (research.md R8). |
| **V. Story-First Delivery With Required Coverage** | **PASS** | Two independently testable stories (US3's mode setting, US5's allocation). pgTAP covers the new RPC and the host-assigned generation branch; Jest covers the lobby's client-side logic (per-participant shortfall display, confirm gate); Playwright BDD covers the primary host-assigned journey, required because the lobby gains a materially new interaction (allocation UI). |
| **VI. Skill-First AI Execution** | **PASS** | Codebase state was verified directly against the post-#135 migration, hooks, lobby screen, Java handler, and types rather than trusting the GitHub issue's pre-#135 notes (research.md documents three places those notes were stale). No repository skill specific to Postgres RPC design beyond what `specs/020`'s planning already established and this plan reuses. |

**Post-Phase-1 re-check**: no violations introduced. `compute_room_assignment_plan`
and `set_room_assignment_settings` change behavior but not signature; the
generation branch is additive to `start_game_session`'s existing structure.
Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/021-host-assigned-mode/
├── spec.md               # #184 slice, points back to specs/020 as canonical
├── plan.md                # This file
├── research.md            # Phase 0 — R1..R11
├── data-model.md          # Phase 1 — schema deltas, RPC surface deltas
├── quickstart.md          # Phase 1 — validation guide
├── checklists/
│   └── requirements.md
├── contracts/
│   └── room-rpcs.md       # Deltas against specs/020's contracts/room-rpcs.md
└── tasks.md                # Phase 2 — created by /speckit-tasks, not here
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 037_host_assigned_mode.sql                          # NEW
│       ├── CREATE TYPE public.assignment_mode
│       ├── ALTER game_sessions: assignment_mode column
│       ├── private/public.set_room_assignment_mode         (new)
│       ├── private.compute_room_assignment_plan             (mode-aware, replace)
│       ├── private.set_room_assignment_settings              (mode-conditional minimum, replace)
│       ├── private.build_guest_room_snapshot                 (+ assignmentMode, replace)
│       └── private/public.start_game_session                 (+ host-assigned branch, replace)
└── tests/database/
    └── 240_host_assigned_mode.test.sql                      # NEW

hooks/useRoomConfigure.ts        # + setAssignmentMode (calls setRoomAssignmentMode)
types/room.ts                    # + assignmentMode on RoomSnapshot; + filledInParticipantIds on start response
utils/supabaseClient.ts          # RoomRpcClient + setRoomAssignmentMode
app/lobby/[sessionId].tsx        # + mode selector, allocation UI, confirm-discard dialog, per-participant shortfall display
__tests__/hooks/useRoomConfigure.test.ts   # + setAssignmentMode coverage
e2e/features/ + e2e/steps/configure-start-game.steps.ts   # + host-assigned journey
```

**Structure Decision**: no new top-level structure, same three subsystems
`specs/020` already established (database migrations, the existing `command/`
package — untouched here — and the existing lobby screen/hooks). The Java
`command-api` directory is not listed above because this slice makes no
changes there (research.md R8).

## Phase 2 Notes (for `/speckit-tasks`)

Suggested ordering, driven by dependency chain:

1. **Foundational** — migration 037's enum, column, and the mode-aware
   rewrite of `compute_room_assignment_plan` and `set_room_assignment_settings`,
   since the snapshot read and the settings guard both depend on the new
   column existing.
2. **US3 (mode setting)** — `set_room_assignment_mode`, its pgTAP guard tests,
   `build_guest_room_snapshot`'s `assignmentMode` field, and the client
   `RoomSnapshot`/`setAssignmentMode` plumbing.
3. **US5 (host allocation)** — `start_game_session`'s host-assigned generation
   branch (keep, fill, `ON CONFLICT` on the Common Match,
   `filledInParticipantIds`) and its pgTAP invariant suite. `set_room_assignments`
   itself needs no code change, only tests confirming it works correctly when
   `assignment_mode = 'host_assigned'`.
4. **Client (lobby)** — mode selector, confirm-discard dialog (FR-030a),
   per-participant allocation UI, per-participant shortfall display
   (client-computed, research.md R9).
5. **E2E** — the extended Playwright journey, last.

Steps 2–3 both touch `start_game_session`'s guard/return shape; expect one
implementation task with two test groups (mode guard, allocation branch)
rather than two independent edits, matching how `specs/020`'s tasks.md
grouped its own overlapping RPC changes.

## Complexity Tracking

No constitutional violations to justify. The design is additive to #135's
shipped functions (same signatures, extended bodies) and introduces no new
service, table, or abstraction layer; it removes nothing (unlike #135, which
deleted the Java validation duplicate and the client randomiser).
