# Data Model: Bootstrap Java Command API

**Feature**: `specs/014-java-command-api`  
**Date**: 2026-05-16

## Overview

The Java command API is **stateless at this bootstrap stage** — it persists no data and owns no database tables. All entities below are in-memory request/response structures (Java records or classes). Supabase Postgres is not accessed by this service in this issue.

---

## Request / Response Entities

### CommandRequest

Represents the parsed body of an incoming command.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `payload` | `Map<String, Object>` (nullable) | Optional free-form JSON | Ignored at stub stage; reserved for real commands |

**Headers** (not part of body, validated separately):

| Header | Type | Constraints |
|--------|------|-------------|
| `Authorization` | `String` | `Bearer <JWT>` format; JWT must be HS256, unexpired, `role=authenticated` |
| `Idempotency-Key` | `String` | UUID v4 format (`[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}`); required |

---

### CommandContext (handler input — internal)

Built by `CommandController`, passed to `CommandDispatcher` → `CommandHandler`. Never serialized to the wire.

| Field | Type | Notes |
|-------|------|-------|
| `roomId` | `String` | From path |
| `commandType` | `String` | From path |
| `idempotencyKey` | `UUID` | Parsed/validated from header |
| `host` | `AuthenticatedHost` | The authenticated caller (see below) |
| `payload` | `Map<String, Object>` (nullable) | From request body |

### CommandResult (handler output — internal)

Returned by a `CommandHandler`. May carry domain detail. The controller maps it to `CommandResponse`; **handler internals never leak to clients** (boundary rule, plan.md).

| Field | Type | Notes |
|-------|------|-------|
| `status` | enum `ACCEPTED` (extensible) | Stub returns `ACCEPTED` |
| `detail` | `Map<String, Object>` (nullable) | Handler-internal; not exposed in v1 response |

### CommandResponse (wire out)

The acknowledgement envelope serialized to the client.

| Field | Type | Notes |
|-------|------|-------|
| `commandType` | `String` | Echoed from path |
| `roomId` | `String` | Echoed from path |
| `idempotencyKey` | `String` | Echoed from header |
| `status` | `String` (`ACCEPTED`) | Mapped from `CommandResult.status` |
| `timestamp` | `Instant` (ISO-8601) | Server-assigned |

---

### AuthenticatedHost (security principal — internal)

Set by `SupabaseJwtFilter` into the Spring Security context after JWT validation. Obtained by handlers via `@AuthenticationPrincipal`.

| Field | Type | Source claim |
|-------|------|--------------|
| `hostId` | `String` | JWT `sub` |
| `role` | `String` | JWT `role` (always `authenticated` here) |

---

### ErrorCode (enum) + ApiError (wire out)

`ErrorCode` is the single source of truth for failures — each constant carries `{httpStatus, code, defaultMessage}`. `ApiException(ErrorCode)` is the only custom exception. `ApiError` is the serialized shape; it is emitted identically by `GlobalExceptionHandler`, `ApiAuthenticationEntryPoint` (401), and `ApiAccessDeniedHandler` (403).

| `ErrorCode` constant | HTTP | `error` value |
|----------------------|------|---------------|
| `UNAUTHORIZED` | 401 | `UNAUTHORIZED` |
| `FORBIDDEN` | 403 | `FORBIDDEN` |
| `MISSING_IDEMPOTENCY_KEY` | 422 | `MISSING_IDEMPOTENCY_KEY` |
| `INVALID_UUID` | 422 | `INVALID_UUID` |
| `UNKNOWN_COMMAND` | 422 | `UNKNOWN_COMMAND` |
| `INTERNAL_ERROR` | 500 | `INTERNAL_ERROR` |
| `SERVICE_UNAVAILABLE` | 503 | `SERVICE_UNAVAILABLE` |

`ApiError` fields: `error` (String, = `ErrorCode.code`), `message` (String), `timestamp` (Instant ISO-8601). Adding a failure mode = adding an enum constant; **no new exception class, no new handler**.

---

### HealthStatus (Actuator-managed)

Provided by Spring Boot Actuator + `SupabaseHealthIndicator`. Not a custom entity — maps to the standard Actuator health response shape.

| Field | Type | Notes |
|-------|------|-------|
| `status` | `String` (enum: `UP`, `DOWN`, `OUT_OF_SERVICE`) | Aggregate status |
| `components.supabase.status` | `String` | `UP` or `DOWN` based on Supabase `/auth/v1/health` reachability |
| `components.supabase.details.url` | `String` | Supabase URL being checked |

---

## Authentication Token Claims (read-only, not persisted)

The JWT extracted from `Authorization: Bearer` is validated but not stored. Required claims:

| Claim | Type | Validation |
|-------|------|------------|
| `sub` | `String` | Non-empty (Supabase user UUID) |
| `role` | `String` | Must equal `authenticated`; `anon` or absent → 401 |
| `exp` | `long` (Unix epoch) | Must be in the future |
| `iss` | `String` | Informational; not enforced at bootstrap stage |

---

## No Supabase Schema Changes

This feature introduces **no database migrations**, **no new Postgres tables**, **no RLS policy changes**, and **no Supabase Edge Functions**. The Java service is a standalone process. All Supabase schema work is handled in earlier issues (#125, #128).
