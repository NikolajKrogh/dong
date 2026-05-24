# Implementation Plan: Bootstrap Java Command API

**Branch**: `132-us41-bootstrap-java-command-api` | **Date**: 2026-05-16 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/014-java-command-api/spec.md`

## Summary

Bootstrap a standalone Spring Boot service (`command-api/`) that provides Supabase-JWT-authenticated command endpoints, auto-generated OpenAPI documentation, Spring Actuator health/readiness probes, and structured-log + metrics observability. The service is stateless at this stage — it validates credentials per request and exposes one stub command endpoint demonstrating the standard request/response envelope.

The architecture is deliberately shaped so that the **scheduled** downstream work in Epic #118 (#133 ESPN proxy + real room/gameplay commands) is **additive, not invasive**: new commands plug in as Strategy beans, new errors as enum constants, new external integrations as Adapter ports — none of which touch the controller or dispatcher.

## Technical Context

**Language/Version**: Java 17 LTS (baseline for Spring Boot 3.3.x; supported through 2029)  
**Primary Dependencies**: Spring Boot 3.3.x (web, security, actuator, validation), springdoc-openapi-starter-webmvc-ui 2.5.x, JJWT 0.12.x (HS256), `logstash-logback-encoder`, Spring `RestClient` (bundled in spring-web, Boot 3.2+)  
**Storage**: N/A — service is stateless; no database at this stage  
**Testing**: JUnit 5 + Mockito; `@WebMvcTest` slices for controllers/filters, `@SpringBootTest(webEnvironment=RANDOM_PORT)` for integration; test tree mirrors `src/main` package-for-package  
**Applicable Skills**: `java-springboot` (Spring Boot structure, constructor DI, `@ConfigurationProperties`, test slices, Spring Security — **loaded and followed**), `openapi-to-application-code` (OpenAPI contract + layer organization — **loaded and followed**), `gh-cli` (CI workflow). Recorded per Constitution Principle VI.  
**Target Platform**: JVM / Java 21, Linux (CI) and Windows (local dev)  
**Project Type**: web-service (REST API, Spring Boot)  
**Performance Goals**: <500ms p95 authenticated stub (SC-007); <100ms rejection (SC-002)  
**Constraints**: No hardcoded secrets; type-safe externalized config; single instance; no Supabase business calls in this bootstrap  
**Scale/Scope**: Single-instance bootstrap; scaling, rate limiting, distributed tracing out of scope

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

- **Cross-Platform** (I): No UI; platform-agnostic HTTP API. N/A. ✅
- **Server-Authoritative Shared State** (II): Stateless; no shared game state. Idempotency key presence + UUID v4 format validated behind an `IdempotencyService` seam; dedup storage out of scope per spec. ✅
- **Event-Backed Game History** (III): No gameplay mutations at this stage. ✅
- **Supabase-First, Custom Backend by Exception** (IV): Java introduced — justified in Complexity Tracking. ✅
- **Story-First Delivery With Required Coverage** (V): 4 independently deliverable stories with Gherkin criteria; unit + integration tests per story; no UI → no E2E. ✅
- **Skill-First AI Execution** (VI): `java-springboot` + `openapi-to-application-code` skills identified, loaded, and applied throughout this plan (package-by-feature, constructor injection, `@ConfigurationProperties`, global exception handling, test slices, DTOs). ✅ *(Corrected: prior revision incorrectly recorded NONE IDENTIFIED — see research.md ADR-0.)*

## Architecture & Design Patterns

Patterns chosen to keep the code clean and the downstream epic additive. Full rationale in [research.md](research.md).

| Concern | Pattern | Shape |
|---------|---------|-------|
| Command processing | **Strategy + Registry** | `CommandHandler` port; `CommandDispatcher` resolves `commandType` → handler via Spring-injected `Map<String,CommandHandler>`. #133 adds a `@Component` handler and touches nothing else |
| Error model | **Enum-backed exception** | One `ApiException(ErrorCode)`; `ErrorCode` enum carries `{httpStatus, code, defaultMessage}`. New error = new enum constant, **zero** new handlers |
| Error serialization | **Single egress** | `GlobalExceptionHandler` (`@RestControllerAdvice`) **plus** Spring Security `AuthenticationEntryPoint` (401) and `AccessDeniedHandler` (403) beans all emit the *same* `ApiError`. The JWT filter throws `AuthenticationException` — it never writes the response itself |
| External calls | **Port / Adapter** | `SupabaseClient` port + `RestClientSupabaseClient` impl. Health depends on the port (mockable). #133 ESPN proxy reuses the same adapter shape |
| Config | **Type-safe properties** | `SupabaseProperties` (`@ConfigurationProperties @Validated`, `@NotBlank`). Missing secret → context fails to start = the FR-013 fail-closed startup guarantee, for free |
| Auth identity | **Typed principal** | JWT filter sets `AuthenticatedHost(hostId, role)` as the security principal; handlers get it via `@AuthenticationPrincipal` — no re-parsing downstream |
| Request tracing | **Chain of Responsibility + MDC** | Filter order: `CorrelationIdFilter` → `SupabaseJwtFilter` → controller. Correlation id in SLF4J MDC; Logstash encoder emits it. Cheap now, painful to retrofit |
| Idempotency | **Seam (no-op now)** | `IdempotencyService` interface + `NoOpIdempotencyService` (format-validate only). #133 swaps in persistence with no controller churn |

**Result/Response boundary rule**: handlers return `CommandResult` (handler-internal, may carry domain detail); the controller maps `CommandResult` → `CommandResponse` (the wire DTO). Handler internals never leak to clients.

## Project Structure

### Documentation (this feature)

```text
specs/014-java-command-api/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/command-envelope.md
└── tasks.md
```

### Source Code — package-by-feature (java-springboot skill)

Navigation contract: **feature packages answer "what the service does"; platform packages answer "how it runs."** One concept per package; the package name is the answer to a question a developer asks. No single-file packages. The test tree mirrors this exactly.

```text
command-api/                              # New top-level dir (peer to app/, supabase/)
├── pom.xml · mvnw · mvnw.cmd · .mvn/
├── .env.example · README.md              # skill-mandated supporting files
└── src/
    ├── main/
    │   ├── java/com/dong/commandapi/
    │   │   ├── CommandApiApplication.java         # entry point (root, Spring convention)
    │   │   ├── OpenApiConfig.java                 # root — not a single-file package
    │   │   │
    │   │   ├── command/                           # FEATURE: command surface & dispatch
    │   │   │   ├── CommandController.java          #   thin: parse → dispatch → map
    │   │   │   ├── CommandDispatcher.java          #   Registry
    │   │   │   ├── CommandHandler.java             #   Strategy port
    │   │   │   ├── CommandContext.java             #   handler input
    │   │   │   ├── CommandResult.java              #   handler output (internal)
    │   │   │   ├── EchoCommandHandler.java         #   the only handler shipped here (stub)
    │   │   │   ├── idempotency/
    │   │   │   │   ├── IdempotencyService.java
    │   │   │   │   └── NoOpIdempotencyService.java
    │   │   │   └── dto/
    │   │   │       ├── CommandRequest.java         #   wire in
    │   │   │       └── CommandResponse.java        #   wire out
    │   │   │
    │   │   ├── security/                          # PLATFORM: authentication
    │   │   │   ├── SecurityConfig.java
    │   │   │   ├── SupabaseJwtFilter.java          #   throws AuthenticationException
    │   │   │   ├── ApiAuthenticationEntryPoint.java#   401 → ApiError
    │   │   │   ├── ApiAccessDeniedHandler.java     #   403 → ApiError
    │   │   │   └── AuthenticatedHost.java          #   typed principal
    │   │   │
    │   │   ├── supabase/                          # PLATFORM: Supabase integration boundary
    │   │   │   ├── SupabaseProperties.java         #   @ConfigurationProperties @Validated
    │   │   │   ├── SupabaseClient.java             #   port
    │   │   │   └── RestClientSupabaseClient.java   #   adapter (Spring RestClient)
    │   │   │
    │   │   ├── health/                            # PLATFORM: readiness
    │   │   │   └── SupabaseHealthIndicator.java    #   depends on supabase.SupabaseClient
    │   │   │
    │   │   ├── observability/                     # PLATFORM: tracing
    │   │   │   └── CorrelationIdFilter.java
    │   │   │
    │   │   └── error/                             # PLATFORM: shared error model (leaf)
    │   │       ├── ApiException.java
    │   │       ├── ErrorCode.java                  #   enum: status + code + message
    │   │       ├── ApiError.java                   #   wire DTO
    │   │       └── GlobalExceptionHandler.java
    │   └── resources/
    │       ├── application.yml
    │       ├── application-dev.yml                 # dev-only CORS (grep-able, not silent)
    │       └── logback-spring.xml                  # JSON encoder + MDC correlationId
    └── test/java/com/dong/commandapi/              # mirrors src/main exactly
        ├── ApiDiscoverabilityTest.java
        ├── command/CommandControllerTest.java · CommandDispatcherTest.java
        ├── security/SupabaseJwtFilterTest.java
        └── health/HealthEndpointTest.java
```

**Internal dependency direction** (acyclic): `command/` → `error/`; `security/` → `error/`, `supabase/`; `health/` → `supabase/`; `supabase/` → (no internal deps); `error/` and `observability/` are leaves. `supabase/` owns Supabase config so `security/` and `health/` depend *forward* onto the integration boundary — never the reverse.

**For #133**: ESPN proxy + match commands arrive as a new sibling **feature** package `match/` (controller + `match/EspnClient` adapter + `match/*CommandHandler` implementing `command.CommandHandler`). `command/` stays pure dispatch infrastructure.

Root-level changes: `.gitignore` (+`command-api/target/`, `command-api/.mvn/`), `.easignore` (+`command-api/`), new `.github/workflows/java-ci.yml` scoped to `command-api/**`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|-----------|--------------------------------------|
| New Java service (Principle IV exception) | Orchestration of multi-step room commands across Supabase aggregates; secrets handling for ESPN proxy credentials; cross-aggregate validation not expressible in Supabase RLS alone | Supabase Edge Functions can't hold long-lived secrets safely; RPC functions can't orchestrate external HTTP; exposing service-role keys to the client is a security violation |
| 8 abstractions in a "bootstrap" | Each maps to **scheduled** Epic #118 work (#133): Strategy/Registry → real command handlers; ErrorCode → every future error; SupabaseProperties → service-role calls; AuthenticatedHost → every command needs hostId; SupabaseClient port → ESPN/Supabase calls; CorrelationId → multi-step command tracing; IdempotencyService → real dedup; EntryPoint/AccessDeniedHandler → consistent errors | Inlining now means #133 rewrites the controller (god-class switch), forks the error path, and re-parses JWTs — invasive churn on a security-critical surface. None of these are speculative; all are named in Epic #118 |

## Phase 0: Research — Complete

All unknowns resolved. See [research.md](research.md) (ADR-0 records the skill-identification correction; ADR-1..ADR-8 record the architecture decisions above). Key infra decisions unchanged: HS256 (confirmed — `signing_keys_path` commented out in `supabase/config.toml`), JJWT 0.12.x, Spring Boot 3.3.x, springdoc 2.5.x, Maven wrapper, Logback JSON, Micrometer/Actuator.

**Constitution re-check (post-Phase 0)**: All six gates ✅. Principle VI now satisfied (skills loaded/applied). No new violations.

## Phase 1: Design — Complete

| Artifact | Status |
|----------|--------|
| [data-model.md](data-model.md) | Updated — `CommandContext`/`CommandResult` vs `CommandRequest`/`CommandResponse` boundary, `ErrorCode`, `AuthenticatedHost` |
| [contracts/command-envelope.md](contracts/command-envelope.md) | Error table maps 1:1 to `ErrorCode` enum constants |
| [quickstart.md](quickstart.md) | Local setup, env vars, test JWT, CI notes |

**Constitution re-check (post-Phase 1)**: All gates ✅. No DB/RLS/migration. Fail-closed (FR-013) realized structurally via `@Validated SupabaseProperties` (startup) + `AuthenticationEntryPoint` (request). Test strategy covers all four stories at unit + integration level.
