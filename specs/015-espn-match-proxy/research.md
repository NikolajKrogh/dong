# Research: ESPN Proxy and Normalized Match Endpoints

**Feature**: `specs/015-espn-match-proxy`  
**Date**: 2026-05-24  
**Status**: Complete — all planning unknowns resolved

## Decision Log

### 1. Public match-discovery endpoint and auth boundary

**Decision**: Expose a public `GET /v1/matches` endpoint with repeated `leagueCode` query parameters and an optional `requestedAt` ISO 8601 datetime-with-timezone query parameter.

**Rationale**: The current setup-game flow calls ESPN directly before any host authentication, so the replacement backend endpoint must remain available to unauthenticated web and native clients. Keeping the route under `/v1/` preserves the versioning strategy already established by the Java service, and a query-string GET keeps the operation read-only, cacheable, and easy to exercise from OpenAPI tooling.

**Alternatives considered**:
- Protect the endpoint behind the existing `/v1/**` authenticated rule: rejected because it would break the current pre-auth setup-game flow.
- Use `/v2/matches`: rejected because this is a new additive read surface, not a breaking version change.
- Use `POST /v1/matches/query`: rejected because the request is a pure read and does not need a body.

### 2. Supported league validation and league identity

**Decision**: The backend owns a configured allowlist of supported league codes, and each normalized match returns `league` as the league code. The Expo client continues to map code-to-display-name using the existing `LeagueEndpoint` catalog.

**Rationale**: League codes are the stable machine identifier already used by the app for ESPN lookups. Returning codes avoids duplicating display metadata in both Java and TypeScript, and it keeps the server contract language-agnostic while still allowing the client to render familiar league names.

**Alternatives considered**:
- Share `constants/leagues.ts` with Java: rejected because the command API cannot depend on TypeScript runtime assets.
- Return league display names from the backend: rejected because it duplicates client-owned presentation data and creates cross-language drift.
- Accept league names in the request: rejected because names are less stable and were explicitly clarified out of scope.

### 3. ESPN integration shape

**Decision**: Add a feature-local `match.espn.EspnClient` port and `RestClientEspnClient` adapter that reuse Spring `RestClient`, with server-side conversion from `requestedAt` to ESPN's `dates=yyyyMMdd` scoreboard query format.

**Rationale**: The repo already uses a `RestClient` adapter boundary for Supabase health checks. Reusing that pattern keeps the outbound client mockable in tests, avoids introducing another HTTP stack, and centralizes ESPN-specific URL formatting and timeout behavior in one place.

**Alternatives considered**:
- Use raw `java.net.http.HttpClient`: rejected because it diverges from the existing Spring Boot adapter pattern and adds more custom wiring to test.
- Reuse `SupabaseClient`: rejected because ESPN is a different external boundary with different error semantics.
- Push ESPN date formatting to the Expo client: rejected because normalization belongs at the backend seam and the client should stop caring about ESPN-specific query rules.

### 4. Repeated-request protection

**Decision**: Implement a custom in-memory TTL cache with canonical query keys and `CompletableFuture`-based in-flight request coalescing. Inject a `Clock` so default-date handling and cache expiry are deterministic in tests.

**Rationale**: The spec requires both short-lived reuse and suppression of identical in-flight fetches. A small feature-local cache service meets that need without adding a new caching dependency, and `Clock` injection keeps time-dependent behavior easy to unit test.

**Alternatives considered**:
- Spring's default concurrent-map cache: rejected because it does not provide TTL expiry or in-flight coalescing on its own.
- Add Caffeine: rejected as unnecessary dependency weight for a single endpoint at this stage.
- Throttling only: rejected because the clarified spec explicitly chose cached reuse plus coalescing.

### 5. Normalized response contract

**Decision**: Return a plain JSON array of flat `NormalizedMatch` records. Each record uses bounded normalized status values (`scheduled`, `live`, `final`, `postponed`, `canceled`), includes `league` as the league code, and omits ESPN-only nested structures and logo URLs.

**Rationale**: The clarified spec chose flat app-facing match objects rather than a metadata-heavy envelope. Normalizing status into a small enum reduces provider coupling, and omitting logo URLs keeps the backend focused on match discovery because league and team logo resolution already have dedicated client-side fallback paths.

**Alternatives considered**:
- Return a metadata envelope with timestamps or league names: rejected because the clarified spec chose the simpler flat contract.
- Mirror ESPN's nested competitions/competitors payload: rejected because it keeps clients coupled to the upstream provider.
- Include team and league logo URLs in the endpoint: rejected because it widens the contract beyond the accepted field set and duplicates existing client concerns.

### 6. Controlled error model for validation and upstream failures

**Decision**: Extend the existing enum-backed error model with match-specific codes: `INVALID_MATCH_DATE`, `UNSUPPORTED_LEAGUE_CODE`, `UPSTREAM_UNAVAILABLE`, and `UPSTREAM_BAD_RESPONSE`. Map malformed input to 400, malformed upstream payloads to 502, and upstream timeouts, 429s, or 5xx responses to 503.

**Rationale**: Specific machine-readable error codes make controller and integration tests clearer while still satisfying the requirement to hide raw upstream details. They also fit the current `ErrorCode` + `ApiException` + `GlobalExceptionHandler` pattern without introducing another error pathway.

**Alternatives considered**:
- Reuse only `BAD_REQUEST` and `SERVICE_UNAVAILABLE`: rejected because it makes validation and upstream failure scenarios harder to distinguish in tests and logs.
- Pass through ESPN status text or response bodies: rejected because the spec explicitly forbids raw upstream leakage.

### 7. Expo client adoption strategy

**Decision**: Keep `useMatchData` as the stable consumer-facing hook, add `utils/commandApiClient.ts` for `EXPO_PUBLIC_COMMAND_API_URL`, and map the backend's flat match list back into the existing `apiData`, `teamsData`, and `availableLeagues` shape expected by `MatchList`. When a calendar date is chosen in the UI, convert it to `${selectedDate}T00:00:00.000Z` before sending `requestedAt`.

**Rationale**: This is the smallest frontend change: existing screens keep the same hook surface and test setup, while the transport layer changes underneath. Using an explicit `EXPO_PUBLIC_COMMAND_API_URL` reference follows the repository's Expo env-var lint rule, and constructing the ISO datetime string directly preserves the selected calendar day without ESPN-specific client logic.

**Alternatives considered**:
- Replace `useMatchData` with a brand-new hook and update every consumer: rejected because it expands scope with no product benefit.
- Call the backend inline from `MatchList`: rejected because networking belongs in hooks/utilities, not components.
- Continue warming team or league logo caches from match discovery: rejected because the normalized contract intentionally excludes logo URLs and the app already has separate logo fallback paths.
