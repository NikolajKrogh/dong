# Quickstart: ESPN Proxy and Normalized Match Endpoints

**Feature**: `specs/015-espn-match-proxy`  
**Date**: 2026-05-24

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 17 LTS | Required for `command-api` |
| Node.js | Current repo-supported version | Required for Expo + Jest |
| npm | Current | Required for repo scripts |
| Supabase CLI | Optional but recommended | Reuses the local auth config already needed by `command-api` |

---

## Environment Variables

### Command API session environment

Set these before starting the Spring Boot service:

```powershell
$env:SUPABASE_JWT_SECRET = "<your-jwt-secret>"
$env:SUPABASE_URL = "http://127.0.0.1:54321"
```

Optional feature-specific overrides:

```powershell
$env:COMMAND_API_MATCH_DISCOVERY_TTL = "PT5M"
$env:COMMAND_API_MATCH_DISCOVERY_ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer"
```

### Expo app `.env.local`

Add the command API base URL alongside the existing Supabase vars:

```env
EXPO_PUBLIC_COMMAND_API_URL=http://localhost:8080
```

Restart Expo after editing `.env.local` so the `EXPO_PUBLIC_*` values are bundled.

---

## Start the Command API

```powershell
cd command-api
.\mvnw.cmd spring-boot:run
```

Expected local base URL: `http://localhost:8080`

---

## Verify the Match Endpoint

Example request with an explicit date:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:8080/v1/matches?leagueCode=eng.1&leagueCode=usa.1&requestedAt=2026-05-24T00:00:00.000Z"
```

Expected success shape:

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

Example request relying on the default current date:

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/v1/matches?leagueCode=eng.1"
```

Expected behavior: the backend resolves today's date and returns either a match list or an empty JSON array `[]`.

Repeated-query cache check:

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/v1/matches?leagueCode=eng.1&requestedAt=2026-05-25T00:00:00.000Z"
Invoke-RestMethod -Uri "http://localhost:8080/v1/matches?leagueCode=eng.1&requestedAt=2026-05-25T00:00:00.000Z"
```

Expected behavior: both responses stay identical, and the second request is served from the in-memory cache while the configured `PT5M` window remains valid.

---

## Start the Expo App

From the repo root:

```powershell
npm install
npm run web
```

Or use the platform-specific Expo command you normally use.

Manual smoke flow:

1. Open the setup-game flow.
2. Choose one or more supported leagues.
3. Pick a date or leave the default.
4. Confirm matches load successfully through the backend.
5. If testing on web, verify the browser no longer makes direct ESPN scoreboard requests during match discovery.

---

## Focused Automated Validation

### Backend tests

```powershell
cd command-api
$env:SUPABASE_JWT_SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long"
$env:SUPABASE_URL = "http://localhost:9"
.\mvnw.cmd --% -Dtest=MatchNormalizationTest,MatchDiscoveryServiceTest,MatchCacheServiceTest,MatchDiscoveryControllerTest,MatchDiscoveryPerformanceTest test
```

Target additions for this feature:

- `MatchDiscoveryControllerTest`
- `MatchDiscoveryServiceTest`
- `MatchCacheServiceTest`
- `MatchNormalizationTest`
- `MatchDiscoveryPerformanceTest`

### Expo regression tests

From the repo root:

```powershell
npx jest __tests__/hooks/useMatchData.test.tsx __tests__/components/setupGame/MatchList.platform.test.tsx --runInBand --watch=false
```

These tests should prove that:

- `useMatchData` calls the command API instead of ESPN directly.
- The hook still returns the shape expected by `MatchList`.
- Error and empty-state handling remain stable for the existing setup-game UI.
- Repeated identical backend requests remain responsive after the cache warms.

---

## Notes

- This feature does not change live-score polling; `useLiveScores` continues to use ESPN directly until a separate issue moves that path behind the backend.
- Team and league logos are not part of the normalized match-discovery contract. Existing client fallback paths (`useLeagueLogo`, `getTeamLogoWithFallback`, persisted logo cache) remain in place.
- Raw network failures are normalized to a client-safe "Match discovery is temporarily unavailable." message instead of leaking fetch-layer details into the setup-game flow.
