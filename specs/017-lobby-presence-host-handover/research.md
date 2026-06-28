# Research: Live Lobby Presence & Host Handover

**Feature**: 017-lobby-presence-host-handover · **Date**: 2026-06-21

Decisions resolving the unknowns in plan.md Technical Context. Each: Decision / Rationale / Alternatives.

---

## R1. Live updates: polling vs Supabase Realtime

- **Decision**: Reuse the existing **snapshot polling** pattern (the guest lobby already polls `get_guest_room_snapshot` in `hooks/useGuestRoomSession.ts`). The host/registered-member lobby polls a new authenticated `get_room_snapshot(session_id)`. **Unify all lobby polling on one shared interval of 4000 ms** (`LOBBY_POLL_INTERVAL_MS`), replacing the guest lobby's current 1 s cadence, so host/member/guest all behave identically and free-tier load is cut vs 1 s.
- **Rationale**: Polling already powers the only existing lobby, so behavior stays identical and code/tests are reused. It avoids a brand-new realtime-subscription + presence-channel layer (its own auth, reconnection, and test surface) for a feature whose correctness must not depend on transient connection state. Constitution IV lists Realtime as available, not mandatory; RPC polling is still Supabase-first. 4 s gives meaningful load reduction while remaining within the "few seconds" expectation.
- **Consequence / caveat**: There is **no online/away indicator** (FR-021) — the roster is membership only. Worst-case "time to notice" a change ≈ 4 s + round-trip, which can brush SC-001's 5 s @95th percentile; if observed, tighten the interval or relax SC-001 to ~6 s. Changing the guest cadence (1 s → 4 s) also means re-checking guest e2e timing.
- **Alternatives**: (a) Supabase Realtime postgres-changes/presence — lower latency + real online/away, but a larger architectural change touching both lobbies; recorded as a **future optimization**. (b) Keep guest at 1 s, new lobby at 3 s — rejected: two cadences (drift) for little gain. (c) 1 s everywhere — rejected: highest free-tier load for latency we don't need.

## R2. Roster & ownership source of truth (FR-021)

- **Decision**: Roster and host identity come **only** from durable rows (`game_sessions.owner_account_id`, `participants`), surfaced via the snapshot RPC. No connection-liveness signal is shown at all (no online/away).
- **Rationale**: A flaky connection must never remove a participant or change the host; ownership is server-authoritative. Without a presence channel (R1), there's no reliable liveness signal to show anyway, so the roster is membership-only.
- **Alternatives**: Building the roster from a realtime presence channel — rejected because disconnect would visibly drop participants and could be misread as "left," and it requires the Realtime layer R1 declined.

## R3. New terminal state `closed` and enum-add ordering

- **Decision**: Add `'closed'` to the `session_state` enum in its **own** migration (`031`), and only reference `'closed'::session_state` in later migrations (`032`, `033`).
- **Rationale**: `ALTER TYPE ... ADD VALUE` then using that value in the **same** transaction can raise *"unsafe use of new value"*; Supabase runs each migration file in one transaction. Splitting avoids it regardless of PG version. `closed` is distinct from `completed` so history (which filters `state='completed'`) ignores closed/expired rooms for free (FR-018/FR-025).
- **Alternatives**: (a) Reuse `completed` for closed rooms — rejected: pollutes history with never-played games and trips `chk_game_sessions_completed_state` (which requires `completed_at` semantics). (b) A separate boolean `is_closed` column — rejected: a lifecycle state belongs in the state enum the rest of the system already switches on.
- **Verification task**: confirm on the project's PG version that `031` (enum add, no literal use) and `032` (uses the literal) apply cleanly via `db:reset`.

## R4. Ownership handover mechanics

- **Decision**: Transfer = `UPDATE game_sessions SET owner_account_id = <successor account>` (the `025` `sync_session_owner_participant` trigger demotes the old owner participant → member and promotes the successor → owner), then `DELETE` the departing host's participant row. All inside one RPC transaction.
- **Rationale**: Reuses proven trigger logic instead of hand-rolling role flips; keeps exactly one `owner` row at all times. The `030`-fixed deferred `assert_session_owner_participant` trigger validates the invariant at commit.
- **Verification task**: confirm the `025` trigger **demotes before promoting** so `ux_participants_session_owner_role` (unique owner per session) is never momentarily violated; if not, perform the demote explicitly before the update. Test with `SET CONSTRAINTS ALL IMMEDIATE`.
- **Alternatives**: Manual `UPDATE participants SET session_role=...` for both rows — rejected: duplicates trigger behavior and risks a two-owner window.

## R5. Auto-vs-choose decision authority

- **Decision**: The RPC `leave_room_as_host(session_id, successor_participant_id DEFAULT NULL)` decides: 0 eligible → close; 1 eligible → auto-transfer; >1 and no `successor_participant_id` → `RAISE 'successor_required'`. The client, on `successor_required`, shows the chooser and re-calls with the chosen id; the RPC re-validates eligibility at that moment.
- **Rationale**: Server-authoritative and race-safe — the client's snapshot may be stale (a candidate may have just left). Re-validation at confirm handles the "successor disappears mid-choice" edge case.
- **Alternatives**: Client decides auto-vs-choose from its snapshot — rejected: races and trusts client state for a shared-state mutation (violates Constitution II).

## R6. Eligible successor definition

- **Decision**: Eligible = participants in the session with `membership_type='registered'`, `session_role='member'`, `account_id IS NOT NULL`, excluding the departing host.
- **Rationale**: Matches the schema rule that an owner must be a registered account; guests (`account_id NULL`) are structurally ineligible (`chk_participants_owner_role_consistency`).
- **Alternatives**: "Currently present (live)" eligibility — rejected: couples handover correctness to presence accuracy; membership is the durable, correct basis.

## R7. Registered-member join

- **Decision**: New `join_room_as_registered(join_code)` `SECURITY DEFINER` RPC, `authenticated`-only. Requires `auth.uid()`; rejects if room not `joinable`; inserts a participant (`membership_type='registered'`, `session_role='member'`, `account_id=auth.uid()`, display name from `accounts.preferred_display_name`); idempotent (returns the existing participant if already joined); returns the room snapshot.
- **Rationale**: No registered-join path existed (only guest-join). Authenticated users get account-based membership and become inheritance-eligible. Idempotency satisfies Constitution II replay-safety.
- **Alternatives**: Let signed-in users keep joining as guests — rejected by the user (makes handover unreachable). A generic "join" that branches on auth inside one RPC — rejected: anon guests and authenticated members have different identity/RLS handling; two clear RPCs are simpler.

## R8. Snapshot for authenticated members

- **Decision**: `get_room_snapshot(session_id)` (authenticated) guards on `private.can_access_session(session_id)` and returns `private.build_guest_room_snapshot(session_id)` (already includes `state`, participants with role + membership type).
- **Rationale**: Reuses the existing snapshot builder and access check; identical shape to the guest snapshot so the client roster code is shared. State in the snapshot lets clients detect `closed`/handover.
- **Alternatives**: Direct PostgREST selects from the client (RLS already allows owner/member SELECT) — viable but spreads roster-shaping logic into the client and diverges from the guest path; rejected for consistency.

## R9. Leaving removes the participant (presence accuracy)

- **Decision**: Leaving deletes the participant row so it disappears from every roster (FR-003). `leave_room_as_member(session_id)` for registered members; the host uses `leave_room_as_host` (handover/close). Guest "leave" is extended to remove the guest participant by token as well.
- **Rationale**: Today guest "leave" only clears the local grant; the row lingers, so others would still see them. Accurate presence requires removal.
- **Alternatives**: Soft "left_at" marker — more schema and filtering for no near-term benefit; rejected.

## R10. Activity tracking & expiry scheduler

- **Decision**: Add `game_sessions.last_activity_at timestamptz NOT NULL DEFAULT now()`, bumped by an `AFTER INSERT` trigger on `gameplay_events` (every join/leave/handover/gameplay action already writes an event, so one trigger covers all activity). `expire_stale_rooms()` closes rooms where `state IN ('joinable','in_progress') AND last_activity_at < now() - interval '24 hours'`, scheduled via **`pg_cron`** (~every 15 min). Index on `(state, last_activity_at)`.
- **Rationale**: Single trigger = uniform, cheap activity signal (event-backed, Constitution III). `pg_cron` is in-database, no extra infra.
- **Verification task**: confirm `pg_cron` is enabled on project `qccvlhblytuedgmlqfef` (`select * from pg_extension where extname='pg_cron'`; enable via `create extension`/dashboard if absent). **Fallback**: a scheduled Supabase Edge Function calling `expire_stale_rooms()`.
- **Alternatives**: Derive last activity from `max(gameplay_events.created_at)` at query time — rejected: not cheaply indexable for the sweep. Client-driven expiry — rejected: unreliable, not authoritative.

## R11. Migration drift on the hosted dev project

- **Decision**: New migrations `031–033` are sequential repo files. The hosted dev project history is known to be drift-numbered (timestamps for `026`+, missing repo `027`); applying via the Supabase MCP adds timestamped entries. Verify `031–033` apply against hosted after local `db:reset` passes.
- **Rationale**: Avoid a repeat of the `030` deferred-trigger surprise; validate the committed path on hosted (using `SET CONSTRAINTS ALL IMMEDIATE` in a rolled-back tx) before relying on it.
- **Alternatives**: Reconcile the full drift now — out of scope for this feature; tracked separately.

## R12. Testing deferred constraints (carryover from 016/030)

- **Decision**: Every pgTAP test that inserts/updates `game_sessions` or `participants` for handover/close/expiry MUST run `SET CONSTRAINTS ALL IMMEDIATE` after the mutation so the `DEFERRABLE INITIALLY DEFERRED` triggers (`assert_session_owner_participant`) actually fire inside the rollback-based test.
- **Rationale**: Plain `BEGIN/ROLLBACK` hid the `025`→`030` bug because deferred triggers only fire at commit. This is the highest-leverage test rule for this feature.
- **Alternatives**: Commit-then-cleanup tests — messier and pollutes shared DB; rejected in favor of forcing constraints.

## R13. One active room — scope and enforcement

- **Decision**: A signed-in user may be in at most one active room (owner or registered member), where active = `state NOT IN ('completed','closed')`. Enforced **server-side on both create and join**: `join_room_as_registered` and the (modified) `create_room_as_host` raise `already_in_active_room` (with the current session id) when the caller is already in one. A single `private.find_active_room_for(account)` helper backs the guard. The client catches the error and runs the easy-exit flow (R-handover/leave), then retries.
- **Rationale**: Makes the rule actually true (not bypassable via Create or a flaky client) and keeps the server as the single authority. The shared helper is DRY with R14 (resume).
- **Notes**: Guests are excluded (their device-local grant already models one session). The "active = not terminal" definition deliberately includes `in_progress` so it stays correct once #134 introduces it.
- **Alternatives**: Join-only / client-guard-only — rejected: Create still strands users in two rooms and a buggy client bypasses it.

## R14. Resume ("Return to room") for authenticated users

- **Decision**: On launch, look up the user's active room via the same `find_active_room_for` helper (exposed as `get_my_active_room`) and show a "Return to room" home card. No device-local pointer.
- **Rationale**: DB is authoritative for authenticated users; a server lookup is simpler and more correct than a local pointer, survives reinstall/new device, and reuses the R13 helper. The card disappears automatically when the room closes/expires.
- **Alternatives**: AsyncStorage pointer (mirrors guest grant) — device-local, can go stale; rejected for authenticated users.

## R15. Successor chooser re-resolution (race-safe)

- **Decision**: The chooser is fed by the live (~4 s) roster. On a stale pick (`successor_not_eligible`) or an empty list, the client re-calls `leave_room_as_host(session)` **with no successor** and lets the RPC re-decide (0 → close, 1 → auto, >1 → re-prompt). When the list collapses to 0 mid-choice, show a one-tap "everyone left — close the room?" confirm before closing.
- **Rationale**: Single brain in the RPC; the empty case naturally becomes the US3 closure with no special-case code. The confirm avoids surprising the host that "choose successor" turned into "close room."
- **Alternatives**: Client-side error + manual retry — strands the host on a stale list and re-implements decision logic in the UI.

## R16. Join code visibility (host-only) + guest-lobby ripple

- **Decision**: The numeric join code is rendered to the **host only**; registered members and guests see the room/roster without it.
- **Rationale**: User decision (Q15) — more controlled, and resharing isn't a real security boundary anyway, so this is a product choice rather than a security one.
- **Ripple**: The existing guest lobby (`components/guestJoin/GuestJoinLobby.tsx`) currently renders `Room {joinCode}` and the guest e2e asserts "Room ROOM42" is visible — both MUST change (show a non-code room header for non-hosts, update the assertion).
- **Alternatives**: Code visible to everyone — simpler/lower-friction; not chosen.
