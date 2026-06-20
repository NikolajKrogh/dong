# DONG Command API

Supabase-authenticated multiplayer command API. Spring Boot 3.3 / Java 17.

Bootstrap scope (issue #132 / US4.1): authenticated command surface, OpenAPI docs,
health/readiness, structured-log + metrics observability, one stub command endpoint,
and the public match-discovery proxy used by the setup-game flow.
Later room/gameplay commands continue in follow-up issues.

## Quick Start

**1. Compile the Java:**

```bash
cd command-api
./mvnw.cmd clean verify
```

The project should compile cleanly and the focused validation commands below should pass. (On Windows, use `.\mvnw.cmd`; on macOS/Linux, use `./mvnw`.)

**2. Set environment variables and boot the service:**

```powershell
# PowerShell (Windows)
$env:SUPABASE_JWT_SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long"
$env:SUPABASE_URL = "http://localhost:9"
$env:COMMAND_API_MATCH_DISCOVERY_TTL = "PT5M"
$env:COMMAND_API_MATCH_DISCOVERY_ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer"
.\mvnw.cmd spring-boot:run
```

Or in bash:

```bash
export SUPABASE_JWT_SECRET="test-secret-which-is-at-least-thirty-two-bytes-long"
export SUPABASE_URL="http://localhost:9"
export COMMAND_API_MATCH_DISCOVERY_TTL="PT5M"
export COMMAND_API_MATCH_DISCOVERY_ESPN_BASE_URL="https://site.api.espn.com/apis/site/v2/sports/soccer"
./mvnw spring-boot:run
```

**3. Open the API explorer:**
Navigate to **`http://localhost:8080/swagger-ui.html`** in your browser.

You should see the DONG Command API title with a `bearerAuth` security scheme. Ready to test.

## Architecture

Designed so the public match-discovery endpoint and later command work stay additive, not invasive (see `specs/014-java-command-api/`):

- **Strategy + Registry** — `CommandHandler` beans resolved by `CommandDispatcher`
- **Enum-backed errors** — single `ApiException(ErrorCode)`, one serialization egress
- **Port/Adapter** — `SupabaseClient` (Spring `RestClient`)
- **Type-safe config** — `SupabaseProperties` (missing secret ⇒ fail-closed startup)
- **Typed principal** — `AuthenticatedHost`
- **Correlation-id MDC** filter for traceable structured logs

Package-by-feature: `command/` (what it does) vs `security/ supabase/ health/
observability/ error/` (how it runs).

## Prerequisites

- Java 17 (Temurin/Microsoft OpenJDK)
- No Maven install needed — use the bundled `./mvnw` wrapper

## Configuration

```bash
cp .env.example .env   # then fill in SUPABASE_JWT_SECRET
```

| Variable              | Purpose                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| `SUPABASE_JWT_SECRET` | HS256 secret to verify Supabase JWTs. Absent ⇒ service refuses to start (fail-closed). |
| `SUPABASE_URL`        | Supabase base URL for the health indicator.                                            |
| `COMMAND_API_MATCH_DISCOVERY_TTL` | Optional cache TTL for repeated identical match lookups. Defaults to `PT5M`. |
| `COMMAND_API_MATCH_DISCOVERY_ESPN_BASE_URL` | Optional ESPN soccer API base URL override. Defaults to the public ESPN soccer site API. |

## Run

```bash
export SUPABASE_JWT_SECRET=... SUPABASE_URL=http://127.0.0.1:54321
./mvnw spring-boot:run
```

- Health: `GET http://localhost:8080/actuator/health`
- API explorer: `http://localhost:8080/swagger-ui.html`
- Stub command: `POST /v1/rooms/{roomId}/commands/{commandType}` (Bearer JWT + `Idempotency-Key: <uuid v4>`). The key is **format-validated only** — there is no deduplication yet (issue #133), so a replayed command re-executes. Safe only while the lone `echo` handler is side-effect free; `IdempotencyStubGuardTest` enforces this.
- Match discovery: `GET /v1/matches` is public and uses the configured supported league allowlist. Each league/date is fetched and cached independently (default `PT5M` TTL, bounded by `cache-maximum-size`), and leagues are fetched in parallel. If some requested leagues are temporarily unavailable, the response returns matches from the healthy leagues rather than failing — only when **every** requested league fails is a `503` surfaced.

Dev CORS for the Expo web client: `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`

## Test

```bash
./mvnw test       # unit + slice tests
./mvnw verify     # full build + tests (what CI runs)
```

Focused match-discovery validation on PowerShell:

```powershell
$env:SUPABASE_JWT_SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long"
$env:SUPABASE_URL = "http://localhost:9"
.\mvnw.cmd --% -Dtest=MatchNormalizationTest,MatchDiscoveryServiceTest,MatchCacheServiceTest,MatchDiscoveryControllerTest,MatchDiscoveryPerformanceTest test
```

See `specs/014-java-command-api/quickstart.md` for end-to-end validation.
