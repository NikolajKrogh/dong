# Contract: Supabase RPCs — Assignment Mode + Host-Assigned Allocation

**Feature**: `specs/021-host-assigned-mode` | **Issue**: #184 | **Canonical
spec**: `specs/020-canonical-assignment-generation/spec.md`

Builds on `specs/020-canonical-assignment-generation/contracts/room-rpcs.md`
(the #135 contracts, already shipped). Every RPC follows the same established
shape: a `private.*` implementation (`SECURITY DEFINER`, `SET search_path =
''`, granted to `service_role` only) and a thin `public.*` wrapper granted to
`authenticated`. Errors are raised as bare snake_case strings.

---

## 1. `public.set_room_assignment_mode` — NEW

Host sets the room's assignment mode (FR-026, FR-029, FR-030).

```sql
public.set_room_assignment_mode(
    session_id uuid,
    mode       text  -- 'automatic' | 'host_assigned' | 'player_picked'
) RETURNS void
```

**Guards**

| Condition | Error |
|---|---|
| No `auth.uid()` | `not_authenticated` |
| Room absent | `room_not_found` |
| Caller is not `owner_account_id` | `not_host` |
| `state <> 'joinable'` | `room_not_joinable` |
| `mode` not one of the three enum values | `invalid_assignment_mode` |

**Idempotent**: writing the mode already stored is a no-op success (same
pattern as `set_room_assignment_settings`). Emits no gameplay event
(research.md R7 — matches the sibling settings RPC's precedent).

**Not enforced here**: the client-side "existing draft will be discarded"
confirmation (FR-030a) is a UI gate before this call is made, not a
server-side rule — the RPC has no way to know a draft existed versus not, and
switching mode never itself deletes `public.assignments` rows (only
`start_game_session` does, per mode, at start).

---

## 2. `public.set_room_assignment_settings` — CHANGED

Signature and guard table are unchanged from `specs/020`'s contract, with one
amendment:

| Condition | Error |
|---|---|
| `matches_per_player < shared_matches_per_pair × (P − 1)` for the current active roster **AND `assignment_mode = 'automatic'`** | `per_player_count_below_minimum` |

Outside automatic mode, any `matches_per_player >= 0` is accepted regardless
of `shared_matches_per_pair` (FR-011) — the minimum-floor guard is skipped
entirely.

---

## 3. `private.compute_room_assignment_plan` — CHANGED (internal helper)

Same call shape and return keys as `specs/020`'s contract. The computation of
`effectivePerPlayer` (and therefore `requiredPoolSize`/`relaxedFloor`, which
derive from it) now branches on the room's `assignment_mode`:

```json
{
  "participantCount": 4,
  "poolSize": 6,
  "matchesPerPlayer": 2,
  "sharedMatchesPerPair": 1,
  "effectivePerPlayer": 2,
  "requiredPoolSize": 9,
  "relaxedFloor": 3,
  "feasible": false,
  "startable": true
}
```

- **`automatic`**: `effectivePerPlayer = GREATEST(matchesPerPlayer,
  sharedMatchesPerPair × (participantCount − 1))` — unchanged from #135.
- **`host_assigned`** (and `player_picked`, #185): `effectivePerPlayer =
  matchesPerPlayer` exactly, never raised by `sharedMatchesPerPair` (FR-011).
  `requiredPoolSize`/`relaxedFloor` are computed from that unraised value, so
  the lobby's pool-requirement display (FR-033) is accurate per mode.

---

## 4. `public.start_game_session` — CHANGED

Call signature is unchanged from `specs/020`'s contract
(`session_id, idempotency_key, relax_constraints`). Return shape gains one
field:

```json
{
  "status": "started",
  "sessionId": "…",
  "relaxedConstraints": false,
  "assignmentsCreated": 9,
  "filledInParticipantIds": ["participant-uuid-a", "participant-uuid-b"]
}
```

`filledInParticipantIds` is empty outside `host_assigned` mode, and empty
within it when every participant already had their full count allocated. It
is also carried in the `session_started` gameplay event payload alongside
`relaxedConstraints`.

**This field does not reach the client.** Exactly like `relaxedConstraints`
before it, the Java command-api's `CommandResponse` does not forward RPC/
handler internals (`command-api/.../CommandResult.java`: *"Handler internals
never leak to clients"*). FR-037's host-facing echo is satisfied **pre-start**
in the lobby instead, from the same per-participant shortfall data the "still
short" indicator (contracts unaffected — this is client-only, see
research.md R9) already computes. The RPC field exists for pgTAP (which calls
this function directly) and the event payload's audit trail, not for a client
consumer.

**New generation branch** (`assignment_mode = 'host_assigned'`, research.md
R4):

1. Existing `public.assignments` rows for active participants are **kept**,
   not deleted up front.
2. A row equal to `(participant, common_match_id)` does not count toward that
   participant's held count (User Story 5's Common-Match-allocated-explicitly
   edge case is a no-op).
3. Each active participant short of `effectivePerPlayer` additional matches is
   filled at random from the pool (excluding the Common Match and matches
   they already hold) until they reach it; their ID is recorded into
   `filledInParticipantIds`.
4. The Common Match is inserted for every active participant via `ON CONFLICT
   (session_id, participant_id, match_id) DO NOTHING`, since a host may have
   already explicitly allocated it (step 2).
5. Guard order (`not_host`, `invalid_room_state`, `empty_participants`,
   `empty_matches`, `missing_common_match`/`invalid_common_match`,
   `insufficient_match_pool`) is unchanged and evaluated before any
   mode-specific branch, same as #135.

The `automatic` and existing relaxed-fallback branches are byte-for-byte
unchanged.

---

## 5. `public.set_room_assignments` — UNCHANGED (reused, not modified)

Still exactly the RPC shipped in migration 035
(`specs/018-configure-start-game`): host-only, `joinable`-only, full
replace-all of `public.assignments` for the room, emits `assignment_replaced`.
This is the host's allocation call in host-assigned mode — no contract change
(research.md R2). Included here only to record that it was evaluated and
found not to need one.
