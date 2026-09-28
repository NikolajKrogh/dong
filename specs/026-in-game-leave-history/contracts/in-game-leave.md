# In-Game Leave Contract

## Existing write paths

- Registered member: `leave_room_as_member(session_id)` retains its public signature and returns the existing `status: left` shape. In-progress leave sets `left_at`, inserts one `participant_left` event, and returns a captured result.
- Registered host: `leave_room_as_host(session_id, successor_participant_id)` retains its handover/close rules. Its in-progress `participant_left` event receives the same capture. A successor is required for the remaining players to continue.
- Guest: `leave_room_as_guest(guest_token)` remains behind trusted guest ingress. Confirmed in-progress leave also returns `result` (captured snapshot and departure time). A retry with the same unexpired bearer returns only that immutable result; all other guest room reads and writes remain denied. An expired or unknown bearer returns `already_invalid` with no room data.

## Read path

A registered account's provisional departure result is readable only when the event actor is that account's participant and the room has not completed. It is stable because it comes from the immutable event. Completed history remains the canonical finished result. The client deduplicates by session ID, preferring completed history.

## UI and failure behavior

`Game actions` exposes `Leave Game` only for active multiplayer participants. A confirmation explains that the person's current result will be saved and the game continues. Hosts see handover or close consequences. Cancel changes nothing. A failed or uncertain response keeps access state and shows a retryable error; guest pending-leave storage and retries remain in force.

Home and Setup remain navigation; End Game remains host-only completion. Lobby leave controls and behavior are unchanged.
