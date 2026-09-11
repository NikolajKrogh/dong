# Data Model: Server-Authoritative Multiplayer Gameplay

## Existing canonical rows

- `game_sessions`: aggregate ID, state, current owner, and monotonic
  `last_event_sequence`; lock this row for every gameplay mutation.
- `participants`: registered/guest identity and membership; existing
  `current_drink_total numeric(6,1)` remains materialized truth. Departed rows
  remain for history but cannot mutate.
- `matches`: existing home/away scores become canonical. Provider/source fields
  and nullable `source_league_code` determine manual versus provider control and
  the bounded scoreboard lookup.
- `private.provider_score_refresh_leases`: one request UUID and `not_before` per
  room, deleted with the room; only `service_role` can read or mutate it.
- `assignments` and `assignment_snapshots`: current map and #186 timeline; score
  or drink commands never rewrite them.

## Event extension

Extend `gameplay_events` without a second event table:

| Event type | Actor | Payload |
|---|---|---|
| `manual_score_changed` | active participant | match/team, delta, previous/resulting score, `origin: manual` |
| `drink_changed` | active participant | target participant, half-unit delta, previous/resulting total |
| `provider_score_changed` | active registered refresh requester | match, previous/resulting pair, provider/source ID, `origin: provider` |

Every event keeps its room, unique sequence, non-null actor, idempotency UUID,
immutable payload, and timestamp. The request fingerprint includes command,
session, actor, target, and delta/observation. Same key and fingerprint returns
the original result; changed intent raises `idempotency_conflict`.

Direct-RPC replay data lives in `gameplay_command_results`; deterministic
per-match UUIDs derived from the Edge request and canonical match IDs reuse that
same authorization-before-replay mechanism.

## Canonical snapshot

Return `sessionId`, state, `ownerParticipantId`, `lastEventSequence`, active and
retained participants with drink totals, matches with scores/provider identity,
assignments, and assignment plan. Clients reject snapshots below their last
applied sequence.

## Client-only state

`ActiveGameContext` distinguishes `solo | multiplayer` and retains session,
participant, access kind, and last sequence. Guest secrets stay in the existing
guest grant. `PendingGameplayMutation` holds an ephemeral request UUID, target,
and optimistic delta; it is never auto-replayed after restart.

## Invariants

1. Mutations require `in_progress` and active membership.
2. Only manual matches accept participant score deltas.
3. Scores and drink totals never become negative.
4. Row update and one ordered event commit atomically.
5. Provider corrections may decrease; unchanged observations create no event.
6. Completion serializes with and freezes gameplay.
7. Existing completed records receive no synthetic backfill.
8. Provider leases and batch acceptance are executable only by `service_role`;
   authenticated and anonymous clients have no direct provider mutation RPC.

## Migration, retention, and recovery

Migration `042_server_authoritative_gameplay.sql` adds functions, event
validation, snapshot fields, grants, and RLS-facing wrappers without rewriting
completed data. Retain events and assignment snapshots for the completed
record's lifetime. Verify reconstruction from ordered events in pgTAP. Rollback
uses a forward compensating migration that revokes new RPCs and restores the old
snapshot function; it never deletes accepted events.
