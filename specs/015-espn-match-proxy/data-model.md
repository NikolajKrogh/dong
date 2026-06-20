# Data Model: ESPN Proxy and Normalized Match Endpoints

**Feature**: `specs/015-espn-match-proxy`  
**Date**: 2026-05-24

## Overview

This feature adds a public, read-only match-discovery surface to `command-api/`. It introduces no database tables, migrations, or RLS changes. All entities below are request/response or in-memory coordination structures owned by the Spring Boot service and the existing Expo client adapter.

---

## Request / Query Entities

### MatchDiscoveryRequest (wire-in query)

Represents the query-string shape accepted by `GET /v1/matches`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `requestedAt` | `String` (optional) | Must be a valid ISO 8601 datetime with timezone when present | If omitted, the backend defaults to today's date |
| `leagueCode` | repeated `String` query param | At least one value required; every value must be in the supported league allowlist | Duplicates are removed during canonicalization |

**Normalization rule**: `requestedAt` is parsed to an `OffsetDateTime`, but only the calendar-date portion is used to derive the ESPN scoreboard date. Time-of-day is not currently meaningful to upstream lookups.

---

### MatchQuery (internal canonical query)

Canonical internal representation built after validation and used for caching and outbound ESPN calls.

| Field | Type | Notes |
|-------|------|-------|
| `resolvedDate` | `LocalDate` | Parsed from `requestedAt`, or `LocalDate.now(clock)` when omitted |
| `leagueCodes` | `List<String>` | Deduplicated, sorted, and validated against the allowlist |
| `cacheKey` | `String` | Stable key built from `resolvedDate` + sorted `leagueCodes` |

---

### SupportedLeagueCode (internal config entry)

Represents one backend-supported league code in `MatchDiscoveryProperties`.

| Field | Type | Notes |
|-------|------|-------|
| `code` | `String` | Stable league identifier (for example `eng.1`, `usa.1`) |

**Note**: Display names and categories remain client-owned presentation data in the Expo app.

---

## Response Entities

### NormalizedMatch (wire out)

Flat app-facing match record returned by the backend.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `String` | Non-empty | ESPN event id |
| `league` | `String` | Must be a supported league code | Returned as the same machine-readable code accepted by the request |
| `homeTeam` | `String` | Non-empty when the match is included | Normalized from ESPN competitors or fallback event naming |
| `awayTeam` | `String` | Non-empty when the match is included | Normalized from ESPN competitors or fallback event naming |
| `startDateTime` | `String` | ISO 8601 datetime | Carries the upstream kickoff timestamp |
| `status` | `MatchStatus` | One of the bounded values below | Stable across leagues and upstream variations |
| `score` | `MatchScore` (optional) | Present when upstream score data exists | Omitted for matches with no score data |
| `venue` | `String` (optional) | Free text | Omitted when ESPN does not provide venue data |

### MatchScore (wire out sub-object)

| Field | Type | Notes |
|-------|------|-------|
| `home` | `int` | Home-team goals from upstream scoreboard data |
| `away` | `int` | Away-team goals from upstream scoreboard data |

### MatchStatus (wire enum)

| Value | Meaning |
|-------|---------|
| `scheduled` | Match has not started yet |
| `live` | Match is currently in progress |
| `final` | Match has completed |
| `postponed` | Match is delayed or postponed |
| `canceled` | Match was canceled/abandoned and should not be treated as playable |

### MatchCollectionResponse (wire out)

The endpoint returns a plain JSON array of `NormalizedMatch` values. No metadata wrapper is added for this feature.

---

## Coordination / Cache Entities

### MatchCacheEntry (internal)

Stores a short-lived in-memory cached result.

| Field | Type | Notes |
|-------|------|-------|
| `matches` | `List<NormalizedMatch>` | Cached normalized response body |
| `cachedAt` | `Instant` | Time the response was stored |
| `expiresAt` | `Instant` | TTL boundary after which a refetch is required |

### InFlightMatchRequest (internal)

Tracks a single active upstream fetch so identical requests can coalesce.

| Field | Type | Notes |
|-------|------|-------|
| `cacheKey` | `String` | Same canonical key used by cache lookup |
| `future` | `CompletableFuture<List<NormalizedMatch>>` | Shared promise for callers waiting on the same upstream fetch |

---

## Controlled Error Surface

All errors reuse the existing `ApiError` wire shape.

| Error code | HTTP | Condition |
|------------|------|-----------|
| `INVALID_MATCH_DATE` | 400 | `requestedAt` is present but not a valid ISO 8601 datetime with timezone |
| `UNSUPPORTED_LEAGUE_CODE` | 400 | One or more `leagueCode` values are not in the backend allowlist |
| `UPSTREAM_BAD_RESPONSE` | 502 | ESPN returns a payload that cannot be normalized safely |
| `UPSTREAM_UNAVAILABLE` | 503 | ESPN times out, rate-limits, or returns an unavailable/5xx response |
| `INTERNAL_ERROR` | 500 | Any unhandled server error |

---

## No Persisted Data Changes

This feature introduces **no** new database schema, **no** AsyncStorage migrations, **no** Supabase migrations, and **no** RLS changes. The cache is intentionally in-memory only and does not survive service restarts.
