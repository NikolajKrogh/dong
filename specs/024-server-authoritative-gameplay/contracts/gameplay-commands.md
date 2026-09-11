# Contract: Gameplay Commands

All mutation results include `sessionId`, `sequenceNumber`, `eventId`,
`replayed`, and the resulting canonical value.

## Manual score

```text
change_manual_score(session_id, match_id, team, delta_goals, idempotency_key)
change_manual_score_as_guest(guest_token, match_id, team, delta_goals, idempotency_key)
```

`team` is `home | away`; delta is `-1 | +1`. Result includes match ID and both
scores. Reject provider matches, inactive/foreign actors, ended rooms, invalid
deltas, negative results, and idempotency conflicts.

## Drink

```text
change_participant_drink(session_id, participant_id, delta_half_drinks, idempotency_key)
change_participant_drink_as_guest(guest_token, participant_id, delta_half_drinks, idempotency_key)
```

Delta is `-1 | +1`; result includes participant ID and decimal total. Actor and
target must be active in the same room; the result cannot be negative.

## Trusted provider observation

```text
POST /functions/v1/refresh-provider-scores
Authorization: Bearer <Supabase access token>
apikey: <Supabase publishable key>
Idempotency-Key: <UUIDv4>
Content-Type: application/json

{"sessionId":"<room UUID>"}
```

No score, provider identity, source match ID, league, participant/actor ID, or
observation timestamp is accepted from the client. `@supabase/server@1.5.2`
middleware validates the user token and the actor is taken only from JWT `sub`.
The function gateway has `verify_jwt = false` for publishable-key compatibility;
this does not make the endpoint anonymous. Only `OPTIONS` bypasses user auth.

The function uses its server-only credential to call:

```text
claim_provider_score_refresh(session_id, actor_account_id, request_id)
accept_provider_score_batch_from_edge(session_id, actor_account_id,
  request_id, observations)
```

Both public wrappers are `SECURITY INVOKER` and executable only by
`service_role`; private implementations are fixed-search-path
`SECURITY DEFINER`. PostgreSQL revalidates active registered membership, room
state, lease ownership, match membership, and canonical provider/source/league
identity before commit. Corrections may lower scores. An unchanged observation
returns current state without allocating an event.

The lease suppresses duplicate work for 60 seconds. Scoreboards are grouped by
stored league and UTC kickoff date, fetched from a server-side league allowlist
with at most four concurrent requests and a five-second timeout. Legacy rows
without league metadata search that allowlist and are accepted/backfilled only
when one exact event-ID candidate exists.

```ts
type ProviderRefreshResponse = {
  sessionId: string;
  requestId: string;
  status: "updated" | "partial" | "not_due";
  refreshedAt: string | null;
  results: Array<{
    matchId: string;
    sourceMatchId: string;
    provider: "espn";
    homeScore: number;
    awayScore: number;
    sequenceNumber: number;
    changed: boolean;
    replayed: boolean;
  }>;
  warnings: Array<{
    leagueCode?: string;
    code: "provider_unavailable" | "invalid_provider_response" | "match_not_found";
  }>;
};
```

Errors are `401` for missing/invalid/expired user auth, `403` for inactive or
foreign registered actors, `404` for a missing room, `409` for stale leases or
idempotency conflicts, `422` for invalid method/input/UUIDs, and `503` when all
required provider requests fail. Independent provider failures return `200`
with `partial` and commit only independently validated observations.

This is trusted server ingestion, not cryptographic provider attestation: ESPN
responses are authenticated only by HTTPS to the configured endpoint.

## Existing host-only commands

Reassignment uses migration 041's `reassign_participant_matches`; completion
uses the existing `end_game_session` path. Both remain pending in the UI until
canonical confirmation and serialize on the room row.

## Errors and security

Stable errors include `not_room_participant`, `participant_inactive`,
`target_inactive`, `invalid_room_state`, `manual_score_required`,
`provider_score_required`, `invalid_delta`, `negative_result`,
`idempotency_conflict`, `not_host`, `room_not_found`, and
`service_unavailable`.

Private implementations use `SECURITY DEFINER SET search_path = ''` with fully
qualified names. Revoke `PUBLIC`; grant wrappers only to intended roles. Add no
direct app-role table mutations. Never log or persist guest tokens/JWTs in
events. Authorize before disclosing an idempotent replay.

Function configuration is server-only: `SUPABASE_SERVICE_ROLE_KEY` (managed by
Supabase), `PROVIDER_SCORE_ALLOWED_ORIGINS`, optional
`PROVIDER_SCORE_ESPN_BASE_URL` for local mocked integration tests, and optional
`PROVIDER_SCORE_LEAGUES` to narrow the built-in allowlist. Never log credentials,
guest grants, or full provider payloads.
