# Research: Bootstrap Java Command API

**Feature**: `specs/014-java-command-api`  
**Date**: 2026-05-16  
**Status**: Complete — all NEEDS CLARIFICATION items resolved

## ADR-0: Applicable Skills (Constitution Principle VI correction)

**Decision**: This feature is governed by two repository skills — `java-springboot` and `openapi-to-application-code` (plus `gh-cli` for the CI workflow). All are loaded and followed.

**Context**: The initial revision of these artifacts recorded "Applicable Skills: NONE IDENTIFIED" because the skill search only globbed `**/*.SKILL.md` and `.github/skills/**`. Repository skills actually live in `.agents/skills/`. `/speckit.analyze` flagged this as a CRITICAL Principle VI violation. Corrected across spec.md, plan.md, research.md, tasks.md.

**Applied guidance**: package-by-feature; constructor injection with `private final`; `@ConfigurationProperties` over scattered `@Value`; global `@RestControllerAdvice` exception handling; DTOs (never expose internals); `@WebMvcTest`/`@SpringBootTest` slices; SLF4J parameterized logging; Spring profiles for env-specific config; `.env.example` + README as required supporting files.

## Decision Log

### 1. JWT Signing Algorithm

**Decision**: HS256 with shared JWT secret (`SUPABASE_JWT_SECRET`)

**Rationale**: `supabase/config.toml` has `signing_keys_path` commented out, confirming no RS256 key file is configured. Local Supabase uses HS256 by default with the JWT secret from `config.toml` (or env override). The JWKS endpoint at `/auth/v1/.well-known/jwks.json` will return 404 for this project.

**Alternatives considered**:
- RS256 via `spring-security-oauth2-resource-server`: Would require the Supabase project to have a JWKS endpoint with RSA keys. Not applicable here.
- Asymmetric key from file: Would require `signing_keys_path` to be configured. Not configured.

**Implementation note**: The filter reads `Authorization: Bearer <token>`, verifies the HS256 signature using `SUPABASE_JWT_SECRET`, and checks `exp`, `sub` (non-empty), and `role=authenticated` claims. Tokens with `role=anon` are rejected with 401.

---

### 2. JWT Validation Library

**Decision**: JJWT 0.12.x (`io.jsonwebtoken:jjwt-api`, `jjwt-impl`, `jjwt-jackson`)

**Rationale**: JJWT is the standard Java JWT library for HS256 validation. Supports `Jwts.parser().verifyWith(secretKey)` API introduced in 0.12.x. Lightweight, no Spring Security dependency required for the validation itself.

**Alternatives considered**:
- `spring-security-oauth2-resource-server`: Designed for RS256/JWKS. Adds unnecessary complexity for HS256; requires configuring a JwkSetUri or JWT decoder bean that doesn't fit HS256 naturally.
- `com.auth0:java-jwt`: Valid alternative, but JJWT is more commonly paired with Spring Boot projects and has better Maven adoption.

---

### 3. Spring Boot Version

**Decision**: Spring Boot 3.3.x (latest 3.3 patch at build time)

**Rationale**: Spring Boot 3.3 is on the current OSS support line (until November 2025 OSS, 2027 commercial). Requires Java 17+; Java 21 LTS is the target here. Spring Boot 3.x uses Spring Security 6.x, which uses `SecurityFilterChain` beans (not `WebSecurityConfigurerAdapter`).

**Alternatives considered**:
- Spring Boot 3.2.x: Still supported but 3.3 has virtual threads (Project Loom) support as a bonus for future use.
- Spring Boot 2.x: Incompatible with Java 21 virtual threads and uses deprecated `WebSecurityConfigurerAdapter` API.

---

### 4. OpenAPI Documentation Library

**Decision**: `springdoc-openapi-starter-webmvc-ui` 2.5.x

**Rationale**: springdoc 2.x is the only option compatible with Spring Boot 3.x (springdoc 1.x only supports Spring Boot 2.x). Auto-generates `/v3/api-docs` (JSON) and `/swagger-ui.html` (interactive explorer) with zero configuration. Reads `@Operation`, `@Parameter`, `@ApiResponse`, and `@SecurityRequirement` annotations from controllers.

**Alternatives considered**:
- Springfox: Abandoned; not compatible with Spring Boot 3.x.
- Manual OpenAPI YAML: Higher maintenance burden; loses in-code annotation benefits.

---

### 5. Build Tool

**Decision**: Maven 3.9.x with Maven Wrapper (`mvnw` / `mvnw.cmd`)

**Rationale**: Spring Initializr defaults to Maven. No existing Gradle infrastructure in the repo (the root `build.gradle` belongs to the Expo Android build, not a general Gradle wrapper). Maven avoids polyglot build entanglement. The wrapper ensures reproducible builds on CI without a pre-installed Maven.

**Alternatives considered**:
- Gradle (Kotlin DSL): Valid for new projects, but adds `.gradle/` cache and `settings.gradle.kts` beside the existing Android Gradle files, creating confusion.
- No wrapper: Requires Maven to be pre-installed on CI runners; not reproducible.

---

### 6. Security Filter Chain Configuration

**Decision**: Custom `OncePerRequestFilter` (`SupabaseJwtFilter`) + Spring Security `SecurityFilterChain` bean

**Rationale**: With HS256 and JJWT, the idiomatic approach is a custom filter that extracts and validates the token, then sets an `AuthenticatedHost` principal in the `SecurityContextHolder`. The filter is positioned via `.addFilterBefore(jwtFilter, AuthorizationFilter.class)` — after `ExceptionTranslationFilter` (order 3100) — so that `ExceptionTranslationFilter` wraps the filter and routes `InvalidTokenException` through `ApiAuthenticationEntryPoint` → 401 `ApiError`.

Open paths (no auth required):
- `GET /actuator/health`
- `GET /actuator/metrics/**`
- `GET /v3/api-docs/**`
- `GET /swagger-ui/**`
- `GET /swagger-ui.html`

Protected paths (auth required):
- `POST /v1/**`

CSRF is disabled (stateless REST API; no session cookies).

---

### 7. Health & Metrics Actuator Configuration

**Decision**: Spring Boot Actuator with `health` and `metrics` endpoints exposed; all others restricted

**Rationale**: `management.endpoints.web.exposure.include=health,metrics` exposes only what the spec requires. `management.endpoint.health.show-details=always` enables the `SupabaseHealthIndicator` details to be visible without authentication (acceptable for internal deployment; production can restrict via `show-details=when-authorized`).

**Custom `SupabaseHealthIndicator`**: Performs a lightweight `HEAD` or `GET` to `${SUPABASE_URL}/auth/v1/health` with a 5-second timeout. Result cached for 10 seconds to avoid hammering the dependency on every health poll.

---

### 8. Command Endpoint Convention

**Decision**: `POST /v1/rooms/{roomId}/commands/{commandType}`

**Rationale**: Path-based command type is readable in logs and API explorers. Consistent with REST resource-oriented conventions (room is the aggregate root). The `commandType` path parameter doubles as documentation — each command type is visible in the OpenAPI spec as a separate operation or via a shared endpoint with discriminated body.

**Idempotency header**: `Idempotency-Key: <UUID v4>` — validated for UUID v4 format (per clarification Q3). Missing or malformed key returns 422 Unprocessable Entity.

**Alternatives considered**:
- `POST /v1/commands` with command type in body: Less discoverable in OpenAPI; harder to route per-command in future.
- CQRS command bus pattern: Over-engineering for bootstrap; revisit in #133+.

---

### 9. Structured Logging & Metrics

**Decision**: Logback (Spring Boot default) with JSON encoder via `logstash-logback-encoder`; Micrometer (Spring Boot Actuator default) for metrics

**Rationale**: Logback is Spring Boot's default logger. `logstash-logback-encoder` converts log output to JSON with standard fields (`timestamp`, `level`, `logger`, `message`, `traceId` if MDC populated). Micrometer is already included via `spring-boot-starter-actuator` and auto-instruments HTTP request latency and status code counts via `http.server.requests` metric — no manual instrumentation required.

**Alternatives considered**:
- Log4j2 with JSON layout: Valid alternative, but Logback is Spring Boot's default; no migration needed.
- Manual Prometheus endpoint: Micrometer via Actuator already exposes `/actuator/metrics`; a Prometheus scrape endpoint can be added later if needed.

---

### 10. Fail-Closed on Auth Dependency Unavailability

**Decision**: Fail closed in two layers — (1) **startup**: missing/blank secret prevents the context from starting; (2) **request**: any validation failure rejects with 401, no request ever bypasses validation.

**Rationale**: Per clarification Q2 and FR-013. Implemented structurally rather than with imperative guards.

**Implementation**:
- `SupabaseProperties` is `@ConfigurationProperties("supabase") @Validated` with `@NotBlank jwtSecret` and `@NotBlank url`. If the secret is absent/blank, bean validation fails and `CommandApiApplication` **does not start** — the strongest possible fail-closed posture. (Supersedes the earlier `@Value` approach; see ADR-3.)
- `SupabaseJwtFilter` catches `JwtException`/validation errors and throws `AuthenticationException` (it does **not** write the response — see ADR-2). Spring Security's `ExceptionTranslationFilter` routes to `ApiAuthenticationEntryPoint`, which emits a 401 `ApiError`. A request can never reach a controller without a validated `AuthenticatedHost`.

---

## Architecture Decision Records

Decisions raised by `/speckit.analyze` and a stronger-model architecture review. Each maps to **scheduled** Epic #118 work (#133), not speculation.

### ADR-1: Command processing — Strategy + Registry

**Decision**: `CommandHandler` interface (Strategy) + `CommandDispatcher` (Registry) injecting Spring's `Map<String,CommandHandler>` to resolve `commandType` → handler. Controller is thin: parse → build `CommandContext` → `dispatcher.dispatch()` → map `CommandResult` → `CommandResponse`. This issue ships exactly one handler: `EchoCommandHandler`.

**Rationale**: Inlining command logic in the controller makes #133's real commands a god-class `switch` (violates OCP/SRP). With the registry, #133 adds a `@Component implements CommandHandler` and touches nothing else. Spring auto-collects beans into the injected `Map`/`List` — idiomatic, no manual wiring.

**Alternatives**: inline switch (rejected — invasive churn); full CQRS command bus (rejected — over-engineered for bootstrap).

### ADR-2: Error serialization — single egress, filter never writes the response

**Decision**: The JWT filter throws `AuthenticationException`; it does **not** serialize a response. Spring Security `ApiAuthenticationEntryPoint` (401) and `ApiAccessDeniedHandler` (403) beans emit `ApiError`, identical to what `GlobalExceptionHandler` emits for controller/advice errors.

**Rationale**: A filter writing `ApiError` directly creates two serializers for one shape — they drift. Routing filter failures through the Security exception-translation path yields exactly one `ApiError` egress for every failure (filter, controller, advice).

**Alternatives**: filter writes JSON directly (rejected — duplicate, drift-prone).

### ADR-3: Configuration — type-safe `@ConfigurationProperties`

**Decision**: `SupabaseProperties` (`@ConfigurationProperties("supabase") @Validated`, `@NotBlank jwtSecret`, `@NotBlank url`) in the `supabase/` package. Replaces scattered `@Value`.

**Rationale**: java-springboot skill mandates type-safe properties. Bonus: `@Validated` makes a missing secret a startup failure — this *is* the FR-013 fail-closed startup guarantee, implemented for free with no imperative guard.

### ADR-4: Auth identity — typed `AuthenticatedHost` principal

**Decision**: JWT filter sets `AuthenticatedHost(hostId, role)` as the Spring Security principal. Handlers/controllers obtain it via `@AuthenticationPrincipal`.

**Rationale**: A generic `UsernamePasswordAuthenticationToken` forces every #133+ command to re-parse the JWT or blind-cast. A typed principal models identity once.

### ADR-5: External calls — Port/Adapter via Spring `RestClient`

**Decision**: `SupabaseClient` port + `RestClientSupabaseClient` adapter in `supabase/`. `SupabaseHealthIndicator` depends on the port.

**Rationale**: Raw `java.net.http.HttpClient` is unmockable in slice tests and diverges from how #133 will call Supabase/ESPN. Spring `RestClient` (bundled in spring-web, Boot 3.2+ — no new dependency) behind a port is mockable and gives #133's ESPN proxy a ready adapter shape.

### ADR-6: Request tracing — Correlation ID filter + MDC

**Decision**: `CorrelationIdFilter` ordered before `SupabaseJwtFilter`; reads/generates `X-Request-Id`, puts it in SLF4J MDC; Logstash encoder emits it on every line.

**Rationale**: The service will orchestrate multi-step Supabase+ESPN commands; structured logs (FR-011/SC-006) are nearly useless for diagnosis without a correlation id. Cheap as a bootstrap filter, expensive to retrofit across an existing handler set. The filter ordering is itself a clean Chain of Responsibility.

### ADR-7: Idempotency — service seam, no-op now

**Decision**: `IdempotencyService` interface + `NoOpIdempotencyService` (UUID v4 format validation only). Dispatcher consults it before invoking a handler.

**Rationale**: Dedup storage is correctly out of scope, but hardcoding the check in the controller means #133 edits the controller to add real dedup. A seam lets #133 supply a persistent implementation (a Decorator on the dispatch path) with zero controller churn.

### ADR-8: OpenAPI strategy — code-first, not spec-first

**Decision**: Code-first — springdoc generates `/v3/api-docs` from annotated controllers. We do **not** generate code from a hand-written OpenAPI document.

**Rationale**: The `openapi-to-application-code` skill assumes spec-first codegen. Code-first is chosen deliberately: the annotated controller is the single source of truth, no codegen build step, no generated-code drift. Recorded here so the divergence from the skill's default flow is intentional, not accidental. The skill's *organizational* guidance (layer separation, DTOs, error handling, supporting files) is still applied.

