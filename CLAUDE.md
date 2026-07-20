# CLAUDE.md

This is a polyglot monorepo containing three distinct subsystems:

- **Expo/React Native client** (TypeScript, root) — the DONG mobile/web app
- **`command-api/`** — Java 17 / Spring Boot 3.3 proxy service (own Maven build)
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
npm run bddgen            # regenerate BDD step scaffolding from .feature files
npm run test:e2e          # bddgen + Playwright (requires Expo web running)
npx expo start --dev-client   # dev server (native)
npx expo start --web          # dev server (web)
```

### Java command-api

```powershell
# Windows (PowerShell) — from repo root or command-api/
cd command-api
.\mvnw.cmd clean verify           # full build + tests (what CI runs)
.\mvnw.cmd test                   # unit + slice tests only
.\mvnw.cmd spring-boot:run        # run service on :8080 (set env vars first)
```

Required env vars for running/testing the Java service:

```powershell
$env:SUPABASE_JWT_SECRET = "test-secret-which-is-at-least-thirty-two-bytes-long"
$env:SUPABASE_URL        = "http://localhost:9"
```

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
app/                      Expo Router screens (auth/, setupGame, gameProgress, history, userPreferences)
components/               Reusable UI components (grouped by screen domain)
hooks/                    React hooks — useMatchData, useAccountAuth, useGuestRoomJoin, etc.
platform/                 Platform abstraction adapters (animation, audio, date-input, visibility, gestures)
store/                    Zustand store (AsyncStorage-backed)
utils/                    Shared utilities incl. commandApiClient.ts (match discovery API client)
supabase/migrations/      SQL schema migrations (run in order)
supabase/tests/database/  pgTAP tests
command-api/              Spring Boot service (package-by-feature: match/, security/, command/, etc.)
specs/NNN-*/              Feature specifications (spec.md, plan.md, tasks.md, quickstart.md, …)
e2e/features/             Playwright BDD .feature files
e2e/steps/                Playwright step definitions
```

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
Use Supabase Auth, Postgres, and RPC by default. The Java `command-api` exists only for orchestration, secrets handling, and external integration (currently: ESPN match proxy). Do not add duplicate CRUD layers.

### Env setup
Copy env values with `npm run auth:env`. To wire the client to the local Java service, add to `.env.local`:

```env
EXPO_PUBLIC_COMMAND_API_URL=http://localhost:8080
```

Restart Expo after changing `.env.local`.

---

## Architecture Notes

- **State**: Zustand + AsyncStorage is canonical on-device. Supabase Postgres backs multiplayer/synced state. No other persistence layer.
- **Auth**: Supabase Auth. Signed-in = host. Guests join via room code and are session-scoped identities.
- **Match discovery**: client calls `GET /v1/matches` on the Java proxy (not ESPN directly). The proxy applies a configurable in-memory TTL cache (default `PT5M`).
- **Tamagui**: design system foundation. New UI work should use Tamagui components and move toward the palette defined in `app/style/`.
- **Supabase project ref**: `qccvlhblytuedgmlqfef` (MCP config in `.mcp.json`).

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
the `plan.md` in the highest-numbered directory under `specs/` (e.g.
`specs/019-<slug>/plan.md`) — this pointer is intentionally not pinned to a
specific feature number so it doesn't go stale as features complete.
<!-- SPECKIT END -->
