# DONG Command API

Supabase-authenticated multiplayer command API. Spring Boot 3.3 / Java 21.

Bootstrap scope (issue #132 / US4.1): authenticated command surface, OpenAPI docs,
health/readiness, structured-log + metrics observability, one stub command endpoint.
Real room/gameplay commands and the ESPN proxy arrive in #133+.

## Architecture

Designed so #133+ is additive, not invasive (see `specs/014-java-command-api/`):

- **Strategy + Registry** — `CommandHandler` beans resolved by `CommandDispatcher`
- **Enum-backed errors** — single `ApiException(ErrorCode)`, one serialization egress
- **Port/Adapter** — `SupabaseClient` (Spring `RestClient`)
- **Type-safe config** — `SupabaseProperties` (missing secret ⇒ fail-closed startup)
- **Typed principal** — `AuthenticatedHost`
- **Correlation-id MDC** filter for traceable structured logs

Package-by-feature: `command/` (what it does) vs `security/ supabase/ health/
observability/ error/` (how it runs).

## Prerequisites

- Java 21 (Temurin/Microsoft OpenJDK)
- No Maven install needed — use the bundled `./mvnw` wrapper

## Configuration

```bash
cp .env.example .env   # then fill in SUPABASE_JWT_SECRET
```

| Variable | Purpose |
|----------|---------|
| `SUPABASE_JWT_SECRET` | HS256 secret to verify Supabase JWTs. Absent ⇒ service refuses to start (fail-closed). |
| `SUPABASE_URL` | Supabase base URL for the health indicator. |

## Run

```bash
export SUPABASE_JWT_SECRET=... SUPABASE_URL=http://127.0.0.1:54321
./mvnw spring-boot:run
```

- Health: `GET http://localhost:8080/actuator/health`
- API explorer: `http://localhost:8080/swagger-ui.html`
- Stub command: `POST /v1/rooms/{roomId}/commands/{commandType}` (Bearer JWT + `Idempotency-Key: <uuid v4>`)

Dev CORS for the Expo web client: `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`

## Test

```bash
./mvnw test       # unit + slice tests
./mvnw verify     # full build + tests (what CI runs)
```

See `specs/014-java-command-api/quickstart.md` for end-to-end validation.
