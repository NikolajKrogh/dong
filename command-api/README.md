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

**2. Create `.env` and boot the service:**

```bash
cd command-api
cp .env.example .env      # then fill in the three SUPABASE_* values
./mvnw.cmd spring-boot:run
```

`command-api/.env` is loaded automatically (`spring.config.import` in
`application.yml`) — **nothing needs exporting into your shell**. It is parsed as a
Java properties file, so leave values unquoted. Real environment variables take
precedence over it, so container/CI injection keeps working unchanged and `.env`
acts purely as a local default.

### Getting a bearer token for manual testing

Tokens must be signed with a Supabase JWT Signing Key (ES256/RS256); the legacy
shared HS256 secret is no longer accepted. The local Supabase CLI serves an ES256
key set out of the box, so no `signing_keys_path` configuration is needed:

```bash
npx supabase gen bearer-jwt --role authenticated --sub ef0493c9-3582-425f-a362-aef909588df7
```

Press Enter at the signing-key prompt to use the local default key. Verify the local
key set is being served with:

```bash
curl http://127.0.0.1:55321/auth/v1/.well-known/jwks.json
```

### Auth failure semantics

| Situation | Status |
| --------- | ------ |
| No / malformed / expired / forged token, or `role != authenticated` | `401 UNAUTHORIZED` |
| Supabase JWKS endpoint unreachable **and** no cached key set | `503 SERVICE_UNAVAILABLE` |

The 503 case is deliberate: Nimbus reports an unreachable key set and a forged
signature as the same exception type, and answering 401 during an upstream outage
pushes clients into discarding a valid session. Key sets are cached for 5 minutes
and served for up to an hour during an outage, so a brief JWKS blip is invisible.
`exp` is enforced with **zero** clock skew (Nimbus would otherwise default to 60s).

**3. Open the API explorer:**
Navigate to **`http://localhost:8080/swagger-ui.html`** in your browser.

You should see the DONG Command API title with a `bearerAuth` security scheme. Ready to test.

## Architecture

Designed so the public match-discovery endpoint and later command work stay additive, not invasive (see `specs/014-java-command-api/`):

- **Strategy + Registry** — `CommandHandler` beans resolved by `CommandDispatcher`
- **Enum-backed errors** — single `ApiException(ErrorCode)`, one serialization egress
- **Port/Adapter** — `SupabaseClient` (Spring `RestClient`)
- **Type-safe config** — `SupabaseProperties` (missing JWKS URL ⇒ fail-closed startup)
- **Typed principal** — `AuthenticatedHost`
- **Correlation-id MDC** filter for traceable structured logs

Package-by-feature: `command/` (what it does) vs `security/ supabase/ health/
observability/ error/` (how it runs).

## Prerequisites

- Java 17 (Temurin/Microsoft OpenJDK)
- No Maven install needed — use the bundled `./mvnw` wrapper

## Configuration

```bash
cp .env.example .env   # loaded automatically; no shell exports needed
```

| Variable              | Purpose                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| `SUPABASE_JWKS_URL`   | JWKS endpoint used to verify Supabase JWT signatures (ES256/RS256). Absent ⇒ service refuses to start (fail-closed). |
| `SUPABASE_URL`        | Supabase base URL for the health indicator.                                            |
| `SUPABASE_ANON_KEY`   | Sent as the `apikey` header. **Required against a hosted project** — Supabase's gateway returns 401 `No API key found in request` without it, leaving the `supabase` health component DOWN. |

`SUPABASE_JWKS_URL` and `SUPABASE_URL` are independent — getting the JWKS one wrong
breaks all authentication while leaving the rest of the service healthy, so it has
its own health component (below). For local Supabase both point at the port in
`supabase/config.toml` `[api]` (currently `55321`, **not** the upstream default 54321).
| `COMMAND_API_MATCH_DISCOVERY_TTL` | Optional cache TTL for repeated identical match lookups. Defaults to `PT5M`. |
| `COMMAND_API_MATCH_DISCOVERY_ESPN_BASE_URL` | Optional ESPN soccer API base URL override. Defaults to the public ESPN soccer site API. |

## Run

```bash
export SUPABASE_JWKS_URL=... SUPABASE_URL=http://127.0.0.1:54321
./mvnw spring-boot:run
```

- Health: `GET http://localhost:8080/actuator/health` — two Supabase components contribute:
  `supabase` (base-URL reachability) and `supabaseJwks` (can the signing keys actually be
  resolved). The second is what catches a wrong `SUPABASE_JWKS_URL`, which would otherwise
  start cleanly and then reject every authenticated request.
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
$env:SUPABASE_JWKS_URL = "https://example.invalid/.well-known/jwks.json"
$env:SUPABASE_URL = "http://localhost:9"
.\mvnw.cmd --% -Dtest=MatchNormalizationTest,MatchDiscoveryServiceTest,MatchCacheServiceTest,MatchDiscoveryControllerTest,MatchDiscoveryPerformanceTest test
```

See `specs/014-java-command-api/quickstart.md` for end-to-end validation.
