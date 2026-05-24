# Tasks: Bootstrap Java Command API

**Input**: Design documents from `specs/014-java-command-api/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅ (ADR-0..ADR-8), data-model.md ✅, contracts/ ✅  
**Applicable Skills**: `java-springboot` + `openapi-to-application-code` (loaded & followed — Constitution Principle VI; see research.md ADR-0). `gh-cli` for the CI task.

**Tests**: Every user story includes required unit + integration tests (Principle V). No E2E — no UI.

**Architecture**: Strategy+Registry dispatch, enum-backed errors with single egress, type-safe config, typed principal, port/adapter for external calls, correlation-id tracing, idempotency seam. Full rationale in research.md ADR-1..ADR-8 and plan.md.

> ## ✅ Implementation Status: IMPLEMENTED-COMPILED
> All tasks below are marked `[~]` — **code written and compiled successfully with Java 17**.
> Compilation verified: `javac [javac] -target 17` produces version 61.0 (Java SE 17) bytecode.
> Test execution: `./mvnw verify` compilation passes; 20 tests present but have HTTP client
> configuration issues (TestRestTemplate URLConnection retry with 401+body). See notes below.
> **Consolidation note**: T012 was written in its final form already wiring the
> JWT filter, so T019 (separate "register filter" step) is folded into T012.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no incomplete-task dependency)
- **[Story]**: maps to spec.md user story (US1–US4)
- All code follows java-springboot skill: package-by-feature, constructor injection (`private final`), `@ConfigurationProperties`, DTOs, SLF4J parameterized logging, test slices

---

## Phase 1: Setup

- [~] T001 Create `command-api/pom.xml` — Spring Boot 3.3.x parent, Java 17; dependencies: `spring-boot-starter-web`, `spring-boot-starter-security`, `spring-boot-starter-actuator`, `spring-boot-starter-validation`, `springdoc-openapi-starter-webmvc-ui:2.5.x`, `jjwt-api/impl/jackson:0.12.x`, `logstash-logback-encoder`, `spring-boot-starter-test`, `spring-security-test`
- [~] T002 Generate Maven Wrapper (`mvnw`, `mvnw.cmd`, `.mvn/wrapper/`) via Spring Initializr or `mvn wrapper:wrapper -Dmaven=3.9.6` in `command-api/`
- [~] T003 Create `command-api/src/main/java/com/dong/commandapi/CommandApiApplication.java` — `@SpringBootApplication`, `@ConfigurationPropertiesScan`
- [~] T004 Create `command-api/src/main/resources/application.yml` (port 8080, app name, actuator base) and `application-dev.yml` (dev-only CORS allowed origins for the Expo web client — grep-able, never silently applied)
- [~] T005 [P] Add `command-api/target/` and `command-api/.mvn/` to root `.gitignore`
- [~] T006 [P] Add `command-api/` to root `.easignore` (exclude Java service from Expo EAS builds)
- [~] T007 [P] Create `.github/workflows/java-ci.yml` — trigger on paths `command-api/**`; `actions/setup-java@v4` Temurin 21 + Maven cache; `./mvnw verify`; inject `SUPABASE_JWT_SECRET` from repo secret (per `gh-cli` skill)
- [~] T008 [P] Create `command-api/.env.example` and `command-api/README.md` (setup, env vars, run/test commands) — mandated by `openapi-to-application-code` + java-springboot skills

**Checkpoint**: `cd command-api && ./mvnw.cmd spring-boot:run` starts on port 8080.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [~] T009 Create `error/` package — `ErrorCode.java` (enum: each constant carries `httpStatus`, `code`, `defaultMessage`; constants per data-model.md), `ApiException.java` (single custom exception wrapping an `ErrorCode`), `ApiError.java` (wire DTO: `error`, `message`, `timestamp`)
- [~] T010 Create `error/GlobalExceptionHandler.java` — `@RestControllerAdvice`; one handler for `ApiException` (maps `ErrorCode` → status + `ApiError`), plus framework handlers (`HttpMessageNotReadableException`→400, `HttpMediaTypeNotSupportedException`→415, fallback `Exception`→`INTERNAL_ERROR`). New error = new enum constant, no new handler (ADR-2)
- [~] T011 Create `supabase/SupabaseProperties.java` — `@ConfigurationProperties("supabase") @Validated`, `@NotBlank jwtSecret`, `@NotBlank url`. Missing/blank secret → context fails to start = FR-013 fail-closed startup (ADR-3, research.md §10)
- [~] T012 Create `security/SecurityConfig.java` — `SecurityFilterChain`: stateless sessions, CSRF disabled, form-login/http-basic disabled; permit `GET /v3/api-docs/**`, `/swagger-ui/**`, `/swagger-ui.html`, `/actuator/health`, `/actuator/metrics/**`; require auth for `/v1/**`; register `ApiAuthenticationEntryPoint` (401→`ApiError`) and `ApiAccessDeniedHandler` (403→`ApiError`) in `security/` — single error egress (ADR-2)
- [~] T013 Create `observability/CorrelationIdFilter.java` — `OncePerRequestFilter`, `@Order(HIGHEST_PRECEDENCE)`; read/generate `X-Request-Id`, put in SLF4J MDC, clear in `finally`; ordered before `SupabaseJwtFilter` (ADR-6, Chain of Responsibility)

**Checkpoint**: Service starts. `GET /actuator/health`→200. `GET /v3/api-docs`→200. `POST /v1/...`→401 with `ApiError` JSON via the entry point (no filter yet). Missing `SUPABASE_JWT_SECRET` → context refuses to start.

---

## Phase 3: User Story 1 — API Discoverability (P1) 🎯 MVP

**Goal**: Full OpenAPI document + interactive explorer, no credentials.

**Independent Test**: `GET /v3/api-docs`→200 JSON with `paths`; `GET /swagger-ui.html`→200 in browser.

- [~] T014 [P] [US1] `test/.../ApiDiscoverabilityTest.java` — `@SpringBootTest(RANDOM_PORT)`: `/v3/api-docs`→200 + body has `"paths"`; `/swagger-ui.html`→200; both reachable without `Authorization`
- [~] T015 [US1] Create `OpenApiConfig.java` (package root, not a single-file package) — `@OpenAPIDefinition` (title "DONG Command API", version "1.0.0"), `@SecurityScheme(name="bearerAuth", type=HTTP, scheme="bearer", bearerFormat="JWT")`

**Checkpoint**: Swagger UI shows title + bearerAuth scheme. T014 passes.

---

## Phase 4: User Story 2 — Authenticated Access Enforcement (P1)

**Goal**: Invalid/missing credentials rejected before business logic; consistent `ApiError`.

**Independent Test**: `POST /v1/rooms/test/commands/noop` no token→401 `ApiError`; expired/tampered/anon→401; valid `authenticated` token→passes (404, no handler yet).

- [~] T016 [P] [US2] `test/.../security/SupabaseJwtFilterTest.java` — cases: (a) no header→401 `UNAUTHORIZED`, (b) malformed bearer→401, (c) expired→401, (d) tampered sig→401, (e) `role=anon`→401, (f) valid `role=authenticated`→passes with `AuthenticatedHost` populated; assert response shape comes from the entry point (single egress)
- [~] T017 [P] [US2] Create `security/AuthenticatedHost.java` — record `(String hostId, String role)`; the typed Spring Security principal (ADR-4)
- [~] T018 [US2] Create `security/SupabaseJwtFilter.java` — `OncePerRequestFilter` (constructor-inject `SupabaseProperties`); verify HS256 sig via `Jwts.parser().verifyWith(Keys.hmacShaKeyFor(props.jwtSecret().getBytes()))`; validate `exp`, non-empty `sub`, `role=="authenticated"`; on success set `AuthenticatedHost` into `SecurityContext`; on any failure **throw `AuthenticationException`** — never writes the response (ADR-2)
- [~] T019 [US2] Register `SupabaseJwtFilter` in `security/SecurityConfig.java` via `.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)` (after `CorrelationIdFilter`)

**Checkpoint**: No token→401 `ApiError` (from entry point, identical shape to advice). Valid JWT→404. T016 passes.

---

## Phase 5: User Story 3 — Service Health Reporting (P2)

**Goal**: Health reflects Supabase reachability; degraded within 15s (10s cache).

**Independent Test**: `/actuator/health`→`{"status":"UP","components":{"supabase":{"status":"UP"}}}`; Supabase down→`DOWN`/503.

- [~] T020 [P] [US3] `test/.../health/HealthEndpointTest.java` — Supabase reachable→200 `UP`; mock `SupabaseClient` unreachable→503 `DOWN`
- [~] T021 [P] [US3] Create `supabase/SupabaseClient.java` (port) + `supabase/RestClientSupabaseClient.java` (Spring `RestClient`, constructor-inject `SupabaseProperties`, 5s timeout) — ADR-5 Adapter
- [~] T022 [US3] Create `health/SupabaseHealthIndicator.java` — implements `HealthIndicator`, constructor-inject `SupabaseClient`; `Health.up()`/`down().withDetail("url", ...)`; 10s result cache (SC-003)
- [~] T023 [US3] Update `application.yml` — `management.endpoints.web.exposure.include: health,metrics`; `management.endpoint.health.show-details: always`; `management.endpoint.health.probes.enabled: true`

**Checkpoint**: Health shows `supabase` component. T020 passes.

---

## Phase 6: User Story 4 — Command Envelope Demonstration (P2)

**Goal**: Stub endpoint demonstrates the envelope via Strategy+Registry dispatch + idempotency seam.

**Independent Test**: valid JWT + UUID v4 key → 200 `ACCEPTED` envelope; missing key→422 `MISSING_IDEMPOTENCY_KEY`; non-UUID→422 `INVALID_UUID`; unknown type→422 `UNKNOWN_COMMAND`.

- [~] T024 [P] [US4] `test/.../command/CommandControllerTest.java` (`@WebMvcTest`, mocked filter) + `CommandDispatcherTest.java` — controller: (a) valid→200 envelope, (b) missing key→422, (c) non-UUID→422, (d) full integration w/ real JWT→200; dispatcher: known type→handler invoked, unknown→`ApiException(UNKNOWN_COMMAND)`
- [~] T025 [P] [US4] Create `command/CommandHandler.java` (Strategy port: `String commandType()`, `CommandResult handle(CommandContext)`), `command/CommandContext.java`, `command/CommandResult.java` (handler-internal types per data-model.md)
- [~] T026 [P] [US4] Create `command/dto/CommandRequest.java` (`@Valid`-annotated, nullable `payload`) and `command/dto/CommandResponse.java` (wire-out envelope)
- [~] T027 [P] [US4] Create `command/idempotency/IdempotencyService.java` (interface) + `NoOpIdempotencyService.java` (UUID v4 format validation only; throws `ApiException(INVALID_UUID)`/`MISSING_IDEMPOTENCY_KEY`) — ADR-7 seam
- [~] T028 [US4] Create `command/CommandDispatcher.java` — constructor-inject `Map<String,CommandHandler>` (Spring auto-registry) + `IdempotencyService`; resolve `commandType`→handler or throw `ApiException(UNKNOWN_COMMAND)`; consult idempotency before dispatch (ADR-1)
- [~] T029 [P] [US4] Create `command/EchoCommandHandler.java` — `@Component implements CommandHandler`; `commandType()` matches any (reference stub); returns `CommandResult(ACCEPTED)`. The only handler shipped; documents the extension point for #133
- [~] T030 [US4] Create `command/CommandController.java` — `POST /v1/rooms/{roomId}/commands/{commandType}`, `@SecurityRequirement("bearerAuth")`, full OpenAPI annotations; obtain `AuthenticatedHost` via `@AuthenticationPrincipal`; build `CommandContext` → `dispatcher.dispatch()` → map `CommandResult`→`CommandResponse` (boundary rule: no handler internals leak)

**Checkpoint**: valid JWT + UUID key→`{"commandType":...,"status":"ACCEPTED",...}`. All four suites (T014/T016/T020/T024) pass via `./mvnw.cmd test`.

---

## Phase 7: Polish & Cross-Cutting

- [~] T031 [P] Create `command-api/src/main/resources/logback-spring.xml` — `LogstashEncoder` console appender (JSON stdout); include MDC so `correlationId` appears on every line (FR-011, SC-006, ADR-6)
- [~] T032 [P] `test/.../PerformanceSmokeTest.java` — assert rejected request <100ms (SC-002) and authenticated stub <500ms (SC-007) under local conditions (closes coverage gap G2)
- [~] T033 Run `quickstart.md` end-to-end: health UP, authenticated stub→`ACCEPTED`, `http.server.requests` metric present, JSON logs with `correlationId` in console; `./mvnw.cmd verify` all green

---

## Dependencies & Execution Order

```
Phase 1 Setup
  └─ Phase 2 Foundational  (error model, SecurityConfig+entry point, SupabaseProperties, CorrelationIdFilter)
        ├─ Phase 3 US1 (Discoverability) ─── independent
        ├─ Phase 4 US2 (Auth) ──────────────┐
        ├─ Phase 5 US3 (Health) ─── independent
        └─                                   └─ Phase 6 US4 (Envelope; needs US2 filter)
                                                    └─ Phase 7 Polish
```

- **US4 depends on US2** (protected endpoint needs the JWT filter + `AuthenticatedHost`). US1, US3 independent after Phase 2.
- **Parallel**: T005/T006/T007/T008 (setup); US1+US2+US3 streams after Phase 2; within US4 the [P] type/DTO/seam tasks (T025/T026/T027/T029) precede the wiring (T028/T030).

## Implementation Strategy

- **MVP**: Phases 1–4 (US1+US2) → OpenAPI explorer live + JWT enforcement with consistent `ApiError`.
- **Full**: + US3 (health) + US4 (dispatch/envelope) + Polish.
- **#133 readiness check**: after T030, adding a new command must require only a new `@Component CommandHandler` in a new feature package — zero edits to `CommandController`/`CommandDispatcher`/`SecurityConfig`. If that's not true, the abstraction is wrong.

## Notes

- 33 tasks. Every abstraction maps to scheduled Epic #118 (#133) work — see plan.md Complexity Tracking. No speculative generality.
- Skill compliance is per-task, not a phase: package-by-feature, constructor injection, `@ConfigurationProperties`, DTOs, test slices, parameterized SLF4J throughout.
- No Supabase schema/RLS/migration. No E2E (no UI).
- `SUPABASE_JWT_SECRET` must exist as a GitHub Actions repo secret before CI passes; locally, absence is intentional fail-closed (context won't start).

---

## Build & Compilation Fixes

**Maven Java 17 Target Issue**: Spring Boot 3.3.5 parent pom uses Maven compiler plugin in a way that 
ignores `<target>17</target>` and `<source>17</source>` properties, resulting in Java 21 bytecode 
(version 65.0) instead of Java 17 (version 61.0).

**Fix Applied**: Added explicit fork mode and javac executable to `pom.xml` maven-compiler-plugin:
```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.10.1</version>
    <configuration>
        <source>17</source>
        <target>17</target>
        <fork>true</fork>
        <executable>javac</executable>
    </configuration>
</plugin>
```

This forces Maven to invoke system javac directly instead of using the parent pom's release parameter,
ensuring Java 17 bytecode output. Also updated `.github/workflows/java-ci.yml` to use `java-version: '17'`
for CI consistency.

**Test HTTP Client Issue**: Tests using TestRestTemplate with 401+body payloads fail with
"cannot retry due to server authentication, in streaming mode" — a known Java URLConnection limitation.
Future work: switch affected tests to MockMvc or configure RestTemplate with custom HttpClient.
Compilation itself is fully functional.
