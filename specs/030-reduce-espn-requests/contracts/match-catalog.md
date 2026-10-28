# Match Catalog consumer contracts

**Version**: 1, proposed for implementation. JSON uses camelCase; SQL arguments use snake_case. Dates are calendar `YYYY-MM-DD`; instants are ISO-8601 UTC strings. Opaque catalog IDs are strings, never JavaScript bigint/numeric values. No raw ESPN payload is part of this interface.

## Application interface and transports

```typescript
type FootballMatchService = {
  discoverMatches(selection: MatchDiscoverySelection): Promise<MatchDiscoveryResult>;
  readSavedMatches(catalogMatchIds: SavedMatchId[], options?: { projection?: 'live' | 'history' }): Promise<SavedMatchesResult>;
  replaceSoloTracking(selection: SoloTrackingSelection): Promise<SoloTrackingGrant>;
};
```

| Operation | Transport | Permitted caller | Provider side effects |
| --- | --- | --- | --- |
| `discoverMatches` | POST `/functions/v1/discover-matches` | Existing public app access, bounded admission | May admit one shared cold/stale request per eligible resource, through the same claim/budget machinery. |
| `readSavedMatches` | POST `/rest/v1/rpc/read_saved_matches`, body `{ "catalog_match_ids": ["123"], "projection": "live" }`; projection defaults to `live` | `anon`/`authenticated` with public app key | None for either projection. No acquisition, demand renewal, budget reservation, or mutation. |
| `replaceSoloTracking` | POST `/functions/v1/solo-match-tracking` | Public app access plus existing opaque grant for replacements | Changes finite admitted demand. A worker may subsequently acquire due data; no arbitrary immediate/force fetch. |

The TypeScript adapter carries request cancellation through its owned transports without changing the three domain operations. Query keys use normalized league/date or catalog IDs, never room/private player state. A canceled UI request does not cancel already admitted shared work required by others. Client retries honor `retryAfterSeconds`, stay bounded, and cannot bypass provider policy.

Public ingress does not require a new account. A public app key is not a privileged monitoring credential. Enforce method/body limits, the supported allowlist, finite scopes, global capacity and admission counters server-side. Browser CORS includes the configured production origin and existing permitted development origins; error responses retain correct CORS. Worker credentials never appear in these requests.

## Saved match projection

A saved match contains `catalogMatchId`, a provider identity (`provider`, `leagueCode`, `sourceEventId`, separately nullable `sourceCompetitionId`), home/away team identity/name, `kickoffAt`/`kickoffValidity`, lifecycle/raw status, accepted gameplay score pair and distinct supported scoring contexts, period/current clock, season/venue when supplied, `observationVersion`, and freshness/availability. Preserve existing solo match controls with compact goal-display entries and the seven current home/away statistics already displayed: shot attempts, shots on goal, fouls, yellow cards, red cards, corner kicks and possession.

These display values come only from already saved valid supplied facts; reading them causes zero provider work and never enables live summary polling. Include known athlete display/team/clock/goal-type context with explicit partial/unavailable detail state. Return at most 100 compact goal entries per match and flag partial/remaining detail explicitly if more exist; never claim a complete play-by-play feed. Map retained domain metrics to existing `shotAttempts`, `shotsOnGoal`, `fouls`, `yellowCards`, `redCards`, `cornerKicks` and `possession` fields through a null-aware adapter. Existing statistics controls/types must handle unavailable values rather than converting missing values to zero.

Freshness has `lastAttemptAt`, `lastSuccessfulCheckAt`, `observedAt`, `isStale`, and a safe nullable availability reason. Provider occurrence time is attached only to supplied occurrence evidence; room sync time is not source freshness. A zero score is a known zero, not the default for unknown.

`readSavedMatches` returns:

```json
{
  "matches": [],
  "missingCatalogMatchIds": [],
  "availability": "available",
  "retryAfterSeconds": null
}
```

`matches` uses the saved projection above. Requested missing/evicted/unknown IDs are listed separately; empty input returns a successful empty result. The default `live` projection accepts at most 100 distinct IDs and preserves existing goal/stat controls without roster/wide-stat payloads. The `history` projection accepts at most 20 IDs and additionally returns already saved compact roster participation and selected current/final team statistics in `historyDetails`, with explicit availability/finality and partial/remaining-detail flags. Return at most 128 compact roster entries per match; a larger saved roster is explicitly partial, never silently complete. Both projections have a 256-KB response cap. Oversized batches produce `projection_too_large`, and the adapter splits IDs without acquisition. Neither projection fetches missing source details or renews tracking. This feature adds no new stats/history screen.

`historyDetails` names are `rosterEntries`, `teamStats` (home/away sets), `availability`, nullable `isFinal`, and `hasMoreRosterEntries`. Missing held detail is null, distinct from an established empty collection. `availability` uses the existing result vocabulary; pending/deferred describes already admitted optional work, never work created by this read. A truncation flag does not change the complete retained server data or claim complete local capture.

On solo completion, capture available compact detail as self-contained values/display names in the existing private local history record, not merely provider/catalog foreign keys and never bearer grant tokens. One saved-history read may obtain held roster/final metrics; a normal later foreground/history access may add newly available saved detail without altering completed gameplay outcomes. Do not create detail polling or upload local history. Source-cache eviction cannot delete captured local values. Uncaptured detail may be unavailable after expiry and is not reconstructed by provider fetch. Server retention protection uses multiplayer references, not permanent anonymous solo pins.

Reading old completed data does not restart monitoring. A stale saved match remains in `matches` with its real last-success time. An unavailable source does not make a previously accepted saved record disappear.

## `discoverMatches`

Request:

```json
{
  "leagueCodes": ["eng.1", "esp.1"],
  "date": "2026-10-25"
}
```

Trim, deduplicate and deterministically sort supported case-sensitive league codes. Accept at most 16 codes and one valid date within seven days either side of today UTC. Maintained callers chunk larger configured league sets and merge per-league results. Invalid/unsupported codes are explicit validation errors, not fallback searches. Empty input returns an empty result with zero source work. No caller-supplied provider URL, transport options, budget, cadence or force-refresh flag is accepted.

Response:

```json
{
  "matches": [],
  "availability": "partial",
  "groups": [
    {
      "leagueCode": "eng.1",
      "date": "2026-10-25",
      "availability": "available",
      "lastSuccessfulCheckAt": "2026-10-25T12:00:00Z",
      "isStale": false,
      "reason": null,
      "retryAfterSeconds": null
    },
    {
      "leagueCode": "esp.1",
      "date": "2026-10-25",
      "availability": "pending",
      "lastSuccessfulCheckAt": null,
      "isStale": true,
      "reason": "acquisition_pending",
      "retryAfterSeconds": 15
    }
  ]
}
```

This example illustrates a valid empty saved league alongside pending cold data; it is not an error disguised as `[]`. `matches` are saved match projections for supplied groups. Each group independently reports `available | partial | pending | unavailable | deferred`; response availability is the aggregate. Successfully empty boards are cached. Saved results can accompany a failure reason and stale flag.

A request can synchronously serve cached results or perform bounded admitted cold work through the common implementation, then return pending groups rather than exceeding its deadline. Any synchronous acquisition claims one of the same global worker slots and respects live-slot lookahead; public handlers cannot become extra acquisition workers. Simultaneous discovery/worker calls share claims. The two-minute cold-demand expiry is not an endlessly renewed background timer; bounded repeated explicit requests remain subject to freshness/admission. Live groups use live freshness, other discovery five minutes. A denied/throttled request does not enqueue further work.

After a pending response, the maintained client may make at most two automatic follow-up discovery requests, spaced at least 15 seconds and no earlier than the advertised retry time, then shows saved/partial results with explicit user refresh. Ordinary route rerenders cannot restart a rapid retry loop. User refresh uses the same policy and never a direct provider fallback.

## `replaceSoloTracking`

Create a finite selection:

```json
{
  "operationId": "00000000-0000-4000-8000-000000000001",
  "creationNonce": "<32 cryptographically random bytes, base64url encoded>",
  "catalogMatchIds": ["123", "456"]
}
```

Replace or clear an existing selection:

```json
{
  "operationId": "00000000-0000-4000-8000-000000000002",
  "grantToken": "<opaque server-issued capability>",
  "expectedSelectionVersion": 1,
  "catalogMatchIds": []
}
```

The operations are mutually exclusive: creation uses a recovery nonce; replacement uses the grant and expected version. Empty replacement ends active demand. Creation with an empty selection is rejected to avoid useless grant allocation. Maximum 20 validated existing IDs; finite eligibility/horizon rules are in [research.md](../research.md). Missing identity, inadmissible horizons and capacity rejection cannot trigger discovery sweeps. IDs outside the caller's grant cannot be changed merely by naming another grant ID.

Response:

```json
{
  "grantToken": "<opaque capability; never logged>",
  "selectionVersion": 2,
  "isReplay": false,
  "catalogMatchIds": [],
  "expiresAt": "2026-10-26T18:00:00Z",
  "state": "ended"
}
```

The grant is authority to replace/clear its own public-match tracking, not a room token, participant identity, notification subscription or provider budget bypass. Keep it separate from exported/history solo content. Do not include private players/assignments in this transport. Saved-fact reads cannot renew it.

For creation retries, derive the server-issued 256-bit token with WebCrypto HMAC-SHA256 over a domain-separated, unambiguous encoding of the server-generated grant issuance UUID and client creation nonce. Persist the issuance UUID, nonce/grant digests, key ID and immutable creation request digest; never plaintext tokens/nonces. Concurrent identical creation requests resolve to one issuance. While that record is unexpired, reconstruct the same token from its stored issuance/key and supplied nonce; changed content conflicts. A retry after replacements returns current selection/version and never restores the original selection. Missing required signing material fails closed rather than substituting a new key for that issuance.

An expired record returns `tracking_expired` and cannot recover/renew its authority. Ended, unexpired records can replay their ended result without renewing demand. After expired metadata is purged, any permitted creation is a fresh admission: allocate a new server issuance UUID/token, apply creation/capacity limits, and return `isReplay: false`; an older token MUST remain invalid even if the nonce is reused. Migrated clients use a fresh nonce/operation for intentional new admission. Do not keep permanent tombstones or reuse an expired issuance. Current/retiring signing keys support only the remaining unexpired issuances, then retire explicitly.

For replacement, atomically compare selection version. An identical latest operation UUID/body returns the prior successful result with `isReplay: true` and no new admission; a changed body under the same UUID is rejected. Fresh successful creation/replacement returns `isReplay: false`. A stale earlier operation/version conflicts instead of undoing a more recent selection. New operation IDs do not bypass per-grant/global admission limits. Ended grants remain recognizable until expiry so clearing can be retried. No old token is accepted after expiry or after a different issuance replaces purged state.

## Errors and availability

Error envelope: `{ "ok": false, "code": "<safe code>", "retryAfterSeconds": null }`. Never expose provider bodies, upstream URLs/headers, tokens, SQL internals or private room content.

| HTTP/result | Meaning |
| --- | --- |
| 200 structured saved/pending/partial/deferred result | Normal source availability outcome; may include saved data. Source absence is not automatically a transport error. |
| 400 `invalid_selection`, `unsupported_league`, `date_out_of_range`, `projection_too_large` | Invalid/oversized bounded input or result; no work admitted. Saved-read batches may be split deterministically. |
| 401/403 `invalid_tracking_grant`, `tracking_expired`, `not_permitted` | Invalid authority; does not reveal another grant's existence. |
| 409 `operation_conflict`, `tracking_conflict`, `identity_unresolved` | Stale operation/version or ambiguous mapping; no unsafe mutation. |
| 429 `admission_limited` | Public/grant/global request admission limit; retry time explicit. |
| 503 `capacity_limited`, `configuration_required`, `acquisition_paused` | Persistent new demand cannot be safely admitted; saved reads remain available. |

Provider budget/cooldown on discovery normally yields structured deferred groups (`budget_exhausted`, `provider_cooldown`, `provider_unavailable`, `provider_access_rejected`, `invalid_provider_response`, `match_not_found`) with saved data. Do not expose these as permission to shorten retry time. Grant admission cannot report success if no finite tracking was established.

## Existing clients and gameplay contracts

Java `GET /v1/matches` retains repeated `leagueCode`, optional offset-aware `requestedAt`, and its existing normalized array/error shape. It calls bounded public catalog discovery with the public app key; it does not reuse host-JWT-only command transport or retain an ESPN fallback/cache policy. Preserve current status projection and source event IDs. New pending/partial outcomes map to valid available arrays only when data is actually available; wholly unavailable cold work returns a controlled retryable error, not a false empty match day.

Registered `get_room_snapshot` and protected guest-room reads retain their access/identity contracts. The old `refresh-provider-scores` route remains registered-member authorized temporarily and may return a compatible `not_due`/saved-replay response. It never performs provider HTTP or advances source freshness merely because a client called it.

Maintained solo clients map saved facts back to current local source match IDs and apply existing local idempotent consequences. Existing local history is not uploaded. Client generation/cancellation guards prevent older selections overwriting newer ones. Stale direct-ESPN app bundles cannot be fenced by these server contracts; adoption limits are explicit in the rollout contract.
## League metadata

League codes, names, categories and initial defaults are bundled from `constants/leagueCatalog.json`. The frontend and ESPN transport use the same versioned catalog; database migration snapshots are checked against it in CI. No runtime metadata RPC or metadata loading/cache state is required. Defaults exist synchronously on first launch and explicit reset. Saved preferences, including empty selections, remain intact. Postgres retains stable identities, names and the discovery admission guard; disabling new discovery does not invalidate saved matches or tracking. Catalog changes are deliberate coordinated releases.

