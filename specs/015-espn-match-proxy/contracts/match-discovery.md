# Contract: Match Discovery

**Feature**: `specs/015-espn-match-proxy`  
**Version**: v1  
**Date**: 2026-05-24

## Endpoint

```text
GET /v1/matches
```

This endpoint is public. It does not require an `Authorization` header or an idempotency key.

---

## Query Parameters

| Parameter | Location | Type | Constraints |
|-----------|----------|------|-------------|
| `leagueCode` | Query (repeatable) | `String[]` | Required; at least one value; every value must be a supported league code |
| `requestedAt` | Query | `String` | Optional; must be a valid ISO 8601 datetime with timezone when present |

### Example request

```text
GET /v1/matches?leagueCode=eng.1&leagueCode=usa.1&requestedAt=2026-05-24T00:00:00.000Z
```

### Date resolution rules

1. If `requestedAt` is omitted, the backend defaults to today's date.
2. If `requestedAt` is present, the backend uses its calendar-date portion to derive the ESPN scoreboard `dates=yyyyMMdd` value.
3. Time-of-day is currently ignored after date resolution.

---

## Success Response — 200 OK

Returns a plain JSON array of flat normalized matches.

```json
[
  {
    "id": "401791345",
    "league": "eng.1",
    "homeTeam": "Arsenal",
    "awayTeam": "Chelsea",
    "startDateTime": "2026-05-24T19:00:00Z",
    "status": "scheduled",
    "score": {
      "home": 0,
      "away": 0
    },
    "venue": "Emirates Stadium"
  }
]
```

### Field semantics

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` | ESPN event identifier |
| `league` | `String` | Supported league code |
| `homeTeam` | `String` | Normalized home-team display name |
| `awayTeam` | `String` | Normalized away-team display name |
| `startDateTime` | `String` | ISO 8601 kickoff timestamp |
| `status` | `String` enum | `scheduled`, `live`, `final`, `postponed`, or `canceled` |
| `score` | Object (optional) | Included when upstream score data exists |
| `venue` | `String` (optional) | Included when upstream venue data exists |

### Empty result

A valid request with no matches returns:

```json
[]
```

### Repeated identical requests

Repeated identical requests for the same resolved date and league-code set may be served from the backend's in-memory cache for the configured TTL window (default `PT5M`). Cache reuse and in-flight coalescing do not change the response body shape or status codes.

---

## Error Responses

All failures share the existing `ApiError` envelope:

```json
{
  "error": "<ERROR_CODE>",
  "message": "<human-readable description>",
  "timestamp": "2026-05-24T12:34:56.789Z"
}
```

| HTTP Status | `error` code | Condition |
|-------------|-------------|-----------|
| 400 | `INVALID_MATCH_DATE` | `requestedAt` is present but not a valid ISO 8601 datetime with timezone |
| 400 | `UNSUPPORTED_LEAGUE_CODE` | One or more requested `leagueCode` values are not supported |
| 502 | `UPSTREAM_BAD_RESPONSE` | ESPN returned a payload that could not be normalized safely |
| 503 | `UPSTREAM_UNAVAILABLE` | ESPN timed out, rate-limited, or returned an unavailable upstream response |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

---

## Security and Versioning

- The endpoint is intentionally public to preserve the existing setup-game discovery flow.
- The route remains under `/v1/` to match the Java service's versioning policy.
- Future non-breaking additions may add optional fields, but the flat normalized fields above are the required baseline contract for this feature.
