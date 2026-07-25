# Contract: `start-game` Command API — Canonical Assignment Generation

**Feature**: `specs/020-canonical-assignment-generation` | **Issue**: #135

Amends the contract established in `specs/018-configure-start-game/contracts/start-game-api.md`.
Endpoint, authentication, and idempotency-header semantics are unchanged.

---

## Endpoint

```
POST /v1/rooms/{roomId}/commands/start-game
Authorization: Bearer <host Supabase JWT>
Idempotency-Key: <UUID v4>
Content-Type: application/json
```

## Request body — CHANGED

```json
{
  "relaxConstraints": false
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `relaxConstraints` | boolean | no, defaults `false` | The host has been shown the shortfall and explicitly chose to start anyway with the overlap rule relaxed (FR-013, FR-015) |

**The client determines whether to set this from the room snapshot, before
calling.** `assignmentPlan.feasible` in the snapshot says whether the
configuration is satisfiable; `assignmentPlan.startable` says whether a relaxed
start is possible at all. The host answers the warning in the lobby, and
`start-game` is then called **once** with the flag already set.

Do **not** implement a two-call handshake — call, receive a rejection, call again.
The whole point of resolving feasibility as a read is that the room is never
touched while the host decides (FR-014). See research.md R2.

## Success response — UNCHANGED

`200 OK`

```json
{
  "commandType": "start-game",
  "roomId": "…",
  "idempotencyKey": "…",
  "status": "ACCEPTED",
  "timestamp": "…"
}
```

This is the existing generic command envelope (`CommandResponse`) — per ADR-1's
boundary rule, handler internals never leak into it, so `relaxedConstraints` and
the settled assignment count are **not** in this response. The RPC itself does
return them (see `contracts/room-rpcs.md` §4), and the Java handler's
`CommandResult.detail()` carries that raw payload through to the idempotency
store for replay — but the controller never surfaces `detail()` in
`CommandResponse`, matching every other command in this API. The client learns
whether the start was relaxed, and reads the settled assignments, from the next
room snapshot poll (`assignmentPlan`, `assignments`, `state` — FR-024), not from
this response. Do not add fields to `CommandResponse` for this command alone.

## Error responses

| `error` | HTTP | When |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Caller is not the room host |
| `MISSING_IDEMPOTENCY_KEY` / `INVALID_UUID` | 422 | Header problems |
| `IDEMPOTENCY_KEY_REUSE` | 409 | Key already used for a different room or command |
| `ROOM_NOT_FOUND` | 422 | Unknown room |
| `INVALID_ROOM_STATE` | 422 | Room is not `joinable` |
| `EMPTY_PARTICIPANTS` | 422 | No active participants |
| `EMPTY_MATCHES` | 422 | No matches selected |
| `MISSING_COMMON_MATCH` / `INVALID_COMMON_MATCH` | 422 | Common Match unset or not in pool |
| **`INSUFFICIENT_MATCH_POOL`** | 422 | Pool smaller than `1 + effectivePerPlayer`. Not overridable — relaxation loosens the overlap rule, never the arithmetic floor (FR-017) |
| **`ASSIGNMENT_CONSTRAINTS_UNSATISFIABLE`** | 422 | Pool cannot honour the configured overlap and `relaxConstraints` was not set. Recoverable by retrying with the flag (FR-013) |

`UNASSIGNED_PARTICIPANTS` is **retired**: assignments are a product of starting,
not a precondition (FR-019, superseding `specs/018` FR-008).

**Retry semantics** are unchanged (FR-025). A completed key replays the stored
response without re-entering the RPC, so a retried start cannot produce a second,
different assignment set. A failed attempt releases its reservation
(`CommandDispatcher:53-57`), so the key remains reusable.

---

## Handler changes

`StartGameCommandHandler`:

- **Remove** `validate()` and its `get_room_snapshot` call. Those five rules exist
  in `start_game_session` as the authoritative check under the row lock; the Java
  copy was an optimistic duplicate and is now a TOCTOU liability, since generation
  must see the same locked roster (research.md R1).
- **Pass** `relax_constraints` through to the RPC from the command payload.
- **Extend** `mapSupabaseError` with the new error strings from
  `contracts/room-rpcs.md`, and drop the `unassigned_participants` case.

Net effect: the handler becomes dispatch + auth + idempotency + error mapping, and
holds no business rules. This is what constitution §IV asks of the Java layer —
orchestration, not a second validation authority.
