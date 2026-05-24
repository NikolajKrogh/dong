# Quickstart: Bootstrap Java Command API

**Feature**: `specs/014-java-command-api`  
**Date**: 2026-05-16

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 21 LTS | `java -version` should report `21.x` |
| Maven | 3.9.x | Or use the included `mvnw` wrapper (no pre-install needed) |
| Supabase CLI | Latest | Required to get a local JWT for testing |

---

## Environment Variables

Create `command-api/.env` (never commit — listed in `.gitignore`):

```env
SUPABASE_JWT_SECRET=<your-jwt-secret>
SUPABASE_URL=http://127.0.0.1:54321
```

**Where to find these values:**
- `SUPABASE_JWT_SECRET`: `supabase/config.toml` → `[auth] secret` (or `supabase status` output)
- `SUPABASE_URL`: `http://127.0.0.1:54321` for local Supabase (`supabase start`)

---

## Start the Service

```powershell
cd command-api

# Set env vars for this session (PowerShell)
$env:SUPABASE_JWT_SECRET = "<your-jwt-secret>"
$env:SUPABASE_URL = "http://127.0.0.1:54321"

# Run (uses Maven Wrapper — no Maven install needed)
./mvnw.cmd spring-boot:run
```

Service starts on `http://localhost:8080`.

---

## Verify Health

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/actuator/health" | Select-Object -ExpandProperty Content
```

Expected response:
```json
{"status":"UP","components":{"supabase":{"status":"UP"}}}
```

---

## Browse the API Explorer

Open `http://localhost:8080/swagger-ui.html` in a browser.

All documented endpoints, request schemas, and response shapes are visible here. You can send authenticated test requests directly from the UI after clicking **Authorize** and pasting a valid Bearer token.

---

## Get a Test JWT

```powershell
# Start local Supabase
supabase start

# Sign in as a host user and capture the JWT
$response = Invoke-RestMethod -Uri "http://127.0.0.1:54321/auth/v1/token?grant_type=password" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{ "apikey" = "<your-anon-key>" } `
  -Body '{"email":"host@example.com","password":"yourpassword"}'

$JWT = $response.access_token
```

---

## Send a Test Command

The bootstrap ships exactly one handler, command type `echo`. Real commands
(e.g. `start-round`) arrive in #133 — until then an unregistered type correctly
returns `422 UNKNOWN_COMMAND`, which demonstrates the dispatcher working.

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:8080/v1/rooms/room-test/commands/echo" `
  -Method Post `
  -Headers @{
    "Authorization"    = "Bearer $JWT"
    "Idempotency-Key"  = [System.Guid]::NewGuid().ToString()
    "Content-Type"     = "application/json"
  } `
  -Body '{}'
```

Expected response:
```json
{
  "commandType": "echo",
  "roomId": "room-test",
  "idempotencyKey": "<uuid>",
  "status": "ACCEPTED",
  "timestamp": "2026-05-16T..."
}
```

---

## Run Tests

```powershell
cd command-api
./mvnw.cmd test
```

All unit and integration tests must pass in under 2 minutes.

---

## Verify Metrics

After sending at least one request:

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/actuator/metrics/http.server.requests" |
  Select-Object -ExpandProperty Content
```

Expected: JSON with `measurements` showing request count and latency for the endpoint.

---

## CI

The GitHub Actions workflow `.github/workflows/java-ci.yml` runs automatically on pushes that change any file under `command-api/**`. It requires the `SUPABASE_JWT_SECRET` secret to be configured in the repository's GitHub Actions secrets (Settings → Secrets and variables → Actions).
