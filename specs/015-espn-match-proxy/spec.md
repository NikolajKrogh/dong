# Feature Specification: ESPN Proxy and Normalized Match Endpoints

**Feature Branch**: `152-espn-match-proxy`  
**Created**: 2026-05-24  
**Status**: Draft  
**Issue**: [#133](https://github.com/NikolajKrogh/dong/issues/133) · Epic [#118](https://github.com/NikolajKrogh/dong/issues/118)  
**Input**: User description: "Issue #133: Add ESPN proxy and normalized match endpoints"

## Clarifications

### Session 2026-05-24

- Q: What response shape should the backend expose? → A: Flat app-facing match objects aligned with the current client models: id, league, homeTeam, awayTeam, startDateTime, status, score, venue.
- Q: What league input format should the backend accept? → A: League codes only, for example an array of eng.1, usa.1, uefa.champions.
- Q: How should repeated identical queries be reused? → A: A default 5-minute in-memory TTL cache keyed by date plus league codes, configurable via COMMAND_API_MATCH_DISCOVERY_TTL, with coalescing of identical in-flight requests.
- Q: What should happen if the date is omitted? → A: Default to today's date.
- Q: What should happen with unsupported league codes? → A: Reject them with a client-safe validation error.
- Q: What date format should the backend accept for match queries? → A: ISO 8601 datetime with timezone.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fetch Normalized Match Lists (Priority: P1)

As a client integration, I can request matches for a specific ISO 8601 datetime with timezone (or omit it to use today's date) and selected league code set through the backend and receive a flat normalized result that the app can render directly.

**Why this priority**: This is the core value of the issue. The app needs one stable match-discovery path that works across clients without relying on upstream-specific data shapes.

**Independent Test**: Call the match discovery endpoint for a supported ISO 8601 datetime or omit the date, then verify the response includes only supported league codes and can be rendered without extra client-side transformation.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a supported ISO 8601 datetime or no date and a set of supported league codes, **When** the client requests matches, **Then** the backend returns only matches for those selected league codes in a normalized app-friendly structure and uses today's date when the date is omitted.
2. **Given** a request containing an unsupported league code, **When** the client requests matches, **Then** the backend rejects the request with a client-safe validation error.
3. **Given** the same supported query from different clients, **When** they request match data, **Then** they receive the same field set and equivalent content for the same upstream state.

---

### User Story 2 - Keep Client Flows Independent of Upstream Failures (Priority: P1)

As a client integration, I can rely on the backend to translate upstream outages or malformed data into safe errors so the client does not see provider internals.

**Why this priority**: Match discovery must remain dependable even when the upstream provider is slow, unavailable, or returns unexpected content.

**Independent Test**: Simulate upstream timeout, invalid payload, empty payload, or upstream rate-limit behavior and verify the backend returns controlled error responses without exposing provider details.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the upstream provider is unavailable, **When** the backend fetches matches, **Then** it returns a controlled error response.
2. **Given** the upstream provider returns malformed or unexpected data, **When** the backend processes the response, **Then** it rejects the response safely and does not expose raw upstream fields or stack traces.
3. **Given** a valid date and league code selection with no available matches, **When** the client requests matches, **Then** the backend returns an empty match list rather than a provider error.

---

### User Story 3 - Protect Repeated Match Lookups (Priority: P2)

As an operator of the service, I can absorb repeated lookups for the same query with cached reuse inside the configured TTL window (default 5 minutes) and in-flight coalescing, without hammering the upstream provider or degrading client responsiveness.

**Why this priority**: Clients will revisit match discovery frequently, so the backend needs reuse or throttling to stay stable under normal browsing behavior.

**Independent Test**: Repeat the same supported query several times in quick succession and verify responses stay consistent, cached reuse is returned within the configured TTL window (default PT5M), and the upstream service is not contacted on every request.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** repeated requests for the same supported date and league code selection, **When** they arrive within the backend's configured TTL window (default 5 minutes), **Then** the service returns cached results or coalesces the request so redundant upstream calls are suppressed.
2. **Given** a burst of repeated supported requests, **When** the backend is under normal load, **Then** client-visible responses remain available and do not surface upstream rate-limit errors.

---

### Edge Cases

- Requested leagues contain values the backend does not support.
- The date query is missing or malformed.
- The upstream provider returns a partial league response where some matches are missing teams, times, or venue data.
- The upstream provider returns no events for a supported date and league.
- The same query is repeated while a prior fetch is still in progress.
- Upstream errors occur after a successful previous response exists.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: Web and native clients must use the backend match discovery endpoint instead of contacting the upstream provider directly. The user-visible behavior should remain consistent across platforms.
- **Shared State Model**: This feature does not introduce new persisted app state. Match discovery responses are request-scoped, and any server-side reuse is an implementation detail rather than a new client state source.
- **Identity Model**: This feature does not add new identity states. It follows the existing client access model for match discovery and does not change how hosts, guests, or signed-in users are represented.
- **Migration / Backfill**: No data migration or backfill is required.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Cover request validation for date and league selection, normalization mapping, empty-result behavior, upstream failure translation, malformed payload handling, and repeated-request reuse behavior.
- **E2E Test Coverage**: No new browser journey is introduced by this issue; backend contract or integration tests are sufficient. If client wiring changes in the same change set, add a narrow consumer regression test for the match list flow.
- **Applicable Skills**: `java-springboot`, `openapi-to-application-code`

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The service MUST expose a match discovery endpoint that accepts an optional ISO 8601 datetime with timezone and a set of supported league codes, and MUST default the date to today's date when omitted.
- **FR-002**: The service MUST source match discovery data through the backend and MUST NOT require client-side calls to the upstream provider for match retrieval.
- **FR-003**: The service MUST return a flat normalized match collection with stable field names across supported leagues and dates.
- **FR-004**: Each normalized match MUST include id, league, homeTeam, awayTeam, startDateTime, and status; score and venue information MUST be included when available.
- **FR-005**: The service MUST validate requested ISO 8601 datetime values and league inputs and return a client-safe validation error for malformed date values or unsupported league codes.
- **FR-006**: The service MUST translate upstream availability failures, invalid payloads, and upstream rate-limit responses into controlled client-safe errors.
- **FR-007**: The service MUST NOT expose raw upstream payloads, stack traces, or provider-specific error text to clients.
- **FR-008**: The service MUST return an empty match list, not an error, when a valid request yields no matches.
- **FR-009**: The service MUST reuse repeated identical requests through an in-memory TTL cache keyed by date plus league codes, with a default TTL of PT5M configurable via `COMMAND_API_MATCH_DISCOVERY_TTL`, and MUST coalesce identical in-flight requests so the upstream provider is not contacted unnecessarily for the same short-term query.
- **FR-010**: The service MUST keep the response contract stable for the same request parameters regardless of which supported client makes the request.

### Key Entities _(include if feature involves data)_

- **Match Query**: The requested ISO 8601 datetime or defaulted current date plus the selected supported league codes used to retrieve matches.
- **Normalized Match**: The flat client-friendly match record returned by the backend, including id, league, homeTeam, awayTeam, startDateTime, status, score, and venue when available.
- **Match Collection Response**: A plain JSON array of flat normalized matches for one query. No metadata wrapper is added for this feature.
- **Controlled Error**: A sanitized error outcome returned to clients when the upstream provider fails or produces invalid data.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 95% of successful requests for supported date and league combinations return a normalized response in under 2 seconds under normal load.
- **SC-002**: 100% of simulated upstream outages, timeouts, malformed payloads, and rate-limit responses are converted into controlled client-safe errors with no raw provider details exposed.
- **SC-003**: Supported match queries return the same flat normalized field set for repeated requests from different clients, and the client can render the results without additional transformation.
- **SC-004**: In a burst of repeated identical supported requests, the backend remains responsive and does not surface provider rate-limit errors to the client.

## Assumptions

- This feature depends on the existing Java command API foundation from issue #132 / US4.1 being available.
- The supported league list is the one already exposed in the app today unless future product work expands it.
- Client applications will be updated to consume the backend endpoint as the single match-discovery path.
- Reuse of repeated identical queries is transient, in-memory, defaults to a PT5M TTL unless overridden by configuration, and does not need to survive service restarts.