# CLAUDE.md

This is a polyglot monorepo containing three distinct subsystems:

- **Expo/React Native client** (TypeScript, root) — the DONG mobile/web app
- **`game-api/`** — Java 17 / Spring Boot 3.5.3 proxy service (own Maven build)
- **`supabase/`** — PostgreSQL migrations and pgTAP database tests (Supabase CLI)
- **`python/`** — utility scripts (`crop_icons.py`), not part of the app runtime

The authoritative project constitution is at [`.specify/memory/constitution.md`](.specify/memory/constitution.md) — read it before making architectural decisions or writing plans.

---

## Commands

### Client (Expo / React Native)

```bash
npm install               # install dependencies
npm run auth:env          # bootstrap .env.local from linked Supabase project
npm test                  # Jest unit tests
npm run lint              # ESLint
npm run bdd:gen           # regenerate BDD step scaffolding from .feature files
npm run test:e2e          # bddgen + Playwright (requires Expo web running)
npx expo start --dev-client   # dev server (native)
npx expo start --web          # dev server (web)
```

### Java game-api

```powershell
# Windows (PowerShell) — from repo root or game-api/
cd game-api
.\mvnw.cmd clean verify           # full build + tests (what CI runs)
.\mvnw.cmd test                   # unit + slice tests only
.\mvnw.cmd spring-boot:run        # run service on :8080 (set env vars first)
```

Config for the Java service lives in `game-api/.env`, which Spring Boot loads
automatically (`spring.config.import` in `application.yml`) — no shell exports needed.
Start from `cp game-api/.env.example game-api/.env`. It is parsed as a Java
properties file, so leave values unquoted; real environment variables override it.

Required keys: `SUPABASE_JWKS_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` (the last
is required against a hosted project — without it Supabase's gateway returns 401 and
the `supabase` health component stays DOWN).

JWTs are verified against Supabase's published JWT Signing Keys (ES256/RS256) — there
is no shared secret. Mint a test token with
`npx supabase gen bearer-jwt --role authenticated --sub <uuid>`.

### Supabase / database

```bash
npm run db:start          # start local Supabase stack (requires Docker)
npm run db:stop
npm run db:reset          # reset DB and re-run all migrations
npm run db:test           # pgTAP test suite
npm run db:status         # local service health + env values
npm run db:new-migration  # scaffold a new migration file
```

---

## Project Structure

```
app/                      Thin Expo Router entries; preserve framework route filenames
features/                 Feature-owned screens, UI, hooks and operations (kebab-case domains)
components/ui/            Shared reusable UI
platform/                 Platform abstraction adapters (animation, audio, date-input, visibility, gestures)
store/                    Zustand store (AsyncStorage-backed)
lib/                      SDK and query infrastructure setup
types/                    Shared contracts and generated database types
shared/                   Helpers shared by client and Edge runtimes
utils/                    Feature-independent helpers, including idempotencyKey.ts
features/football-matches/ Match discovery adapter, service, schemas and transport
features/rooms/           Room lifecycle operations and startGameClient.ts
supabase/functions/       Edge entry points; shared football-match implementation in _shared/football-matches/
supabase/migrations/      SQL schema migrations (run in order)
supabase/tests/database/  pgTAP tests
game-api/                 Spring Boot service (footballmatch/, roomaction/, security/, etc.)
specs/NNN-*/              Feature specifications (spec.md, plan.md, tasks.md, quickstart.md, …)
e2e/features/             Playwright BDD .feature files
e2e/steps/                Playwright step definitions
```

Feature implementations own their hooks, styles and helpers. Keep shared UI in
`components/ui`, platform behavior in `platform`, and application state in `store`.
Use PascalCase for components and dedicated class files, camelCase for function
modules and `useCamelCase` for hooks. Feature directories use kebab-case; Java
packages use lowercase and class files use PascalCase. Use role suffixes such as
Client, Service, Adapter and Repository only when they describe the implementation.
Java health access uses `SupabaseHealthProbe` / `HttpSupabaseHealthProbe`; authenticated
RPC access uses `SupabaseRpcClient`. Domain vocabulary should agree across runtimes,
without forcing identical filenames for different roles or treating projections as
identical contracts. Prefer narrow named module entry points; Account, Friends,
History and Preferences expose their focused public indexes. Tests mirror ownership
under `__tests__/features/<feature>/` or the appropriate shared directory.

---

## Key Rules

### Use platform/ adapters
Always import from `platform/` instead of the underlying platform-sensitive packages (`expo-av`, `react-native-gesture-handler`, etc.) directly. Adapters keep web/native parity and are the correct extension point for new platform behavior.

### Skill-first AI execution
Check `.agents/skills/` before any research, planning, implementation, or review. When a relevant `SKILL.md` exists, load and follow it first. See constitution §VI.

### Testing requirements (constitution §V)
- Every new feature **must** ship with unit tests before merge.
- Any substantial UI change (new flow, major navigation, interaction redesign) **must** add at least one Playwright BDD e2e test covering the primary user journey.
- Test file convention: `*.platform.test.tsx` for component tests, `*.test.ts` for hook/utility tests, `*.feature` + step files for e2e.
- DB changes must include pgTAP tests under `supabase/tests/database/`.
- Run `npm test && npm run lint` before opening a pull request.

### Spec-driven workflow
New features live in `specs/NNN-<slug>/`. A complete spec includes `spec.md`, `plan.md`, `tasks.md`, and `quickstart.md`. Constitution Check is required before Phase 0 research closes and after Phase 1 design.

### Supabase-first, Java by exception (constitution §IV)
Use Supabase Auth, Postgres, and RPC by default. The Java `game-api` exists only for orchestration, secrets handling, and external integration (currently: ESPN match proxy). Do not add duplicate CRUD layers.

### Env setup
Copy env values with `npm run auth:env`. To wire the client to the local Java service, add to `.env.local`:

```env
EXPO_PUBLIC_GAME_API_URL=http://localhost:8080
```

Restart Expo with `-c` after changing `.env.local` — `EXPO_PUBLIC_*` values are
inlined at bundle time, so a plain restart keeps serving the old value.

`localhost` works for the web build directly. For a physical Android device it needs
a reverse tunnel, the same mechanism Metro uses for its own port:

```bash
npm run android:tunnel   # adb reverse tcp:8080 tcp:8080
```

Prefer this over the machine's LAN IP: no inbound firewall rule is involved (a
blocked one manifests as a *timeout*, not a refusal, which is easy to misread), and
it survives the host's DHCP address changing. Re-run it whenever the device
reconnects — reverse tunnels do not persist across USB re-attach.

---

## Architecture Notes

- **State**: Zustand + AsyncStorage is canonical on-device. Supabase Postgres backs multiplayer/synced state. No other persistence layer.
- **Cloud queries**: TanStack Query owns account-scoped Friends/History server data in memory; auth changes cancel/remove private caches and fence delayed callbacks. See [development workflow](docs/development-workflow.md) for boundaries, generated contracts and migration tooling.
- **Auth**: Supabase Auth. Signed-in = host. Guests join via room code and are session-scoped identities.
- **Match Catalog**: maintained clients discover through `discover-matches`, maintain finite solo tracking, and read saved individual matches through `read_saved_matches`. Postgres owns source demand, budgets, leases and room replay; the bounded Edge monitor is the sole maintained ESPN transport. Java `GET /v1/matches` forwards for compatibility without a source cache or fallback. Acquisition and the owned Cron job stay disabled until reviewed activation.
- **Tamagui**: design system foundation. New UI work should use Tamagui components and move toward the palette defined in `styles/`.
- **Supabase project ref**: `qccvlhblytuedgmlqfef` (MCP config in `.mcp.json`).

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/031-per-player-match-counts/plan.md
<!-- SPECKIT END -->
