# Feature Specification: Bootstrap Java Command API

**Feature Branch**: `132-us41-bootstrap-java-command-api`  
**Created**: 2026-05-16  
**Status**: Draft  
**Issue**: [#132](https://github.com/NikolajKrogh/dong/issues/132) · Epic [#118](https://github.com/NikolajKrogh/dong/issues/118)

## Clarifications

### Session 2026-05-16

- Q: What observability does the service need to emit at this bootstrap stage? → A: Structured logs + basic request metrics (latency, status code counts)
- Q: How should the service behave when Supabase auth is temporarily unreachable? → A: Fail closed — reject all requests with a service-unavailable error
- Q: What format and uniqueness scope does the idempotency key require? → A: UUID v4, caller-generated, validated for correct format only (no deduplication storage at this stage)
- Q: What is the target response time for a successful authenticated request? → A: Under 500ms end-to-end for the stub command endpoint
- Q: What API versioning strategy should the service use? → A: URL path versioning (`/v1/`), version incremented only on breaking changes

## User Scenarios & Testing _(mandatory)_

### User Story 1 - API Discoverability (Priority: P1)

As a developer integrating with the command API, I want a machine-readable description of all available endpoints and their expected inputs, so that I can build client code and tooling without reading implementation source.

**Why this priority**: Without a discoverable API surface, no downstream integration work (ESPN proxy, room commands) can proceed reliably. This is the foundation every other story builds on.

**Independent Test**: Can be fully tested by starting the service and retrieving the API description document — a developer can read all endpoints, required headers, and response shapes without any credentials.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the command service is running, **When** a client requests the API description document, **Then** the service returns a complete document listing all available command endpoints, their required inputs, and authentication requirements.
2. **Given** the command service is running, **When** a developer opens the interactive API explorer, **Then** they can browse all endpoints, view request/response schemas, and send test requests from their browser.

---

### User Story 2 - Authenticated Access Enforcement (Priority: P1)

As the system, I want requests to command endpoints from unauthenticated or invalidly authenticated callers to be rejected immediately, so that business logic never executes on untrusted input.

**Why this priority**: Security gate — all future command implementations depend on this filter being in place first.

**Independent Test**: Can be fully tested by sending requests to any protected endpoint with (a) no token, (b) an expired token, (c) a tampered token, and (d) a valid token — each case must return the documented outcome.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a protected command endpoint exists, **When** a request arrives without an authentication credential, **Then** the service rejects it with an authentication-required response before executing any logic.
2. **Given** a protected command endpoint exists, **When** a request arrives with an invalid, expired, or tampered credential, **Then** the service rejects it with a structured error response.
3. **Given** a protected command endpoint exists, **When** a request arrives with a valid authenticated-host credential, **Then** the service processes the request and returns a structured response.

---

### User Story 3 - Service Health Reporting (Priority: P2)

As an operator deploying or monitoring the command service, I want a health endpoint that accurately reflects service readiness, so that I can integrate the service into deployment pipelines and alerting workflows.

**Why this priority**: Required for safe deployment and on-call integration, but does not block developer access to the API itself.

**Independent Test**: Can be fully tested by querying the health endpoint under normal and degraded conditions and verifying the response accurately reflects true readiness.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** the service is running and its dependencies are reachable, **When** an operator queries the health endpoint, **Then** the service reports ready status.
2. **Given** the service is running but a critical dependency is unreachable, **When** an operator queries the health endpoint, **Then** the service reports degraded status rather than hiding the problem.

---

### User Story 4 - Command Envelope Demonstration (Priority: P2)

As a developer building room or gameplay command clients, I want a working stub endpoint that demonstrates the standard request and response envelope, so that I can build client code against a consistent contract before real commands are implemented.

**Why this priority**: Enables parallel client development before downstream issues (#133+) are complete.

**Independent Test**: Can be fully tested by submitting a sample command via the stub endpoint and verifying the response matches the documented envelope shape.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a valid authenticated request, **When** a developer submits a command to the stub endpoint, **Then** the service returns a structured response demonstrating the standard envelope (command type, idempotency key acknowledgement, outcome).
2. **Given** a request missing the idempotency key header, **When** the developer submits the command, **Then** the service rejects it with a structured validation error before processing.

---

### Edge Cases

- What happens when the authentication credential is syntactically valid but issued for a non-host role (e.g., anonymous guest)?
- When Supabase auth is temporarily unreachable, the service fails closed — all requests are rejected with a service-unavailable error; no requests pass through without credential validation.
- What response does the service return when an unrecognised command type is submitted to the stub endpoint?
- How does the service handle requests with a valid credential that has just expired mid-request?

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: The Java command service is a standalone HTTP service, not a mobile/web UI component. It is invoked by the Expo client and future server-to-server callers over HTTP. No native or web platform-specific behavior applies.
- **Shared State Model**: This bootstrap issue introduces no shared application state changes. The service is stateless at this stage — credentials are validated per-request and no session state is persisted. Future issues will wire Supabase client calls.
- **Identity Model**: Only authenticated hosts with a valid Supabase session token may access protected command endpoints. Anonymous/guest callers are rejected at the authentication filter. The service does not issue credentials — it only validates them.
- **Migration / Backfill**: No database migrations or data backfills are required for this bootstrap. No existing data is affected.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: JWT filter must have tests covering: valid token passes, expired token rejected, missing token rejected, tampered signature rejected, wrong role (anonymous) rejected. Health indicator must have tests for UP and DOWN states. Command controller must have tests for authenticated success and unauthenticated rejection.
- **E2E Test Coverage**: No UI is introduced; Playwright E2E coverage is not required. Integration-level tests (MockMvc or TestRestTemplate) covering the full request pipeline are required instead.
- **Applicable Skills**: `java-springboot` (Spring Boot structure, DI, config, testing, security — MUST be followed for all service code), `openapi-to-application-code` (OpenAPI contract and code organization), `gh-cli` (GitHub Actions CI pipeline). These repository skills MUST be loaded and followed before research or implementation (Constitution Principle VI).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The service MUST expose a machine-readable API description document at a well-known path, listing all command endpoints, required authentication, and request/response schemas.
- **FR-002**: The service MUST provide an interactive API explorer accessible via browser without credentials.
- **FR-003**: The service MUST reject requests to command endpoints that do not carry a valid authenticated-host credential, returning a structured error response before any business logic executes.
- **FR-004**: The service MUST validate that credentials are unexpired, correctly signed, and issued to an authenticated host (not an anonymous caller).
- **FR-005**: The service MUST expose a health endpoint that accurately reflects service readiness, including the reachability of critical dependencies.
- **FR-006**: Health and API documentation endpoints MUST be publicly accessible without authentication credentials.
- **FR-007**: The service MUST expose at least one stub command endpoint demonstrating the standard request/response envelope, including idempotency key handling.
- **FR-008**: Command endpoints MUST require an idempotency key header carrying a UUID v4 value and MUST reject requests that omit it or supply a non-UUID v4 value with a structured validation error.
- **FR-009**: All error responses MUST follow a consistent structured format (error code, message) regardless of failure type.
- **FR-010**: The service MUST be startable locally with a single command and configurable via environment variables (no hardcoded secrets).
- **FR-011**: The service MUST emit structured logs (JSON format) for every request and all error conditions.
- **FR-012**: The service MUST expose basic request metrics — per-endpoint request latency and HTTP status code counts — at a metrics endpoint accessible without authentication.
- **FR-013**: If the service cannot reach the authentication dependency at request time, it MUST reject the request with a service-unavailable error and MUST NOT allow the request to proceed unauthenticated (fail closed).
- **FR-014**: All command endpoints MUST be mounted under a URL path version prefix (e.g. `/v1/`); the version is incremented only when a breaking change is introduced.

### Key Entities _(include if feature involves data)_

- **Command Request**: Represents a write intent sent to the service — carries a command type identifier, a caller-generated UUID v4 idempotency key, and an optional JSON payload.
- **Command Response**: The service's acknowledgement of a received command — carries the command type echoed back, outcome status, and any validation errors.
- **Authentication Credential**: A signed bearer token issued by the host authentication provider, carrying the caller's identity and role. Validated on every request.
- **Health Status**: A snapshot of service readiness — reports overall status and individual dependency states (e.g., backend reachability).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can retrieve the full API description document in under 2 seconds from a locally running service.
- **SC-002**: Requests with invalid credentials are rejected in under 100 milliseconds without touching any business logic or data store.
- **SC-003**: The health endpoint accurately reflects a degraded state within 15 seconds of a dependency becoming unreachable.
- **SC-004**: All unit and integration tests pass in under 2 minutes on a standard CI runner.
- **SC-005**: A developer unfamiliar with the service can send their first authenticated test request using only the API explorer, without reading source code.
- **SC-006**: Every request produces a structured log entry and increments the relevant status-code counter, verifiable by querying the metrics endpoint immediately after the request.
- **SC-007**: A valid authenticated request to the stub command endpoint completes end-to-end in under 500ms under normal conditions.

## Assumptions

- Supabase is the sole authentication provider; no additional identity providers are in scope for this issue.
- The service runs as a single instance in this bootstrap phase; horizontal scaling, distributed tracing, and rate limiting are out of scope.
- Production CORS configuration and Docker/container manifests are out of scope — local development and CI are the only runtime targets at this stage.
- Idempotency deduplication storage (recording seen keys to prevent replay) is out of scope; only header presence validation is required.
- ESPN proxying and real room/gameplay command implementations are addressed in downstream issues (#133+).
- The Expo client is the primary consumer of this API in the near term; server-to-server callers are a future concern.
- API versioning uses URL path prefixes (`/v1/`, `/v2/`); the version is only incremented when a breaking change is introduced. Non-breaking additions (new endpoints, optional fields) do not require a version bump.
