# Implementation Plan: Configure Room and Start Game

**Branch**: 153-configure-start-game | **Date**: 2026-06-28 | **Spec**: [specs/018-configure-start-game/spec.md](spec.md)

**Input**: Feature specification from specs/018-configure-start-game/spec.md

## Summary

Allow the room host to live-configure selected matches (fetched from the remote Java backend match catalog), designate a single Common Match, assign matches to participants (manually or via a bulk randomizer), and start the game. Validation is initiated via a stateless Java command endpoint POST /v1/rooms/{roomId}/commands/start-game which verifies five critical business invariants before transitioning the room state on Supabase Postgres from joinable to in_progress. Polling connected devices automatically detect the transition and navigate to the gameplay progress dashboard.

## Technical Context

**Language/Version**: Java 17 for command-api, TypeScript 5.3.3 in an Expo SDK 52 / React Native 0.76.9 workspace.

**Primary Dependencies**: Spring Boot 3.3.5 (web, security, validation, actuator), JJWT 0.12.6, React 18.3.1, Expo Router 4, Zustand 5, AsyncStorage.

**Storage**: PostgreSQL (Supabase local stack) with local migrations and RLS.

**Testing**: JUnit 5 + Mockito + MockMvc (backend), pgTAP (schema/triggers/RPCs), Jest-Expo (frontend hooks/components), Playwright BDD (E2E flows).

**Target Platform**: JVM web-service + Expo native (iOS/Android) and web.

**Project Type**: Monorepo feature spanning backend services, database migrations, and mobile-framework client.

**Performance Goals**: <300ms command verification and state change; automated polling update response within 5 seconds of host starting game.

**Constraints**: Stateless command-api; authentication checks on host; client-side regular snapshot polling (no Realtime socket connection required).

**Scale/Scope**: 1 command endpoint, 5 domain database RPCs + 3 idempotency-store RPCs + 1 new idempotency table, 1 UI configuration screen, and 1 client hook integration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Justification |
|-----------|--------|---------------|
| **I. Cross-Platform First** | **PASS** | Match configuring and automatic redirection to gameProgress are fully handled in shared Expo code, ensuring 100% parity across web and native platforms. |
| **II. Server-Authoritative Shared State** | **PASS** | Game start requests are routed through the Java proxy command which enforces comprehensive cross-aggregate validation rules across all roster assignments before modifying the database. All match selections are verified on the server. Every new mutation defines idempotency/conflict-handling behavior (research.md R7): `start-game` gets dispatch-layer exactly-once replay via a persistent `command_idempotency` store (replacing the `NoOpIdempotencyService` bootstrap, per ADR-7/#133) plus a `FOR UPDATE` row-lock backstop in `start_game_session` for racing keys; `add_room_match` dedupes on `(session_id, source_provider, source_match_id)`; `remove_room_match`/`set_common_match`/`set_room_assignments` are naturally idempotent by construction. |
| **III. Event-Backed Game History** | **PASS** | Every match addition, common match selection, roster assignment change, and session start records corresponding events (match_added, common_match_selected, assignment_replaced, session_started) to public.gameplay_events. |
| **IV. Supabase-First, Custom Backend by Exception** | **PASS** | Supabase serves as the canonical data store. The custom Java backend is used for command dispatch and cross-aggregate business invariant validation which direct client-to-database RPCs cannot safely orchestrate alone. |
| **V. Story-First Delivery With Required Coverage** | **PASS** | Sliced into distinct, verifiable user stories. Includes pgTAP tests for SQL schemas, MockMvc integration/unit tests for the controller/handlers, and a Playwright BDD file for the complete lobby setup to progress transition. |
| **VI. Skill-First AI Execution** | **PASS** | Loaded and followed the java-springboot, supabase, and supabase-postgres-best-practices skills to construct pristine DTO models, secure RPC boundaries, and efficient database indices/queries. |

## Project Structure

### Documentation (this feature)

`	ext
specs/018-configure-start-game/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 database scheme/RPC outline
├── quickstart.md        # Validation guidelines
├── checklists/
│   └── requirements.md  # Quality compliance checklist
└── contracts/
    ├── start-game-api.md # Java API contract definition
    └── room-rpcs.md     # Supabase RPC contracts
```

### Source Code (repository root)

```text
command-api/
├── src/main/java/com/dong/commandapi/
│   ├── command/
│   │   ├── StartGameCommandHandler.java
│   │   ├── idempotency/
│   │   │   └── PersistentIdempotencyService.java (replaces NoOpIdempotencyService)
│   │   └── dto/
│   │       └── SupabaseRoomSnapshot.java
│   ├── security/
│   │   └── AuthenticatedHost.java (updated with raw token)
│   ├── error/
│   │   └── ErrorCode.java (updated with room-start + IDEMPOTENCY_KEY_REUSE error variants)
│   └── supabase/
│       ├── SupabaseRestClient.java
│       └── dto/
└── src/test/java/com/dong/commandapi/command/
    ├── StartGameCommandHandlerTest.java
    ├── StartGameCommandControllerTest.java
    └── idempotency/
        └── IdempotencyStubGuardTest.java (updated: asserts persistent store, not NoOp, once a mutating handler exists)

supabase/
├── migrations/
│   └── 035_configure_start_game_rpcs.sql (domain RPCs + command_idempotency table/RPCs)
└── tests/database/
    └── 220_configure_start_game_rpcs.test.sql

app/
├── lobby/
│   └── [sessionId].tsx (integrate match catalog, assignments UI, Start Game command)
components/lobby/ (reusable components)
hooks/useRoomConfigure.ts (manages configuration, assignments, and command dispatch)
```

**Structure Decision**: Reuse the existing monorepo split. The backend validation and orchestration logic lands in command/ features package within command-api, database changes land as secure RPCs under supabase/migrations/, and UI setups integrate directly within the lobby router page and specialized component modules.

## Complexity Tracking

*No constitution violations present. Design adheres completely to repository best practices.*
