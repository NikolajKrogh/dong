# Contract: Supabase RPCs — Player-Picked Mode

**Deltas against** `specs/020-canonical-assignment-generation/contracts/room-rpcs.md`
and `specs/021-host-assigned-mode/contracts/room-rpcs.md`. Anything not listed
here is unchanged by #185.

All functions follow the repo convention: a `private.*` implementation
(`SECURITY DEFINER`, `SET search_path = ''`, granted to `service_role` only)
behind a thin `public.*` wrapper carrying the role grant.

---

## 1. `public.set_my_room_picks` — NEW

Replaces the **calling participant's own** picks for a room.

```sql
public.set_my_room_picks(session_id uuid, match_ids uuid[]) RETURNS void
```

**Caller**: registered participant — member **or host**. The host is an ordinary
participant of their own room and picks like anyone else, so this function
contains **no** `owner_account_id` check (research.md R3).

**Grant**: `authenticated`.

**Identity resolution (FR-038a)**: the participant row is derived from
`auth.uid()`:

```
participants.session_id = p_session_id
AND participants.account_id = auth.uid()
AND participants.membership_type = 'registered'
AND participants.left_at IS NULL
```

There is **no `participant_id` parameter**. FR-039's "MUST NOT be able to change
another participant's picks" is therefore structural, not merely checked.

**Preconditions**, in evaluation order:

| # | Check | Error |
|---|---|---|
| 1 | `auth.uid()` is present | `not_authenticated` |
| 2 | Room exists (`SELECT ... FOR UPDATE`) | `room_not_found` |
| 3 | `state = 'joinable'` | `room_not_joinable` |
| 4 | `assignment_mode = 'player_picked'` | `room_not_player_picked` |
| 5 | Caller resolves to an active registered participant | `not_a_participant` |
| 6 | Every id in the *stripped* array is a match in this room's pool | `match_not_found` |
| 7 | `COALESCE(array_length(stripped, 1), 0) <= game_sessions.matches_per_player` | `pick_limit_exceeded` |

> **`COALESCE` is required, not cosmetic.** `array_length('{}'::uuid[], 1)`
> returns **NULL**, not 0 — so an unwrapped comparison makes the
> release-everything path (an empty array, contract-supported below) either pass
> or raise `pick_limit_exceeded` depending purely on how the guard is phrased
> (`IF … > cap` vs `IF NOT (… <= cap)`). Pinned here so the implementation can't
> pick the wrong one; pgTAP asserts the empty-set release explicitly.

**`FOR UPDATE` on the room row is required** — not for the cap (replace-all
makes that race-free) but for mutual exclusion with `start_game_session`, which
takes the same lock. Without it a pick can land between settlement's roster lock
and its seed-from-picks read, and be silently lost (research.md R2).

**Normalisation before validation**:
- `NULL` → empty array (an explicit "release everything" — see the `COALESCE`
  note under precondition 7; this path must succeed, not trip the cap guard).
- Duplicates de-duplicated.
- `game_sessions.common_match_id` **stripped silently** — FR-040a makes picking
  or releasing the Common Match a no-op, not an error, and it never counts
  toward the cap.

**Effect** (single transaction):
```sql
DELETE FROM public.assignment_picks
 WHERE session_id = p_session_id AND participant_id = <resolved participant>;
INSERT INTO public.assignment_picks (session_id, participant_id, match_id, created_at)
SELECT p_session_id, <resolved participant>, unnest(<stripped array>), now();
```

**Idempotency**: inherent. Submitting the same set is a no-op; conflict rule is
last-write-wins per participant, which only ever races the participant's own
devices (constitution II).

**Events**: none (research.md R9).

**Returns**: `void`. The caller re-reads the snapshot it already polls.

---

## 2. `public.set_my_room_picks_as_guest` — NEW

Same operation for a session-scoped guest, who has no `auth.uid()`.

```sql
public.set_my_room_picks_as_guest(guest_token text, match_ids uuid[]) RETURNS void
```

**Grant**: `anon`, `authenticated` — matching `public.leave_room_as_guest`
(`032_room_membership_rpcs.sql` line 330).

**Identity resolution (FR-038a)**: by room-scoped token hash, the established
pattern from `026_guest_room_join.sql` and `leave_room_as_guest`:

```
participants.guest_rejoin_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex')
AND participants.membership_type = 'guest'
AND participants.left_at IS NULL
```

The session is derived from the resolved participant — the guest never names a
room either. An empty/blank token raises `guest_token_expired`, matching
`get_guest_room_snapshot`'s existing vocabulary.

**Preconditions**: same table as §1, in this order: token resolves
(`guest_token_expired`) → room `joinable` (`room_not_joinable`) → mode is
`player_picked` (`room_not_player_picked`) → pool membership
(`match_not_found`) → cap (`pick_limit_exceeded`). `not_authenticated` and
`not_a_participant` do not apply: a resolving token *is* the participant.

**Normalisation, effect, idempotency, events, return**: identical to §1.

**Why a separate function rather than one with an optional token**: a single
function whose authorisation path depends on which argument is null is the
shape most likely to be got wrong later, and it would need an `anon` grant on a
function registered members also call. The repo already splits exactly this way
for leaving (research.md R3).

---

## 3. `private.build_guest_room_snapshot` — CHANGED (additive)

One new key, shaped like the existing `'assignments'` key:

```
'picks', COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
            'participantId', assignment_picks.participant_id::text,
            'matchId',       assignment_picks.match_id::text)
          ORDER BY assignment_picks.participant_id, assignment_picks.match_id)
   FROM public.assignment_picks
   WHERE assignment_picks.session_id = game_sessions.id), '[]'::jsonb)
```

**Additive only** — no existing key removed, renamed, reordered, or retyped.
Signature unchanged, so existing `REVOKE`/`GRANT` carry over; no
`DROP FUNCTION`.

**Serves both client surfaces from one edit** (FR-042): `private.get_room_snapshot`
delegates here (`032_room_membership_rpcs.sql` line 74) and so does
`private.get_guest_room_snapshot` (`026_guest_room_join.sql` line 269). Host,
registered member, and guest therefore all receive pick progress through the
poll they already run — no new fetch. Same precedent #184 set with
`assignmentMode`.

Picks for participants who have left are included in the snapshot (leaves are
soft). Clients render progress against the roster they already have, so a
departed participant's picks are naturally not displayed.

---

## 4. `private.start_game_session` — CHANGED (new branch)

Signature, all five pre-existing guards, the retry/idempotency handling, the
`FOR UPDATE` room lock, the roster lock, and the `automatic` / relaxed /
`host_assigned` branches are **byte-for-byte unchanged**.

```sql
private.start_game_session(p_session_id uuid, p_idempotency_key uuid,
                           p_relax_constraints boolean DEFAULT false) RETURNS jsonb
```

### The `player_picked` branch

**Step 1 — delete.** Full, unconditional:
```sql
DELETE FROM public.assignments WHERE session_id = p_session_id;
```
This is the `automatic`/relaxed shape, **not** `host_assigned`'s selective
delete. Host-assigned preserves rows because its drafts live in that very
table; picks live in `assignment_picks`, so there is nothing in `assignments`
worth keeping (research.md R6).

**Step 2 — seed from picks**, with three filters **and a per-participant cap**:
```sql
INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
SELECT p_session_id, ranked.participant_id, ranked.match_id, now()
  FROM (
    SELECT ap.participant_id, ap.match_id,
           row_number() OVER (PARTITION BY ap.participant_id ORDER BY random()) AS rn
      FROM public.assignment_picks ap
     WHERE ap.session_id  = p_session_id
       AND ap.participant_id = ANY (v_participant_ids)      -- locked roster (FR-041a)
       AND ap.match_id   <> v_room.common_match_id          -- FR-040a (R8)
       AND EXISTS (SELECT 1 FROM public.matches m
                    WHERE m.session_id = p_session_id AND m.id = ap.match_id)  -- still in pool
  ) ranked
 WHERE ranked.rn <= v_effective_per_player;                 -- cap (FR-003)
```

Each filter earns its place:
- **Roster** — FR-041a. Leaves are soft, so a departed participant's picks still
  exist and *must* be excluded here; this filter, not a cascade, is what
  implements "their picks leave with them" (research.md R5).
- **Common Match** — covers the case where a picked match was later *promoted*
  to Common by `set_common_match`. The participant drops to one short and step 3
  fills them, which is correct because they hold the Common Match anyway
  (research.md R8).
- **Pool membership** — belt-and-braces alongside the FK cascade; also covers
  remove-then-re-add ordering, and keeps the invariant local to the settlement
  code.
- **The `rn <= v_effective_per_player` cap** — reachable only through an
  ordering the pick RPC alone cannot prevent, and it would otherwise break
  FR-003 (research.md R16): the host lowers `matches_per_player` *after*
  participants have picked. Cap 3 → participant picks 3 → host drops the cap to
  2. Without this bound, step 2 seeds all 3, step 3 computes
  `v_needed := 2 - 3 = -1` (not `> 0`, so no fill and **no trim**), and that
  participant holds 3 additional matches while everyone else holds 2.
  Host-assigned mode is deliberately uncapped (FR-034) so 037's loop never
  needed to trim; player-picked has a hard cap (FR-040), so an over-hold is not
  a reachable *intended* state. Bounding the seed keeps
  `set_room_assignment_settings` unchanged, consistent with the rest of this
  design.

**Step 3 — fill.** The **same** count-and-fill loop `host_assigned` already
runs (migration 037 lines 394–418): per active participant, count non-Common
`assignments` rows, and if below `effectivePerPlayer`, insert that many random
pool matches excluding the Common Match and excluding matches already held,
appending the participant to `v_filled_participant_ids`. Satisfies FR-041's
"fill any remaining slots from the pool".

`effectivePerPlayer` is already the stored `matches_per_player` unraised in this
mode — `compute_room_assignment_plan` needs no change (#184, FR-011).

**Step 4 — Common Match.** The existing insert with
`ON CONFLICT (session_id, participant_id, match_id) DO NOTHING` — already
present and already correct.

**Feasibility interaction**: outside `automatic` mode
`compute_room_assignment_plan` sets `requiredPoolSize = relaxedFloor`, so
`feasible` is trivially true once the hard floor passes. The
`assignment_constraints_unsatisfiable` shortfall branch therefore never fires
for `player_picked`, exactly as it never fires for `host_assigned`. The
`insufficient_match_pool` hard floor (FR-017) still applies in every mode.

**Return**: unchanged shape. `filledInParticipantIds` is populated for this mode
too — load-bearing for pgTAP, and mirrored into the `session_started` event
payload for the room's history. It is **not** forwarded to clients (the Java
`CommandResponse` boundary, 021 research R5); the host learns who will be
filled in *pre-start*, from the lobby's progress display.

---

## 5. Unchanged RPCs — and why each is safe

| RPC | Why untouched |
|---|---|
| `public.set_room_assignments` | Host allocation only; writes `public.assignments`, never `assignment_picks`. Because the two tables are separate, a host action in host-assigned mode can no longer destroy picks (research.md R1) |
| `public.set_room_assignment_mode` | Already accepts `player_picked`; #184 withheld it only from the client's selector |
| `private.compute_room_assignment_plan` | Already mode-aware: `effectivePerPlayer` unraised outside `automatic` (#184, FR-011) |
| `private.remove_room_match` | Hard-deletes the match; the new FK's `ON DELETE CASCADE` clears dependent picks, so the RPC needs no edit (research.md R5) |
| `private.set_common_match` | Promotion of an already-picked match is handled by settlement's Common-Match filter (§4 step 2) |
| `leave_room_as_member` / `_as_guest` / `_as_host` | All soft-leave; settlement's roster filter makes a departed participant's picks inert (FR-041a) |

## 6. Java `command-api` — unchanged

No new endpoint, no new error mapping. Picks are direct-to-Supabase RPCs;
`start_game_session`'s signature and error vocabulary are unchanged, so
`StartGameCommandHandler.mapSupabaseError` needs no case (research.md R13).
`.\mvnw.cmd clean verify` is a regression check only.

---

## 7. Error vocabulary summary

| Code | Raised by | Meaning |
|---|---|---|
| `not_authenticated` | §1 | No `auth.uid()` |
| `guest_token_expired` | §2 | Blank or unrecognised guest token |
| `room_not_found` | §1 | No such room |
| `room_not_joinable` | §1, §2 | Room has left the lobby |
| `room_not_player_picked` | §1, §2 | Room is in `automatic` or `host_assigned` mode |
| `not_a_participant` | §1 | Caller is not an active registered participant of the room |
| `match_not_found` | §1, §2 | A submitted id is not in the room's pool (existing code reused) |
| `pick_limit_exceeded` | §1, §2 | Submitted count exceeds `matches_per_player` (FR-040) |
