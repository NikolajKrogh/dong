# Tasks: Player-Picked Assignment Mode

**Input**: Design documents from `specs/022-player-picked-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Scope**: this task list covers the **#185 row** of
`specs/020-canonical-assignment-generation/spec.md`'s Delivery Slices table —
User Story 6 (player-picked selection, FR-038–042 plus this issue's
FR-038a/FR-040a/FR-041a). US7 (#186, mid-game reassignment) is out of scope.
`specs/020/tasks.md` (#135) and `specs/021/tasks.md` (#184) are complete and
untouched.

**Tests**: included. Constitution §V requires unit tests for every new feature
behaviour, and this feature adds a new persisted table, a new authorisation
shape (the first non-host room write), and a new branch in a shared settlement
RPC. pgTAP remains the plpgsql unit-test level (carried over from
`specs/020` research.md R8).

**One user story**: unlike #184 (two stories), this slice delivers a single
story, so Phase 3 carries the whole feature and is sub-grouped by layer with an
internal checkpoint after the refactor gate.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, or independent bodies in the
  same pgTAP file, with no unresolved dependency)
- **[Story]**: which user story this task serves (US6)
- File paths are exact and relative to the repo root

---

## Phase 1: Setup

**Purpose**: nothing to scaffold — this feature extends existing subsystems
(`supabase/migrations/`, the Expo client) rather than creating one. The single
new client directory (`components/matchSelection/`) is created by the extraction
task that first populates it (T030). No setup phase is needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the picks table must exist, with its grants/RLS/indexes, and the
client types must describe the new snapshot shape, before any RPC or UI work can
reference either.

**⚠️ CRITICAL**: no user story task can start until this phase is complete.

- [X] T001 Create migration `supabase/migrations/038_player_picked_mode.sql`; add `CREATE TABLE IF NOT EXISTS public.assignment_picks (session_id uuid NOT NULL, participant_id uuid NOT NULL, match_id uuid NOT NULL, created_at timestamptz DEFAULT now(), PRIMARY KEY (session_id, participant_id, match_id))` with composite same-session FKs **both carrying `ON DELETE CASCADE`** — `(session_id, participant_id) REFERENCES public.participants(session_id, id)` and `(session_id, match_id) REFERENCES public.matches(session_id, id)` — plus indexes on `session_id`, `participant_id`, and `match_id`. Mirrors `007_create_assignments.sql`'s shape exactly so settlement's seed needs no shape translation (data-model.md; research.md R1). The match cascade is load-bearing: `private.remove_room_match` hard-deletes the match row (research.md R5)
- [X] T002 In the same migration file, add the table's grants and RLS mirroring `public.assignments` in `013_enable_rls_and_grants.sql` and `017_room_read_rls.sql`: `REVOKE ALL ... FROM anon, authenticated`, `GRANT SELECT ... TO authenticated`, `GRANT SELECT, INSERT, UPDATE, DELETE ... TO service_role`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and `CREATE POLICY assignment_picks_room_members_select ON public.assignment_picks FOR SELECT TO authenticated USING (private.can_access_session(public.assignment_picks.session_id))`. **No** INSERT/UPDATE/DELETE policy for `authenticated` — every write goes through the SECURITY DEFINER RPCs (data-model.md; research.md R4). Satisfies the constitution's "migrations, indexes, and RLS updates" clause, which binds for the first time in this delivery line
- [X] T003 Check `supabase/tests/database/010_schema.test.sql` against the new table and update it if it enumerates tables or asserts a table count; #184's CI caught exactly this class of break when `assignment_mode` was added (fix commit `be9c830`), so resolve it here rather than in CI (research.md R14) — depends on T001
- [X] T004 [P] In `types/room.ts`, add `export interface RoomPickSummary { participantId: string; matchId: string }`, add `picks: RoomPickSummary[]` to `RoomSnapshot`, and add `pickLimitExceeded: "pick_limit_exceeded"`, `roomNotPlayerPicked: "room_not_player_picked"`, `notAParticipant: "not_a_participant"` to `ROOM_ERROR` (data-model.md client types)
- [X] T005 [P] In `types/guestRoom.ts`, add `picks: GuestRoomPickSummary[]` to `GuestRoomSnapshot` **and** the two keys the type has been missing all along — `assignmentMode: GuestRoomAssignmentMode` and `assignmentPlan: GuestRoomAssignmentPlan`. `build_guest_room_snapshot` has returned `assignmentPlan` to guests since #135 and `assignmentMode` since #184; the guest type simply never declared them. The guest pick UI needs the cap (`matchesPerPlayer`) and the mode, so all three land now — **type-only change, no server work required for the first two** (research.md R11)

**Checkpoint**: the picks table exists with RLS and indexes; the schema test passes; client types describe the full snapshot shape and compile. User story work can begin.

---

## Phase 3: User Story 6 — Players pick their own matches (Priority: P2) 🎯 MVP

**Goal**: in player-picked mode every participant — host, registered member, or session-scoped guest — picks their own matches from the host's pool on their own device, up to the room's per-player count, with release; everyone sees everyone's progress; and the server keeps every pick and fills the remainder at start.

**Independent Test**: set the mode to player-picked, have two devices each pick a different number of matches, confirm each device sees the other's progress, start, and confirm each participant's stored set contains their own picks plus server-filled matches to the count.

### Server RPCs (all edits to `supabase/migrations/038_player_picked_mode.sql` — sequential, one file)

- [X] T006 [US6] Add `private.set_my_room_picks(p_session_id uuid, p_match_ids uuid[])` and its thin `public.set_my_room_picks(session_id uuid, match_ids uuid[])` wrapper with `REVOKE`/`GRANT ... TO authenticated` per the repo's private/public convention (contracts/room-rpcs.md §1). Resolve the participant from `auth.uid()` (`membership_type = 'registered'`, `left_at IS NULL`) — **no `participant_id` parameter exists**, which is what makes FR-039 structural rather than merely checked. Take `SELECT ... FOR UPDATE` on the room row for mutual exclusion with `start_game_session`, which takes the same lock (research.md R2). Contains **no** `owner_account_id` check: the host is an ordinary participant who picks like anyone else. Guards in order: `not_authenticated`, `room_not_found`, `room_not_joinable`, `room_not_player_picked`, `not_a_participant`, `match_not_found`, `pick_limit_exceeded`. Normalise first: `NULL` → empty array, de-duplicate, and **silently strip** `common_match_id` (FR-040a — a no-op, not an error, and never counted toward the cap). Cap guard **must** use `COALESCE(array_length(v_stripped, 1), 0) <= v_room.matches_per_player` — `array_length('{}'::uuid[], 1)` returns NULL, not 0, so an unwrapped comparison breaks the legitimate release-everything path. Effect is replace-all for that participant only: `DELETE` their rows, then `INSERT` the stripped set — depends on T001
- [X] T007 [US6] In the same migration file, add `private.set_my_room_picks_as_guest(p_guest_token text, p_match_ids uuid[])` and its `public.set_my_room_picks_as_guest(guest_token text, match_ids uuid[])` wrapper, granted to `anon, authenticated` matching `public.leave_room_as_guest` (`032_room_membership_rpcs.sql` line 330). Resolve the participant by token hash — `encode(extensions.digest(p_guest_token, 'sha256'), 'hex')` against `participants.guest_rejoin_token_hash`, `membership_type = 'guest'`, `left_at IS NULL` — exactly as `leave_room_as_guest` does; derive the session from the resolved participant, so the guest never names a room either. Blank/unresolved token raises `guest_token_expired`. All other guards, normalisation, the `FOR UPDATE` lock, and the replace-all effect are identical to T006 (contracts/room-rpcs.md §2; research.md R3) — depends on T001
- [X] T008 [US6] In the same migration file, `CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot` adding one **additive** `'picks'` key shaped like the existing `'assignments'` key (`[{participantId, matchId}]`, `ORDER BY participant_id, match_id`, `COALESCE(..., '[]'::jsonb)`) — no existing key removed, renamed, reordered, or retyped. Signature unchanged, so existing `REVOKE`/`GRANT` carry over; do not reissue them. This single edit serves **all three** client surfaces because `private.get_room_snapshot` and `private.get_guest_room_snapshot` both delegate here, satisfying FR-042's "rides the existing snapshot" without a new fetch (contracts/room-rpcs.md §3; research.md R7) — depends on T001
- [X] T009 [US6] In the same migration file, `CREATE OR REPLACE FUNCTION private.start_game_session` (same three-argument signature — no `DROP FUNCTION`, arity unchanged) adding the `player_picked` branch per contracts/room-rpcs.md §4. **Step 1**: full `DELETE FROM public.assignments WHERE session_id = p_session_id` — the automatic/relaxed shape, *not* host-assigned's selective delete, since picks live in another table (research.md R6). **Step 2**: seed `public.assignments` from `public.assignment_picks` filtered to `participant_id = ANY (v_participant_ids)` (locked roster — FR-041a), `match_id <> v_room.common_match_id` (FR-040a), and match still present in `public.matches`; wrap in `row_number() OVER (PARTITION BY participant_id ORDER BY random())` and keep only `rn <= v_effective_per_player` — **the per-participant bound is required** or a host lowering the cap after picks exist leaves that participant over-held, since the inherited fill loop computes a negative `v_needed` and trims nothing (research.md R16, FR-003). **Step 3**: the existing count-and-fill loop, reused verbatim from the `host_assigned` branch, recording `v_filled_participant_ids`. **Step 4**: the existing Common Match insert with `ON CONFLICT ... DO NOTHING`, unchanged. The five pre-existing guards, the retry/idempotency handling, both locks, and the `automatic`/relaxed/`host_assigned` branches stay byte-for-byte unchanged — depends on T001, T006, T007

### Tests for User Story 6 — authorisation boundary (the security-sensitive part)

All in `supabase/tests/database/250_player_picked_mode.test.sql`.

- [X] T010 [P] [US6] pgTAP: a **registered non-host member** calls `set_my_room_picks` and the rows land against *their* participant id; re-reading `build_guest_room_snapshot`'s `picks` shows them (FR-038, FR-038a), in `supabase/tests/database/250_player_picked_mode.test.sql` — depends on T006, T008
- [X] T011 [P] [US6] pgTAP: a **session-scoped guest**, authenticated only by room-scoped token, calls `set_my_room_picks_as_guest` successfully, and the rows land against their participant id — the first non-host, non-`auth.uid()` room write in the codebase (FR-038a; the issue's own "read this first" emphasis), in `supabase/tests/database/250_player_picked_mode.test.sql` — depends on T007, T008
- [X] T012 [P] [US6] pgTAP: member A's call leaves member B's picks **untouched**, and a signed-in user who is not a participant of the room raises `not_a_participant`; a blank/unrecognised guest token raises `guest_token_expired` (FR-039), in `supabase/tests/database/250_player_picked_mode.test.sql` — depends on T006, T007
- [X] T013 [P] [US6] pgTAP: RLS on `public.assignment_picks` — `authenticated` can `SELECT` rows only for a room `private.can_access_session` admits, and has **no** INSERT/UPDATE/DELETE grant, so a direct table write is refused even for one's own row (research.md R4) — depends on T002
- [X] T014 [P] [US6] pgTAP: the host calls `set_my_room_picks` for themselves successfully — confirming the function has no `owner_account_id` gate and the host participates like any other participant (contracts/room-rpcs.md §1) — depends on T006

### Tests for User Story 6 — cap, release, pool, and mode guards

- [X] T015 [P] [US6] pgTAP: submitting exactly `matches_per_player` ids succeeds; one more raises `pick_limit_exceeded` and changes nothing; resubmitting a **smaller** set releases the difference (this is how release works — there is no separate RPC); resubmitting the **identical** set is an idempotent no-op (FR-040), in `supabase/tests/database/250_player_picked_mode.test.sql` — depends on T006
- [X] T016 [P] [US6] pgTAP: submitting an **empty array** (and `NULL`) releases everything and **succeeds** — it must not raise `pick_limit_exceeded`. This is the `array_length`/`COALESCE` trap from T006: `array_length('{}'::uuid[], 1)` is NULL, not 0 (contracts/room-rpcs.md §1 precondition 7) — depends on T006
- [X] T017 [P] [US6] pgTAP: a match id from **another room**, or one absent from this room's pool, raises `match_not_found`; the **Common Match** included in the input is silently stripped rather than rejected, and does not count toward the cap — so submitting `matches_per_player` real picks plus the Common Match still succeeds (FR-039, FR-040a), in `supabase/tests/database/250_player_picked_mode.test.sql` — depends on T006
- [X] T018 [P] [US6] pgTAP: picking in `automatic` and in `host_assigned` mode each raises `room_not_player_picked`; picking in an `in_progress` room raises `room_not_joinable` (FR-038), in `supabase/tests/database/250_player_picked_mode.test.sql` — depends on T006, T007

### Tests for User Story 6 — settlement

- [X] T019 [P] [US6] pgTAP: with every participant picking a partial set, starting the game keeps **every** picked match in that participant's settled set, fills each to `effectivePerPlayer` from the pool, and `filledInParticipantIds` names exactly those who needed filling (FR-041; issue acceptance scenario 3, SC-008), in `supabase/tests/database/250_player_picked_mode.test.sql` — depends on T009
- [X] T020 [P] [US6] pgTAP: **nobody picks anything** — every set is server-filled and the outcome is indistinguishable from an automatic start (spec.md edge case) — depends on T009
- [X] T021 [P] [US6] pgTAP: a participant **leaves after picking** (`left_at IS NOT NULL`) — their picks are excluded from settlement even though the rows still exist (leaves are **soft**, so this is the roster filter, not a cascade), and no remaining participant's set changes (FR-041a; research.md R5) — depends on T009
- [X] T022 [P] [US6] pgTAP: a picked match is later **promoted to Common Match** via `set_common_match` — the pick is dropped by settlement's Common-Match filter, the participant is one short, step 3 fills them, and they end with the Common Match plus the full count (FR-040a; research.md R8) — depends on T009
- [X] T023 [P] [US6] pgTAP: the cap is **lowered after picking** (cap 3 → participant picks 3 → host sets cap to 2 via `set_room_assignment_settings`) — that participant holds exactly 2 additional matches, same as everyone else. Without step 2's per-participant `rn` bound they would hold 3, since the inherited fill loop trims nothing (research.md R16, FR-003). The one settlement case with no analogue in #184's suite — depends on T009
- [X] T024 [P] [US6] pgTAP: `private.remove_room_match` on a match some participant had picked succeeds with **no FK violation**, and the dependent pick rows are gone — the `ON DELETE CASCADE` from T001 (research.md R5) — depends on T001

### RPC clients and hooks

- [X] T025 [US6] In `utils/supabaseClient.ts`, add `setMyRoomPicks(sessionId: string, matchIds: string[]): Promise<void>` to the `RoomRpcClient` interface and its implementation, and `setMyRoomPicksAsGuest(guestToken: string, matchIds: string[]): Promise<void>` to `GuestRoomRpcClient` and its implementation, calling `set_my_room_picks` / `set_my_room_picks_as_guest` with the snake_case argument names the RPCs declare (one file, both interfaces — do not split) — depends on T004, T005, T006, T007
- [X] T026 [P] [US6] Add `setMyPicks: (matchIds: string[]) => Promise<void>` to `UseRoomConfigureResult` and its implementation in `hooks/useRoomConfigure.ts`, following the existing `setAssignments` pattern (the `run(...)` wrapper, so `onMutated` refreshes the snapshot on success). Add friendly copy for the three new codes to `ROOM_ERROR_MESSAGES` — `pick_limit_exceeded` ("You've already picked your matches — release one to pick another."), `room_not_player_picked`, `not_a_participant` — depends on T025
- [X] T027 [P] [US6] Add `setMyPicks: (matchIds: string[]) => Promise<void>` **and an `isBusy` flag** to `UseGuestRoomSessionResult`, implemented in `hooks/useGuestRoomSession.ts`: call `setMyRoomPicksAsGuest` with the active grant's `guestToken`, then refresh the session snapshot via the existing path **before** clearing `isBusy`; surface failures through the hook's existing `error` state and treat an expired-token failure the way the hook already treats `isExpiredGuestRoomError`. The busy flag is not cosmetic — `useRoomConfigure`'s `run()` wrapper already provides this on the registered path, and without the equivalent here the replace-all contract loses writes on rapid taps (see T035's local-state note) — depends on T025
- [X] T028 [P] [US6] Add `setMyPicks` coverage to `__tests__/hooks/useRoomConfigure.test.ts`: success, `onMutated` fires, and each of the three new RPC error codes maps through `friendlyMessage` — depends on T026
- [X] T029 [P] [US6] Add `setMyPicks` coverage to `__tests__/hooks/useGuestRoomSession.test.ts`: success refreshes the snapshot, and an expired token routes through the hook's existing expiry handling — depends on T027

### Component extraction (a gated refactor — must land before the pick panel)

The plan is explicit that this precedes the panel: if extraction and panel land
together, a solo-flow visual regression and a new-panel bug become
indistinguishable. This sub-phase's gate is "the existing test passes with no
edits" (research.md R15).

- [ ] T030 [P] [US6] Create `components/matchSelection/SelectableMatchList.tsx` by lifting `AssignmentSection`'s `renderMatchItem` / `renderCompactMatchItem` bodies and the grid ⇄ list toggle verbatim — team logos via `getTeamLogoWithFallback`, `LinearGradient` cards, VS divider, numbered badge, `checkmark-circle`/`ellipse-outline` selection icon, `createSetupGameStyles(colors)` styling. Props: a neutral match view-model array (`{ id, homeTeam, awayTeam, startTime? }`), `selectedMatchIds`, `onToggleMatch`, and a **new** optional `disabledMatchIds` (needed for the cap: at the limit, unpicked matches disable while picked ones stay releasable). The neutral view-model is what lets the room snapshot's `RoomMatchSummary` feed the same component (research.md R15)
- [ ] T031 [P] [US6] Create `components/matchSelection/MatchSelectionCard.tsx` — the collapsible header shell with chevron and count badge lifted from `AssignmentSection`'s per-player card. The badge takes **`selectedCount` and `totalCount` as explicit props**: the solo flow's denominator is pool size (`nonCommonMatches.length`) while the pick panel's is the cap (`assignmentPlan.matchesPerPlayer`), so baking either in silently breaks one of them (research.md R15)
- [ ] T032 [US6] Refactor `components/setupGame/AssignmentSection.tsx` to consume `SelectableMatchList` and `MatchSelectionCard`, preserving the `AssignmentPlayersGrid` and `AssignmentPlayerCard` testIDs **verbatim** and passing `totalCount={nonCommonMatches.length}` to keep the badge identical. Behaviour must not change — FR-052 keeps the solo flow exactly as it is, so this is presentation-only: no change to `toggleMatchAssignment`, the randomize flow, the info modals, or the collapse defaults. `__tests__/components/setupGame/AssignmentSection.platform.test.tsx` must pass **with no edits** — depends on T030, T031
- [ ] T033 [US6] Add a badge-text assertion to `__tests__/components/setupGame/AssignmentSection.platform.test.tsx` covering the solo flow's `n/poolSize` denominator. The existing test asserts only the grid/card testIDs and their layout, never the badge text, so the denominator regression T031 guards against would otherwise pass unnoticed (research.md R15) — depends on T032
- [ ] T034 [P] [US6] Add `__tests__/components/matchSelection/SelectableMatchList.platform.test.tsx` and `MatchSelectionCard.platform.test.tsx`: selection toggling calls back with the right match id, `disabledMatchIds` entries do not fire `onToggleMatch`, the grid ⇄ list toggle switches renderers, and the card renders `selectedCount`/`totalCount` as given — depends on T030, T031

**Checkpoint**: the shared match-selection components exist and the solo flow renders and behaves exactly as before (FR-052). Safe to build the pick panel on top.

### Pick panel and UI wiring

- [ ] T035 [P] [US6] Create `components/lobby/PlayerPickPanel.tsx` — thin by design. **Props are already-mapped data, not a snapshot**: `matches` (the neutral view-model array), `myPicks: string[]`, `cap: number`, `onSetPicks(matchIds)`, `isBusy`. It must NOT accept a `RoomSnapshot`/`GuestRoomSnapshot` union — `RoomMatchSummary` and `GuestRoomMatchSummary` do not unify (`sourceProvider` is `string` vs `string | null`; `homeScore`/`awayScore` are `number` vs `number | null`), so each call site does its own `homeTeamName`→`homeTeam`, `awayTeamName`→`awayTeam`, `kickoffAt`→`startTime` mapping — the same three-field mapping `app/lobby/[sessionId].tsx` already performs in its `setMatches` hydration. Excludes the Common Match from the offered pool (FR-040a), computes `disabledMatchIds` as the unpicked remainder once the cap is reached (FR-040), and calls `onSetPicks` with the full next array (replace-all, matching the RPC). Renders inside a `MatchSelectionCard` with `selectedCount`/`totalCount`. **Holds local pick state seeded from `myPicks` and reconciled when `myPicks` changes** — without it, replace-all loses writes: a second tap before the ~4s poll (1s for guests) returns would derive its array from stale `picks` and clobber the first. `hasHydratedGameplayRef` in the lobby screen is the existing precedent for snapshot-seeded local state. `testID="lobby-player-pick-panel"`, per-match `testID="lobby-pick-{matchId}"` — depends on T030, T031
- [ ] T036 [P] [US6] Extend `components/lobby/ParticipantList.tsx` with an optional per-participant trailing progress badge (`pickProgress?: Record<string, { picked: number; total: number }>`), rendered as one more badge beside the existing `· role` label rather than as a second list — the roster list every surface already shows becomes the FR-042 progress display. `testID="lobby-pick-progress-{participantId}"`. Absent prop renders exactly as today (research.md R15)
- [ ] T037 [US6] In `app/lobby/[sessionId].tsx`, add `player_picked` to the mode selector's option array (`testID="lobby-assignment-mode-player-picked"`), which #184 deliberately withheld. **This is the reachability switch** — until it lands, every client task above is verifiable only by Jest/pgTAP, since the RPCs raise `room_not_player_picked` (plan.md Phase 2 Notes) — depends on T004
- [ ] T038 [US6] In `app/lobby/[sessionId].tsx`, render `PlayerPickPanel` in **both** the host branch and the non-host branch when `lobby.snapshot.assignmentMode === "player_picked"` and the room is `joinable`, wired to `configure.setMyPicks` and gated on `configure.isBusy`; map `lobby.snapshot.matches` to the panel's view-model at this call site (T035). Pass `pickProgress` (derived from `snapshot.picks` and `assignmentPlan.matchesPerPlayer`) to the existing `ParticipantList`. Both branches are required because the host is a participant who picks their own matches too. Also confirm the host-allocation block stays gated on `assignmentMode === "host_assigned"` so it does **not** render in player-picked mode: `set_room_assignments` has no mode guard server-side, so a host could otherwise write allocations that settlement's step-1 full delete silently discards — harmless but confusing — depends on T026, T035, T036, T037
- [ ] T039 [US6] Extend `components/guestJoin/GuestJoinLobby.tsx` — the guest's entire room surface, today a read-only card — with the room's match pool, `PlayerPickPanel` wired to the new `setMyPicks`/`isBusy` from `useGuestRoomSession` (mapping `GuestRoomMatchSummary` to the view-model here, per T035), and the progress display, shown only when `snapshot.assignmentMode === "player_picked"` and the room is `joinable`. The guest's own participant id comes from `session.grant.participantId`. This is the largest wiring task: the guest surface has no existing scaffolding, no actions, and until T005 no typed mode or plan (research.md R10) — depends on T005, T027, T035, T036
- [ ] T040 [P] [US6] Add `__tests__/components/lobby/PlayerPickPanel.platform.test.tsx`: the Common Match is not offered; picking calls `onSetPicks` with the full next array; at the cap the unpicked matches are disabled while picked ones remain releasable; the badge reads `n/cap`; **and two rapid toggles before any prop update produce `[A, B]`, not `[B]`** — the lost-update case T035's local state exists to prevent — depends on T035
- [ ] T041 [P] [US6] Extend `__tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx`: in `player_picked` mode a guest sees the pool and the pick control; in `automatic`/`host_assigned` mode, and in a non-`joinable` room, the panel is absent and the card renders as before — depends on T039

### End-to-end (Playwright BDD)

Follows the suite's existing **single-context** mock pattern — there are no
multi-context helpers despite the issue's note, so other participants are
simulated via shared mock state (research.md R12).

- [ ] T042 [US6] In `e2e/steps/browser-flow.helpers.ts`, extend `mockConfigureStartGameServices` with a `**/rest/v1/rpc/set_my_room_picks` route that mutates `configureStartGameState` (so repeated `get_room_snapshot` polls reflect it), add a `picks` array to the mocked room snapshot, and have the start-game mock seed assignments from those picks plus a fill to the count; extend `mockGuestRoomRpcServices` with a `**/rest/v1/rpc/set_my_room_picks_as_guest` route and `picks`, `assignmentMode`, `assignmentPlan` on the mocked guest snapshot — depends on T004, T005
- [ ] T043 [US6] Extend `e2e/features/configure-start-game.feature` and `e2e/steps/configure-start-game.steps.ts` with the player-picked journey: the host switches the mode to player-picked, picks their own matches, sees a second participant's progress (injected via mock state), starts the game, and the settled assignments reflect the picks plus server fill — depends on T037, T038, T042
- [ ] T044 [US6] Extend `e2e/features/guest-room-join.feature` and `e2e/steps/guest-room-join.steps.ts` with the guest pick journey: a guest in a player-picked room sees the host's pool, picks up to the cap, is refused the one past it, and releases one to pick another — the two-participant-on-separate-devices coverage the issue asks for, at the fidelity this suite is built for — depends on T039, T042

**Checkpoint**: User Story 6 is fully functional — every participant kind picks on their own device, progress is shared, and the server settles picks plus fill at start. Issue #185 is closed by this point.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T045 [P] Run `npm run db:reset && npm run db:test`, confirming `038_player_picked_mode.sql` applies cleanly on top of `037_...` and that `supabase/tests/database/250_player_picked_mode.test.sql` passes in full alongside the existing suite (especially `010_schema.test.sql`, per T003)
- [ ] T046 [P] Run `npm test && npm run lint` across the client changes (T004–T005, T025–T041), confirming no new lint errors in touched files and that the pre-existing `AssignmentSection` suite still passes
- [ ] T047 [P] Run `.\mvnw.cmd clean verify` in `command-api/` to confirm the Java service is unaffected — a regression check only, no source change expected (research.md R13)
- [ ] T048 Run `npm run bdd:gen && npm run test:e2e` against both extended journeys (T043, T044); requires Expo web running plus a browser
- [ ] T049 Walk through `quickstart.md` end to end — the registered two-device flow, the guest picking flow, and every settlement edge case listed there — confirming each step matches its documented outcome
- [ ] T050 Add the rollback note from `plan.md` (§Rollback / Recovery) to the PR description: releases modifying persisted data or multiplayer flows must ship rollback/recovery notes per the constitution's delivery workflow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: empty — nothing to scaffold
- **Phase 2 (Foundational)**: blocks all of Phase 3. T001 → T002/T003; T004/T005 are independent of the SQL and of each other
- **Phase 3 (US6)**: the whole feature. Internally layered:
  - Server RPCs (T006–T009) are all edits to **one migration file** → strictly sequential, never `[P]` with each other
  - pgTAP (T010–T024) can all run in parallel once their target RPC exists
  - Clients/hooks (T025–T029) depend on the RPCs existing
  - Extraction (T030–T034) is **independent of all server work** — it can start as soon as Phase 2 lands, in parallel with the entire SQL track
  - Panel/wiring (T035–T041) depends on the extraction gate **and** the hooks
  - E2E (T042–T044) last
- **Phase 4 (Polish)**: depends on Phase 3

### The two orderings that matter most

1. **Extraction before panel** (T030–T034 before T035). If they land together, a
   solo-flow regression and a new-panel bug are indistinguishable. T032's gate is
   "`AssignmentSection.platform.test.tsx` passes with no edits".
2. **The mode selector is the reachability switch** (T037). Until it lands, no
   client task is manually verifiable end to end, because the RPCs raise
   `room_not_player_picked`. Land it early in the wiring sub-phase, or accept
   Jest/pgTAP-only verification for T025–T036.

### Parallel Opportunities

- T004 and T005 (different type files) run in parallel with T001–T003
- **Two independent tracks after Phase 2**: the SQL track (T006–T024) and the
  component-extraction track (T030–T034) share no files and can be staffed
  simultaneously — the largest parallelisation win in this slice
- T010–T024: all pgTAP bodies in one file but mutually independent
- T026/T027 (different hook files), T028/T029 (different test files)
- T030/T031 (two new files), T035/T036 (panel vs. participant list)
- T040/T041 (different test files); T045–T047 (three separate toolchains)

---

## Parallel Example: after the Phase 2 checkpoint

```bash
# Track A — server (sequential within the migration, then fan out to pgTAP)
Task: "T006 set_my_room_picks in supabase/migrations/038_player_picked_mode.sql"
Task: "T007 set_my_room_picks_as_guest in the same migration"

# Track B — client components (no overlap with Track A's files)
Task: "T030 Create components/matchSelection/SelectableMatchList.tsx"
Task: "T031 Create components/matchSelection/MatchSelectionCard.tsx"
```

```bash
# Once T009 lands, the settlement pgTAP group fans out:
Task: "T019 picks kept + filled to count in supabase/tests/database/250_player_picked_mode.test.sql"
Task: "T020 nobody picks → all server-filled"
Task: "T021 participant left after picking → excluded"
Task: "T022 picked match promoted to Common → filled"
Task: "T023 cap lowered after picking → seed bounded"
```

---

## Implementation Strategy

### MVP scope

This slice has **one user story**, so US6 *is* the MVP — there is no smaller
shippable increment that closes issue #185. The natural intermediate demo is the
Phase 3 sub-checkpoint: server RPCs plus pgTAP green means picking is real and
proven at the database boundary, with the UI still to come.

### Incremental delivery

1. Phase 2 → table, RLS, and types ready
2. Server RPCs + pgTAP (T006–T024) → picking and settlement provably correct,
   including the guest authorisation boundary
3. Extraction gate (T030–T034) → shared match-selection components, solo flow
   verified unchanged
4. Panel + wiring (T035–T041) → picking works on host, member, and guest devices
   → demo (closes #185)
5. E2E + polish (T042–T050) → final gate

### Suggested staffing if parallel

The SQL track and the component-extraction track are fully independent after
Phase 2 and are comparable in size — the cleanest two-developer split in this
feature. They converge at T038/T039, which need both the hooks and the extracted
components.

---

## Notes

- [P] tasks = different files (or independent bodies in the same pgTAP file), no
  unresolved dependency
- T006–T009 all edit `038_player_picked_mode.sql`; they are one file by
  construction, so the split-migration hazard #184's tasks.md warned about
  cannot arise here
- The guest surface (T039) is the long pole: it is the only client surface with
  no existing scaffolding
- Commit after each task or logical group
- Avoid: marking same-file tasks [P], and landing T032 and T035 together
