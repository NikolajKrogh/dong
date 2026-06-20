# Implementation Plan: ESPN Proxy and Normalized Match Endpoints

**Branch**: `152-espn-match-proxy` | **Date**: 2026-05-24 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/015-espn-match-proxy/spec.md`

## Summary

Add a public `GET /v1/matches` endpoint to `command-api/` that proxies ESPN scoreboard requests for supported league codes, normalizes the upstream payload into flat app-facing match objects, and shields ESPN with short-lived in-memory caching plus in-flight request coalescing. On the Expo side, replace direct ESPN discovery in `useMatchData` with an env-configured command API client while preserving the existing `MatchList` data contract and adding a focused hook regression test.

## Technical Context

**Language/Version**: Java 17 / Spring Boot 3.3.5 for `command-api` + TypeScript 5.3.3 / Expo SDK 52 for the client hook migration  
**Primary Dependencies**: Spring Boot 3.3.5 (web, security, validation, actuator), springdoc-openapi 2.6.0, JJWT 0.12.6, existing Spring `RestClient`, React 18.3.1, Expo Router 4, Zustand 5, AsyncStorage, `react-test-renderer`  
**Storage**: N/A for backend persistence; in-memory TTL cache only with a default PT5M window configurable via `COMMAND_API_MATCH_DISCOVERY_TTL`; existing AsyncStorage state/logo caches remain unchanged  
**Testing**: JUnit 5 + Mockito + Spring Boot integration tests for `command-api`, including a focused latency validation for `GET /v1/matches`; Jest-Expo hook/component regression for the client-facing `useMatchData` adapter  
**Applicable Skills**: `java-springboot`, `openapi-to-application-code`, `react-native-testing` — loaded and followed for this plan  
**Target Platform**: JVM web-service (Linux CI, Windows local dev) + Expo native/web clients  
**Project Type**: Monorepo feature spanning a Spring Boot web-service and an Expo/React Native consumer integration  
**Performance Goals**: <2s p95 successful match discovery for supported queries under normal load; redundant identical queries suppressed during the configured default PT5M TTL window  
**Constraints**: No client-side ESPN calls for match discovery; no raw upstream details in error responses; public read access must preserve the existing unauthenticated setup-game flow; Expo public env vars must be read with explicit `process.env.EXPO_PUBLIC_*` references; no new persisted storage or schema changes  
**Scale/Scope**: Current supported league-code catalog only; one public match-discovery endpoint; one client hook migration; command-api module plus a small Expo client adapter

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Cross-Platform First**: Pass. Web and native clients both move to the same backend discovery endpoint through `useMatchData`; no platform-specific behavior is introduced beyond environment-based API host configuration.
- **Server-Authoritative Shared State**: Pass. This feature is read-only and request-scoped; it does not introduce shared-state writes, new command paths, or multiplayer mutations.
- **Event-Backed Game History**: Pass. No gameplay history schema or immutable event storage is affected.
- **Supabase-First, Custom Backend by Exception**: Pass. The Java backend is already established in issue #132, and this feature fits the explicit exception case for external integration plus secrets handling by moving ESPN access off the client.
- **Story-First Delivery With Required Coverage**: Pass. The spec remains sliced into three independently testable stories, with backend unit/integration coverage and one narrow client regression test instead of broad UI E2E.
- **Skill-First AI Execution**: Pass. `java-springboot`, `openapi-to-application-code`, and `react-native-testing` were identified before research and used to shape package boundaries, DTO/error design, and the consumer test strategy.

## Architecture & Design Patterns

| Concern | Pattern | Shape |
|---------|---------|-------|
| Public match discovery surface | Thin controller + feature service | `match/MatchDiscoveryController` validates query params, delegates to `MatchDiscoveryService`, and returns normalized matches only |
| Query normalization | Canonical query object | `MatchQuery` resolves optional `requestedAt` to a `LocalDate`, deduplicates/sorts league codes, and produces the cache key |
| ESPN integration | Feature-local Port / Adapter | `match/espn/EspnClient` + `RestClientEspnClient` reuse the existing Spring `RestClient` pattern with short timeouts |
| Upstream-to-wire mapping | Explicit normalizer boundary | `MatchNormalizer` maps ESPN DTOs to stable `NormalizedMatch` records and bounded status values |
| Repeated-request protection | Cache service + in-flight coalescing | `MatchCacheService` owns TTL entries (default PT5M, configurable) and `CompletableFuture` coalescing keyed by the canonical query |
| Error handling | Enum-backed exception model | Extend `ErrorCode` and reuse `ApiException` + `GlobalExceptionHandler` for validation and upstream failures |
| Client adoption | Thin API client + hook adapter | `utils/commandApiClient.ts` reads `EXPO_PUBLIC_COMMAND_API_URL`; `useMatchData` maps backend matches back into the existing `apiData` / `teamsData` / `availableLeagues` shape |

**Boundary rule**: ESPN DTOs, cache metadata, and request-normalization details never leave the `match/` package. The public HTTP contract is a plain JSON array of normalized match records only, with no metadata wrapper.

## Project Structure

### Documentation (this feature)

```text
specs/015-espn-match-proxy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── match-discovery.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
command-api/
├── src/main/java/com/dong/commandapi/
│   ├── match/
│   │   ├── MatchDiscoveryController.java
│   │   ├── MatchDiscoveryService.java
│   │   ├── MatchCacheService.java
│   │   ├── MatchDiscoveryProperties.java
│   │   ├── MatchQuery.java
│   │   ├── MatchNormalizer.java
│   │   ├── dto/
│   │   │   └── NormalizedMatch.java
│   │   └── espn/
│   │       ├── EspnClient.java
│   │       ├── RestClientEspnClient.java
│   │       └── EspnScoreboardResponse.java
│   ├── security/SecurityConfig.java
│   ├── error/ErrorCode.java
├── src/main/resources/application.yml
├── src/test/java/com/dong/commandapi/match/
│   ├── MatchDiscoveryControllerTest.java
│   ├── MatchDiscoveryServiceTest.java
│   ├── MatchCacheServiceTest.java
│   ├── MatchNormalizationTest.java
│   └── MatchDiscoveryPerformanceTest.java
└── README.md

hooks/
└── useMatchData.ts

utils/
└── commandApiClient.ts

__tests__/
├── hooks/
│   └── useMatchData.test.tsx
└── components/setupGame/
    └── MatchList.platform.test.tsx

README.md
```

**Structure Decision**: Reuse the existing monorepo split. The backend work lands in a new `match/` feature package inside `command-api/`, while the frontend change remains a small transport swap in `useMatchData` plus a dedicated API client helper. No new top-level package or service is introduced.

## Complexity Tracking

No constitution violations require special justification. The backend exception is already justified by Principle IV because this feature moves an external integration with provider-specific failure handling off the client.

## Phase 0: Research — Complete

All planning unknowns are resolved in [research.md](research.md). Key decisions:

- The endpoint will be a public, versioned `GET /v1/matches` surface with repeated `leagueCode` query params and an optional `requestedAt` ISO 8601 datetime query param.
- The backend owns a supported league-code allowlist and returns `league` as the league code, leaving display-name mapping to the existing Expo league catalog.
- ESPN access uses a feature-local `EspnClient` adapter built on Spring `RestClient`, with query normalization to ESPN's `dates=yyyyMMdd` format done server-side.
- Repeated identical queries are protected by a custom in-memory TTL cache plus in-flight request coalescing, without adding a new cache dependency.
- The Expo client keeps `useMatchData` as the stable consumer hook and swaps only the transport layer.

**Constitution re-check (post-Phase 0)**: All six gates pass with no unresolved clarifications.

## Phase 1: Design — Complete

| Artifact | Status |
|----------|--------|
| [data-model.md](data-model.md) | Complete — request normalization, normalized match fields, status enum, cache model, and controlled errors are defined |
| [contracts/match-discovery.md](contracts/match-discovery.md) | Complete — public HTTP contract, query params, success shape, and error codes are specified |
| [quickstart.md](quickstart.md) | Complete — local command-api + Expo validation flow, env vars, smoke test, and focused test commands are documented |

Agent context update is part of this plan workflow and is run after these design artifacts are written.

**Constitution re-check (post-Phase 1)**: All gates pass. No persisted data, RLS, auth-session model, or multiplayer write-path changes are introduced; the only security boundary change is a deliberate public read endpoint for match discovery, covered by dedicated integration tests.
