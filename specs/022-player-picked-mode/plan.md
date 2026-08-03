# Implementation Plan: Player-Picked Assignment Mode

**Branch**: `185-us56-player-picked-matches` | **Date**: 2026-07-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-player-picked-mode/spec.md`,
which is the #185 slice of
`specs/020-canonical-assignment-generation/spec.md` (User Story 6, FR-038–042,
plus FR-038a/FR-040a/FR-041a added by this issue's own tracking).

**Scope**: the #185 row only — player-picked selection. Mid-game reassignment
(#186) is out of scope. #135's and #184's shipped artifacts
(`specs/020/*`, `specs/021/*`, migrations `036_...`, `037_...`) are read as
fixed inputs, never modified in place.

**Branch note**: cut from `184-us55-host-assigned-allocation`, not from
`multiplayer`. #184's PR #188 merged, but the branch carries two follow-up fix
commits (`be9c830`, `28557ad`) not yet in a merged PR. Rebase onto the
integration branch once those land, before opening this issue's PR.

## Summary

Add `public.assignment_picks` — the first **new table** in the
#135/#184/#185/#186 line — to hold each participant's own pre-start picks,
separate from `public.assignments` (settled) and from #184's host allocations,
which reuse the settled table. Expose it through two RPC pairs split by identity
kind, `set_my_room_picks` (`auth.uid()`) and `set_my_room_picks_as_guest`
(room-scoped token hash), mirroring the existing
`leave_room_as_member`/`leave_room_as_guest` precedent. Both are **replace-all**:
that makes FR-040's cap race-free without a read-modify-write, makes release
(FR-040) the same call with one fewer id, and makes idempotency inherent.
Neither takes a `participant_id`, so FR-039's "cannot change another
participant's picks" is structural rather than merely checked — which matters,
because this is the first time a session-scoped guest writes room state beyond
their own presence.

Settlement gains a fourth branch in `start_game_session`: full delete (not
host-assigned's selective one), seed `public.assignments` from picks filtered to
the locked roster / the live pool / not-the-Common-Match, then the **same**
count-and-fill loop host-assigned already runs. One additive `'picks'` key on
`build_guest_room_snapshot` serves host, member, and guest progress from the
polls they already run, because both snapshot RPCs delegate to that one builder.
No Java change; no new gameplay event; `compute_room_assignment_plan` and
`set_room_assignment_settings` need no further work — #184 already made them
mode-aware.

On the client, the pick UI is built by **reusing the app's existing
match-selection infrastructure** rather than adding a third visual idiom: the
presentational core of `components/setupGame/AssignmentSection.tsx` (team-logo
match cards, grid ⇄ list toggle, collapsible `n/total` count card) is extracted
into shared components that the solo flow keeps using unchanged and the new pick
panel consumes, with progress rendered as one more badge on the existing
`ParticipantList` (research.md R15). The guest **pick UI is in scope** (resolved
with the requester; research.md R10) and is the largest client task, because
guests today have no lobby screen at all — only a read-only summary card.

## Technical Context

**Language/Version**: PL/pgSQL for the migration; TypeScript in the existing
Expo SDK 57 / React Native workspace. No Java changes (research.md R13).

**Primary Dependencies**: Supabase JS client, Expo Router, Zustand, Tamagui —
unchanged from `specs/020`/`021`. The reused match-selection components bring
`expo-linear-gradient`, `@expo/vector-icons`, and `utils/teamLogos` into the
multiplayer lobby for the first time; all three are already app dependencies
used by the solo flow.

**Storage**: PostgreSQL via Supabase. One migration,
`038_player_picked_mode.sql`: the `public.assignment_picks` table with its
grants, RLS policy, and three indexes; two new RPC pairs; and
`CREATE OR REPLACE` of `build_guest_room_snapshot` (+`picks`) and
`start_game_session` (+`player_picked` branch). Both replacements keep their
signatures, so existing `REVOKE`/`GRANT` carry over and no `DROP FUNCTION` is
needed.

**Testing**: pgTAP (`supabase/tests/database/250_player_picked_mode.test.sql`)
for the authorisation boundary as **both** a guest and a registered non-host
member, the cap/release/pool rules, the settlement branch, and the new RLS
policy; Jest-Expo for the extracted match-selection components (preserving
`AssignmentSection`'s existing responsive assertions), the pick panel, and both
hooks; Playwright BDD extending both `configure-start-game.feature` and
`guest-room-join.feature`.

**Target Platform**: Expo native (iOS/Android) and web. The extracted
match-selection components already carry the solo flow's responsive
wide-layout handling, so the pick panel inherits native/web parity rather than
re-deriving it.

**Project Type**: Monorepo feature spanning one database migration and the Expo
client. No Java service change (second slice running, matching #184).

**Performance Goals**: unchanged from `specs/020` — start transition within the
existing <300ms command budget for rooms up to 8 participants; participants
observe each other's picks within the existing poll (~4s lobby, ~1s guest).

**Constraints**:
- The pick RPCs must take `FOR UPDATE` on the room row for mutual exclusion with
  `start_game_session`, which takes the same lock — otherwise a pick can land
  between settlement's roster lock and its seed read and be silently lost
  (research.md R2).
- `start_game_session`'s new branch stays inside the existing all-or-nothing
  transaction and row lock (FR-021) — no new transaction boundary, no new lock.
- A new table means the constitution's "migrations, indexes, and RLS updates"
  clause binds for the first time in this delivery line (#184 added no table).
- The `AssignmentSection` extraction is **presentation-only**: FR-052 keeps the
  solo flow's behaviour exactly as it is, and the existing
  `AssignmentPlayersGrid` / `AssignmentPlayerCard` testIDs must survive verbatim.

**Scale/Scope**: 1 migration, 1 new table (+3 indexes, 1 RLS policy, grants),
2 new RPC pairs, 2 replaced functions (signatures unchanged), 0 Java changes,
0 new event types, 0 changes to existing RPCs. Client: 2 components extracted
from existing code + 1 new panel, 1 existing component extended, 2 hooks
extended, 2 type files extended, 2 surfaces wired, 1 new pgTAP file, 2 e2e
features extended.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Justification |
|---|---|---|
| **I. Cross-Platform First** | **PASS** | The pick control is shared code with no platform branch, and it reuses the solo flow's match-selection components, which already encode both native and web behaviour including responsive wide-layout handling — so parity is inherited rather than re-derived (research.md R15). Playwright covers web on both surfaces. |
| **II. Server-Authoritative Shared State** | **PASS** | Picks are drafts; the server settles at start (FR-041), continuing #135's shift of authorship off the client. Each new mutation defines its idempotency and conflict rule explicitly (replace-all, last-write-wins per participant — contracts §1), and takes the same room lock as settlement so the two cannot interleave. Critically, the *authorisation* is server-side and structural: no RPC accepts a participant id, so a client cannot write another participant's row even by lying. |
| **III. Event-Backed Game History** | **PASS, with the argument recorded** | No per-pick event, and the reasoning is written out rather than assumed (research.md R9): picks are draft churn (8 participants toggling would write hundreds of rows describing superseded intentions), and settlement already emits `assignment_replaced` with the full settled map plus `session_started` with `filledInParticipantIds`, so FR-023's reconstructibility holds. The apparent asymmetry with host allocation is incidental — that emits an event only because it reuses `set_room_assignments`; the sibling lobby-config mutations (`set_room_assignment_settings`, `set_room_assignment_mode`) emit nothing, and picks follow that precedent. Migration/retention considered: pick rows persist as `joinable`-era residue, cascade on match removal, and never affect a started game. |
| **IV. Supabase-First, Custom Backend by Exception** | **PASS** | Everything lands in Postgres RPCs. The Java `command-api` gains nothing and loses nothing — untouched (research.md R13). No duplicate CRUD layer: the new table is written only by its two RPCs and read only through the existing snapshot builder. |
| **V. Story-First Delivery With Required Coverage** | **PASS** | One user story (US6), independently deliverable and independently testable. pgTAP covers the authorisation boundary as both identity kinds (the issue's own emphasis), the cap/release/pool rules, the settlement branch, and the new RLS policy; Jest covers the extracted components and hook logic; Playwright BDD covers the primary journey on both surfaces — required, since the lobby gains a materially new interaction and the guest surface gains its first actions. |
| **VI. Skill-First AI Execution** | **PASS** | No repository skill covers Postgres RPC design beyond what `specs/020`/`021` planning established and this plan reuses; that is stated rather than implied. Codebase state was verified directly against the post-#184 migrations, RLS files, hooks, both client surfaces, the setupGame components, and the e2e helpers — which caught **three stale claims** in the issue body (research.md R5, R9, R12) and **one in this feature's own spec** (R6), each corrected in place rather than inherited. |

**Post-Phase-1 re-check**: no violations introduced. The new table ships with
its indexes and RLS policy in the same migration (constitution's
persistent-schema clause). Both replaced functions keep their signatures; the two
new RPC pairs follow the established `private`/`public` + `REVOKE`/`GRANT`
convention. No existing RPC is modified. The one change to already-shipped
client code (`AssignmentSection`) is a presentation-only extraction guarded by
its existing tests, taken specifically to *avoid* the duplication a from-scratch
panel would have introduced. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/022-player-picked-mode/
├── spec.md                # #185 slice, points back to specs/020 as canonical
├── plan.md                # This file
├── research.md            # Phase 0 — R1..R15
├── data-model.md          # Phase 1 — new table, RLS, lifecycle, client types
├── quickstart.md          # Phase 1 — validation guide
├── checklists/
│   └── requirements.md
├── contracts/
│   └── room-rpcs.md       # Deltas against specs/020 + specs/021 contracts
└── tasks.md               # Phase 2 — created by /speckit-tasks, not here
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 038_player_picked_mode.sql                          # NEW
│       ├── CREATE TABLE public.assignment_picks (+FKs ON DELETE CASCADE, 3 indexes)
│       ├── grants + ENABLE RLS + assignment_picks_room_members_select policy
│       ├── private/public.set_my_room_picks                (new)
│       ├── private/public.set_my_room_picks_as_guest       (new)
│       ├── private.build_guest_room_snapshot               (+ picks, replace)
│       └── private.start_game_session                      (+ player_picked branch, replace)
└── tests/database/
    └── 250_player_picked_mode.test.sql                     # NEW

types/room.ts                    # + RoomPickSummary, RoomSnapshot.picks, 3 ROOM_ERROR codes
types/guestRoom.ts               # + picks, and the overdue assignmentMode/assignmentPlan (R11)
utils/supabaseClient.ts          # RoomRpcClient + setMyRoomPicks; GuestRoomRpcClient + setMyRoomPicksAsGuest
hooks/useRoomConfigure.ts        # + setMyPicks (registered/host path)
hooks/useGuestRoomSession.ts     # + setMyPicks (guest path)

components/matchSelection/                  # NEW — extracted from setupGame (R15)
├── SelectableMatchList.tsx                 #   grid ⇄ list toggle + both card renderers
└── MatchSelectionCard.tsx                  #   collapsible header + n/total badge shell
components/setupGame/AssignmentSection.tsx  # REFACTORED to consume the above — behaviour unchanged (FR-052)
components/lobby/PlayerPickPanel.tsx        # NEW — thin: my-picks card + cap logic, built on the above
components/lobby/ParticipantList.tsx        # + optional per-participant progress badge (FR-042)
components/guestJoin/GuestJoinLobby.tsx     # + pool, pick panel, progress (its first actions)
app/lobby/[sessionId].tsx        # + player_picked selector option; pick panel in BOTH host and member branches

__tests__/components/matchSelection/        # NEW — extracted components
__tests__/components/setupGame/AssignmentSection.platform.test.tsx   # must keep passing unchanged
__tests__/components/lobby/, __tests__/components/guestJoin/, __tests__/hooks/   # extended
e2e/features/configure-start-game.feature   # + player-picked journey
e2e/features/guest-room-join.feature        # + guest pick journey
e2e/steps/browser-flow.helpers.ts           # + mocks for the two new RPCs, picks in mock snapshots
```

**Structure Decision**: no new top-level structure — the same subsystems
`specs/020`/`021` established (database migrations plus the Expo client). The
`command-api/` directory is absent above because this slice makes no changes
there (research.md R13).

The one new client directory, `components/matchSelection/`, exists because the
match-selection UI now has **four** consumers rather than one: the solo flow's
`AssignmentSection`, the lobby's host branch, the lobby's member branch, and the
guest surface. Extracting it there rather than importing across from
`components/setupGame/` keeps the multiplayer surfaces from depending on the
solo-flow feature folder, and is what makes `PlayerPickPanel` thin — cap logic
and the `RoomMatchSummary` → view-model mapping, not markup.

## Phase 2 Notes (for `/speckit-tasks`)

Suggested ordering, driven by the dependency chain:

1. **Foundational (migration, schema half)** — the table, FKs with
   `ON DELETE CASCADE`, indexes, grants, `ENABLE ROW LEVEL SECURITY`, and the
   select policy. **Check `010_schema.test.sql` in this same task** — it asserts
   hardcoded column lists and #184's CI caught exactly this class of break when
   `assignment_mode` landed (fix commit `be9c830`); do not discover it in CI.
2. **Foundational (migration, RPC half)** — both pick RPC pairs, then
   `build_guest_room_snapshot`'s `picks` key, then `start_game_session`'s
   `player_picked` branch. All four are edits to the **same** migration file, so
   they land together by construction — the split-file hazard #184's tasks.md
   warned about cannot arise here.
3. **pgTAP** — lead with the authorisation boundary (member and guest, plus the
   "A cannot touch B" case and the RLS grant check), then cap/release/pool
   (**including the empty-set release**, which is where the
   `array_length`/`COALESCE` trap bites — contracts §1 precondition 7), then
   settlement including five edge cases: nobody picks, participant left after
   picking, picked match promoted to Common, picked match removed from the pool,
   and **the cap lowered after picking** (research.md R16 — the one case with no
   analogue in #184's suite, and the one that silently breaks FR-003 if
   settlement's seed isn't bounded per participant).
4. **Client types and RPC clients** — `types/room.ts`, `types/guestRoom.ts`
   (three keys, two of them pre-existing on the wire), then both RPC client
   interfaces.
5. **Hooks** — `useRoomConfigure.setMyPicks` and
   `useGuestRoomSession.setMyPicks`, each with Jest coverage including the new
   error codes through `friendlyMessage`.
6. **Component extraction (do this before the panel)** — pull
   `SelectableMatchList` and `MatchSelectionCard` out of `AssignmentSection`,
   refactor `AssignmentSection` onto them, and confirm
   `AssignmentSection.platform.test.tsx` still passes **unchanged**. This is a
   pure refactor task with its own verification gate; keeping it separate from
   the panel task is what makes a regression in the solo flow immediately
   attributable. The card's `n/total` badge takes **both** numbers as props —
   the solo flow's denominator is pool size, the pick panel's is the cap, and
   the existing test asserts layout testIDs only, never badge text, so this task
   must add an assertion on the solo flow's rendered badge text (research.md
   R15).
7. **Pick panel and wiring** — `PlayerPickPanel` (cap-aware disabling, release,
   `RoomMatchSummary` mapping), `ParticipantList`'s progress badge, then the
   three call sites: lobby host branch, lobby member branch, guest surface. Add
   `player_picked` to the lobby's mode selector here — it is the switch that
   makes the whole slice reachable.
8. **E2E** — both features last, following the single-context mock pattern
   (research.md R12); this includes extending
   `mockConfigureStartGameServices`/`mockGuestRoomRpcServices` with the two new
   RPC routes and a `picks` array in the mock snapshots.

Three sequencing cautions:

- **The mode selector is the reachability switch.** Until `player_picked` is
  offered in `app/lobby/[sessionId].tsx`, no client-side task is manually
  verifiable end to end (the RPC guard raises `room_not_player_picked`). Either
  land the selector option early behind the panel work, or accept that steps 4–7
  are verified by Jest/pgTAP only until step 7 completes.
- **Extraction before panel, not alongside it.** If step 6 and step 7 land as one
  task, a solo-flow visual regression and a new-panel bug become
  indistinguishable. Step 6's gate is "the existing test passes with no edits".
- **The guest surface is the long pole.** It is the only client surface with no
  existing scaffolding — no screen, no snapshot-typed mode/plan, no actions at
  all before this slice. Budget it as the largest wiring task in step 7, though
  the extraction in step 6 is what keeps it from also being a design task.

## Rollback / Recovery

*Required by the constitution's delivery workflow: this release modifies
persisted data and a multiplayer flow.*

Reverting `038_player_picked_mode.sql` is clean, because the slice is additive at
every layer:

1. `DROP TABLE public.assignment_picks;` — takes its indexes, RLS policy, and
   grants with it. No other table references it, so no dependency order matters.
2. `DROP FUNCTION public.set_my_room_picks(uuid, uuid[]);` and
   `public.set_my_room_picks_as_guest(text, uuid[]);` plus their `private.`
   counterparts. Nothing else calls them.
3. `CREATE OR REPLACE` `private.build_guest_room_snapshot` and
   `private.start_game_session` from **037's definitions verbatim**. Both keep
   their signatures across the revert, so grants carry over and no
   `DROP FUNCTION` is needed in either direction.

**Data loss on revert**: only pick rows, which are `joinable`-era drafts by
definition. **No started game is affected** — settlement copies picks into
`public.assignments`, which the revert does not touch, so every already-started
or completed room keeps the exact assignment set it started with. A room sitting
in `player_picked` mode at revert time falls back to being settled by the
`automatic` branch (its `assignment_mode` value survives, since that column is
#184's), which is a degraded but correct start rather than a failure.

**Client rollback** is independent: the snapshot's `picks` key simply stops
appearing, and the typed clients treat it as absent. No client deploy needs to be
sequenced against the migration revert.

## Complexity Tracking

No constitutional violations to justify.

Two deliberate decisions worth naming, since each reverses or touches something
already shipped:

**A new table, where #184 chose not to.** #184's reasoning (021 research R2)
rested on "nothing writes to `public.assignments` pre-start except the host-only
`set_room_assignments`", and player-picked mode is precisely what falsifies that
premise. Sharing the table would let a host's replace-all `set_room_assignments`
call silently destroy every participant's picks, and would leave no way to tell
whose intent a row represented. The cost is one table, one policy, three
indexes; the alternative was a `source` discriminator column on a table two
shipped features already depend on (research.md R1).

**Refactoring a shipped, tested component (`AssignmentSection`).** Touching the
solo flow is not free, and FR-052 explicitly protects its behaviour. It is taken
anyway because the alternative — duplicating ~80 lines of match-card markup into
a new panel — puts the app's most visually distinctive interaction in two places
that will drift, and because reusing it is what lets the brand-new guest surface
inherit a finished visual language instead of needing one invented for it
(research.md R15). The refactor is presentation-only, guarded by the component's
existing responsive tests, and isolated into its own task with its own gate.
