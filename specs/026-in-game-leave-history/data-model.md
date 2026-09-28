# Data Model: In-Game Leave and Preserved History

## Participant

The existing participant row remains after departure. `left_at` changes from null to one server timestamp; `current_drink_total` and assignments stop changing for that participant. Lobby semantics stay separate.

## Departure event

The existing immutable `gameplay_events` row uses `event_type = participant_left`, actor participant ID, and a stable per-participant leave idempotency key. For an in-progress leave, `payload.historySnapshot` captures the room's played participants, scores, matches, assignments, and common match at the moment of departure. `payload.leftAt` is the server departure timestamp. The event is unique for the confirmed departure.

## Captured result

The result derives from the departure event. Registered accounts can read only a result whose event actor maps to their account. Guests receive the result through their confirmed leave response and save it locally under the canonical session ID. While the room is not completed, it is a provisional history row. Completed history with the same session ID supersedes it for registered accounts.

## Completed session

Host completion remains the only transition to `completed`. The canonical completed history includes all participant rows, including non-null `left_at`, and their frozen totals. Existing assignment snapshots include departed participants' assignments.

## State transitions

| Room | Participant | Leave result |
|---|---|---|
| `joinable` | active → departed | Existing lobby behavior; no played-result capture |
| `in_progress` | active → departed | One event with captured result; member/guest access ends |
| `in_progress` | departed → departed | No new event; retry-safe result |
| `in_progress` → `completed` | departed stays departed | Completed history supersedes provisional registered result |

Host transfer preserves the departing host row and result. A room with no eligible successor follows the existing close rule, which the in-game confirmation must explain.
