# DONG Game API

API for authenticated multiplayer room actions and public football-match discovery.
Spring Boot 3.5.3 / Java 17. Supabase owns persistent game state; this service
authenticates start-game requests, coordinates duplicate requests, and forwards
operations to the appropriate Supabase RPC or Edge endpoint.

## Quick Start

**1. Compile the Java:**

```bash
cd game-api
./mvnw.cmd clean verify
```

The project should compile cleanly and the focused validation actions below should pass. (On Windows, use `.\mvnw.cmd`; on macOS/Linux, use `./mvnw`.)

**2. Create `.env` and boot the service:**

```bash
cd game-api
cp .env.example .env      # then fill in the three SUPABASE_* values
./mvnw.cmd spring-boot:run
```

`game-api/.env` is loaded automatically (`spring.config.import` in
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

You should see the DONG Game API title with a `bearerAuth` security scheme. Ready to test.

## Architecture

Room actions and football-match discovery have separate feature packages:

- **Strategy + Registry** — `RoomActionHandler` beans resolved by `RoomActionDispatcher`
- **Enum-backed errors** — single `ApiException(ErrorCode)`, one serialization egress
- **Supabase integration** — `SupabaseHealthProbe` / `HttpSupabaseHealthProbe` for health; `SupabaseRpcClient` for authenticated database operations
- **Type-safe config** — `SupabaseProperties` (missing JWKS URL ⇒ fail-closed startup)
- **Typed principal** — `AuthenticatedHost`
- **Correlation-id MDC** filter for traceable structured logs

Package-by-feature: `roomaction/` and `footballmatch/` vs `security/ supabase/ health/
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
- Room actions: `POST /v1/rooms/{roomId}/actions/start-game` (Bearer JWT + `Idempotency-Key: <uuid v4>`). The body can contain `{"payload":{"relaxConstraints":true}}` after the host approves the assignment shortfall. Completed duplicate requests return the saved result; an in-flight duplicate has a bounded polling budget. Acknowledgements contain `actionType`, `roomId`, `idempotencyKey`, `status` and `timestamp`. `IdempotencyStubGuardTest` ensures the persistent implementation is wired.
- Match discovery: `GET /v1/matches` forwards public selections to Supabase `discover-matches`, in batches of at most 16 league codes. Postgres owns shared acquisition and freshness; Java makes no ESPN calls and keeps no discovery cache. Source event IDs remain `id`; `catalogMatchId` is additive and remains a string. An explicit `requestedAt` uses its own offset's calendar date, within seven days of today UTC. Nonempty partial saved results are returned; an empty list is successful only when every requested group is available and known empty. Cold/unavailable empty data returns `503`.
- Room processing: a committed `room_processing_pending` result retries the same RPC key/payload at most twice after one second. Exhaustion returns HTTP 200 with `{ "ok": false, "code": "room_processing_pending", "retryAfterSeconds": 1 }`. It does not emit an accepted acknowledgement or complete the terminal idempotency cache. Stale preconditions remain conflicts; Java does not rebase them.

Dev CORS for the Expo web client: `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`

## Test

```bash
./mvnw test       # unit + slice tests
./mvnw verify     # full build + tests (what CI runs)
```

Focused match-discovery validation on PowerShell:

Supported leagues come from the versioned `constants/leagueCatalog.json`, bundled by both the app and ESPN transport, with matching saved Postgres identities verified by `npm run check:league-catalog`. Java validates identifier syntax and request bounds, and preserves the catalog's unsupported-league and invalid-date errors as HTTP 400 responses. There is no separate Java league list or frontend league-metadata request.

```powershell
$env:SUPABASE_JWKS_URL = "https://example.invalid/.well-known/jwks.json"
$env:SUPABASE_URL = "http://localhost:9"
.\mvnw.cmd --% -Dtest=MatchCatalogClientTest,MatchDiscoveryServiceTest,MatchDiscoveryControllerTest,SupabaseRestClientTest,RoomActionControllerTest,RoomActionDispatcherTest,PersistentIdempotencyServiceTest test
```

See `specs/014-java-command-api/quickstart.md` for end-to-end validation.
