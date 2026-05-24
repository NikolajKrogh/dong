# Contract: Command Envelope

**Feature**: `specs/014-java-command-api`  
**Version**: v1  
**Date**: 2026-05-16

## Endpoint

```
POST /v1/rooms/{roomId}/commands/{commandType}
```

| Parameter | Location | Type | Constraints |
|-----------|----------|------|-------------|
| `roomId` | Path | `String` | Non-empty; not validated for existence at bootstrap stage |
| `commandType` | Path | `String` | Non-empty; echoed in response; not validated against a registry at bootstrap stage |

---

## Required Headers

| Header | Format | Example | Behaviour on violation |
|--------|--------|---------|------------------------|
| `Authorization` | `Bearer <JWT>` | `Bearer eyJ...` | 401 + `ApiError(UNAUTHORIZED)` |
| `Idempotency-Key` | UUID v4 | `f47ac10b-58cc-4372-a567-0e02b2c3d479` | 422 + `ApiError(MISSING_IDEMPOTENCY_KEY)` if absent; 422 + `ApiError(INVALID_UUID)` if present but not UUID v4 |
| `Content-Type` | `application/json` | `application/json` | 415 if body is present and content type is wrong |

---

## Request Body

Optional JSON object. Ignored at bootstrap stub stage; reserved for real command payloads in downstream issues.

```json
{
  "payload": {}
}
```

---

## Success Response — 200 OK

Bootstrap ships one handler: command type `echo`. Other types (e.g.
`start-round`) return `422 UNKNOWN_COMMAND` until #133 registers them.

```json
{
  "commandType": "echo",
  "roomId": "room-abc-123",
  "idempotencyKey": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "ACCEPTED",
  "timestamp": "2026-05-16T12:34:56.789Z"
}
```

---

## Error Responses

All error responses share the `ApiError` envelope:

```json
{
  "error": "<ERROR_CODE>",
  "message": "<human-readable description>",
  "timestamp": "2026-05-16T12:34:56.789Z"
}
```

| HTTP Status | `error` code | Condition |
|-------------|-------------|-----------|
| 401 | `UNAUTHORIZED` | Missing, expired, tampered, or wrong-role JWT |
| 403 | `FORBIDDEN` | Valid JWT but insufficient permissions (future use) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Non-JSON body with wrong Content-Type |
| 422 | `MISSING_IDEMPOTENCY_KEY` | `Idempotency-Key` header absent |
| 422 | `INVALID_UUID` | `Idempotency-Key` present but not a valid UUID v4 |
| 422 | `UNKNOWN_COMMAND` | `commandType` has no registered handler in the dispatcher |
| 500 | `INTERNAL_ERROR` | Unhandled server error |
| 503 | `SERVICE_UNAVAILABLE` | Auth dependency unreachable (fail-closed) |

---

## JWT Validation Rules

The `Authorization: Bearer` token is validated against these rules before any business logic:

1. Signature verified using HS256 with `SUPABASE_JWT_SECRET`
2. `exp` claim is in the future (token not expired)
3. `sub` claim is non-empty
4. `role` claim equals `authenticated` (tokens with `role=anon` are rejected)

If any rule fails → **401 UNAUTHORIZED** immediately; no further processing.

If auth service is unreachable during validation → **503 SERVICE_UNAVAILABLE** (fail-closed per FR-013).

---

## Versioning

All command endpoints are mounted under `/v1/`. The version prefix is incremented only when a breaking change is introduced (per FR-014). Non-breaking additions (new command types, optional request fields, new response fields) do not require a version bump.
