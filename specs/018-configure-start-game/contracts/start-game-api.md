# Contract: Start Game Command API

**Feature**: `specs/018-configure-start-game`  
**Version**: v1  
**Date**: 2026-06-28

## Endpoint

```
POST /v1/rooms/{roomId}/commands/start-game
```

Starts the multiplayer game session for the room, validating all prerequisite configurations (participants, matches, common match, and assignments) before transitioning the state to `in_progress`.

---

## Required Headers

| Header | Format | Example | Behaviour on violation |
|--------|--------|---------|------------------------|
| `Authorization` | `Bearer <JWT>` | `Bearer eyJ...` | 401 + `ApiError(UNAUTHORIZED)` |
| `Idempotency-Key` | UUID v4 | `a32f10b5-78cc-4d82-b437-1202e2c3d599` | 422 + `ApiError(MISSING_IDEMPOTENCY_KEY)` if absent; 409 + `ApiError(IDEMPOTENCY_KEY_REUSE)` if reused for a different room/command (see below) |

---

## Request Body

No request body is required (empty or null is accepted).

---

## Success Response — 200 OK

```json
{
  "commandType": "start-game",
  "roomId": "9c12df88-662c-47bc-8854-e0ad19a6d0ca",
  "idempotencyKey": "a32f10b5-78cc-4d82-b437-1202e2c3d599",
  "status": "ACCEPTED",
  "timestamp": "2026-06-28T14:30:10.123Z"
}
```

On success, the backend transitions the database representation of the room to `'in_progress'` state, which triggers connected polling clients to transition their UI dashboards to `/gameProgress`.

---

## Idempotent Replay Behaviour (FR-013, SC-005)

Every `Idempotency-Key` is durably recorded server-side (see `data-model.md`, `public.command_idempotency`) before the handler runs.

Only a **successful** start (`200 ACCEPTED`) is ever cached and replayed. A validation failure (any `422` below) is not a `CommandResult` the store can hold — the failed attempt's reservation is released immediately, so it is never replayed. This is intentional and matches FR-013, which only promises exactly-once/safe-replay for a *successful* start; validation is a pure, side-effect-free check, so simply re-running it on a fresh attempt with the same key is already safe and correct.

- **First request** with a given key: processed normally as above (success or a `422`).
- **Replay of a successful start** — a subsequent request with the **same** `Idempotency-Key`, same `roomId`, same command type, arriving *after* the first succeeded: the handler is **not** re-invoked. The command-api returns the exact same `200 OK` body, with the original `timestamp`.
- **Retry after a failed start** — a subsequent request with the same key/room/command after the first attempt *failed validation*: not a replay. The reservation was released, so this request is processed as a fresh attempt and validated from scratch (it may succeed or fail again, e.g. if the underlying config is still incomplete).
- **In-flight duplicate** — a subsequent request with the same key/room/command arriving *before* the first has finished (the literal "click Start Game twice under high latency" scenario): also **not** an error. The command-api holds the request briefly while it waits for the first request's outcome: if the first succeeds, this request returns that same success response; if the first fails validation instead, this request proceeds as a fresh attempt (see "Retry after a failed start" above). This — not the reuse conflict below — is what makes the "Concurrent start commands" edge case and FR-013 safe. In the rare case the first request never resolves (e.g. its process crashed mid-flight), the second request receives `503 SERVICE_UNAVAILABLE` after a short bounded wait, meaning "retry," not "this failed."
- **Key reuse across different rooms/commands** — the same `Idempotency-Key` value reused for a **different** `roomId` or command type: rejected with `409 Conflict` + `ApiError(IDEMPOTENCY_KEY_REUSE)`. Clients MUST generate a fresh UUID v4 per logical command attempt, not per session.
- **Genuinely concurrent starts of the same room with two different keys** (e.g. two devices racing): not deduplicated by the key store — both requests are distinct commands. The database `start_game_session` RPC's row lock (data-model.md) ensures only one succeeds; the loser receives `422 INVALID_ROOM_STATE`, same as starting an already-active room.

### Error Response Example (Idempotency Key Reuse)

```json
{
  "error": "IDEMPOTENCY_KEY_REUSE",
  "message": "This Idempotency-Key was already used for a different room or command.",
  "timestamp": "2026-06-28T14:31:00.000Z"
}
```

---

## Configuration Validation Errors

If the room configuration is incomplete or invalid, the command is rejected with a `422 UNPROCESSABLE_ENTITY` and a specific `error` code detailing which validation rule failed.

| HTTP Status | `error` code | Message / Cause |
|-------------|--------------|-----------------|
| 422 | `ROOM_NOT_FOUND` | The requested room does not exist in the system. |
| 422 | `INVALID_ROOM_STATE` | The room state is not in the `joinable` lobby cabin. |
| 422 | `EMPTY_PARTICIPANTS` | At least one valid participant must be in the room. |
| 422 | `EMPTY_MATCHES` | At least one match must be selected for the room. |
| 422 | `MISSING_COMMON_MATCH` | No common match is currently designated for the room. |
| 422 | `INVALID_COMMON_MATCH` | The common match designated is not in the selected matches pool. |
| 422 | `UNASSIGNED_PARTICIPANTS` | Every participant must have at least one assigned match (distinct from the common match). |

### Error Response Example (Unassigned Participant)

```json
{
  "error": "UNASSIGNED_PARTICIPANTS",
  "message": "Every participant must be assigned at least one match (excluding the common match).",
  "timestamp": "2026-06-28T14:31:00.000Z"
}
```
