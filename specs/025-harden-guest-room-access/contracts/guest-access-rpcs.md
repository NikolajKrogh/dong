# Guest Access RPC Contract (planned)

All calls use POST RPC bodies over HTTPS. No guest bearer is sent as a URL/query parameter or stored in diagnostics. Public wrappers use narrow `EXECUTE` grants; private helpers/tables are not exposed. Wire names below follow current snake_case RPCs. New `grantExpiresAt` is ISO 8601 UTC; actual SQL response shape should preserve existing success fields during rollout.

## Join `public.join_room_as_guest(join_code, guest_name, guest_token)`

- Request: normalized code/name, fresh 32-byte hex token; retry uses exactly the same token.
- Admission: caller and code quota, then global token binding, room joinability, then participant insert under room lock. A token already bound to another room is denied. Same token/same room returns same participant and no second `participant_joined` event.
- Success: existing `{participantId, sessionId, guestToken, joinCode, displayName, snapshot}` plus `grantExpiresAt`. Do not echo token anywhere except this confidential success response, and do not persist it in an event.
- Failure envelope: `{ok:false, code:'room_unavailable'|'rate_limited'|'invalid_request', retryAfterSeconds?}`; unknown/closed/in-progress code gets `room_unavailable`. No room metadata in failure.

## Snapshot `public.get_guest_room_snapshot(guest_token)`

- Admission: caller/token quotas; shared current-hash, unexpired, not-left, room-state validation. Valid grant reads at 1 Hz must fit configured quota. Invalid tokens use stricter quotas.
- Success: existing snapshot fields plus grant-expiry metadata in a compatible location. Host completion revokes every guest grant, so completed and closed rooms yield no guest snapshot. The completed history remains available through the existing registered-user authorization rules.
- Failure envelope: `{ok:false, code:'guest_access_lost'|'rate_limited', retryAfterSeconds?}`. No distinction among unknown/expired/replaced/revoked to unauthenticated callers.
- Existing `STABLE` snapshot wrapper becomes `VOLATILE` because quota accounting writes. Test PostgREST schema cache/reload after migration.

## Rotate `public.rotate_guest_room_grant(old_token, new_token, operation_id)` (new)

- Request: pending new 32-byte token and UUID operation ID saved locally before call. Both hashes must be different; validate length/format without leaking them.
- Success: `{ok:true, participantId, grantExpiresAt, replayed}`; server never echoes new token. Update current hash and expiry atomically. Prior hash ceases to authorize any room read/write immediately.
- Retry: if old hash + operation ID + proposed new hash match the bounded previous-rotation record, return same confirmation without a second rotation. Different proposed token/ID is denied. After retry window, old hash is denied.
- Denial: `guest_access_lost`, `room_unavailable` for terminal state, or `rate_limited` if admission quota applies. Rotation is allowed only in joinable/in-progress room.

## Leave `public.leave_room_as_guest(guest_token)`

- Response: `{ok:true,status:'confirmed'|'already_invalid'}` only if server revoked access or it was already expired/closed/left. A confirmed joinable or in-progress leave updates `left_at` once and appends one `participant_left` event. Host completion revokes every guest grant; a leave retried after completion is already invalid. A transport failure is **not** a confirmed response and leaves a pending local retry record.
- All current and copied bearer instances stop authorizing immediately after confirmed leave. Client stops its polling, shows pending/failed state accurately, and retries when connectivity returns.

## Roster and assignment semantics

The shared snapshot returns activeRoster, derived from participants not marked
left whose membership is registered or whose guest grant hash is current and
unexpired by server time. A private, non-client-callable helper defines this
eligibility rule and is reused by the database consumers. Hosts and guests
receive the same projection. The
existing participants array remains unchanged for compatibility and
game/history hydration; do not substitute activeRoster into started-game state.

While the room is joinable, assignmentPlan.participantCount, host allocations,
and start_game_session use the same active-eligibility predicate. The start RPC
rechecks under its existing room lock. Attempting to allocate a guest omitted
from activeRoster is rejected; a stale assignment or pick cannot make that
guest eligible.

Grant expiry is derived, not an automatic leave: it does not set left_at, emit
participant_left, delete records, or change quota windows. Once the game has
started, expiry denies the guest grant but leaves settled participants,
assignments, scores, and events unchanged.

## Guest lobby and gameplay commands

`public.set_my_room_picks_as_guest`, `public.change_manual_score_as_guest`, and `public.change_participant_drink_as_guest` (verify every actual signature in migration) call shared resolver and preserve existing command/event idempotency. No client-supplied room or participant ID can redirect scope. Completed/closed rooms reject all mutations; in-progress commands retain existing role and target rules. Replaced/expired/left credentials reject consistently. Preserve authenticated host/member RPC paths unchanged.

## Security test matrix

For every guest-facing operation test current/expired/replaced/left/unknown/cross-room token, joinable/in-progress/completed/closed room, and anon/authenticated invokers. Explicitly test direct `private.*` and table access denied to anon/authenticated, no old function overload bypass, and no raw bearer/code in event payloads, diagnostic traces, or client URLs. Quota tests include concurrent bursts, shared-IP legitimate guests, invalid token spray, response-loss retry, and hosted forwarding-header spoof attempts.

## Friendly termination outcome

After existing quotas, snapshot returns exactly { "ok": false, "code": "room_ended" } for the current token of a guest valid at host completion/closure. No room data or authorization is returned. Unknown, replaced, previously expired and left tokens retain generic denial. Direct API-role execution remains revoked; existing trusted ingress forwards the envelope. A nullable guest_revocation_reason on the participant uses the existing current token hash; no new bearer, receipt or backfill. History and quotas remain intact.
