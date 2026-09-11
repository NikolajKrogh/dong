# Implementation Plan: Server-Authoritative Multiplayer Gameplay

**Branch**: `186-us57-allow-the-host-to-reassign-player-matches-during-an-active-game` | **Date**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/024-server-authoritative-gameplay/spec.md`

## Summary

Make an in-progress multiplayer room authoritative for scores, drinks, roster,
host role, assignments, completion, and history while leaving solo play local.
Participant-authored manual changes use transactional Supabase RPCs with active
membership authorization, idempotency, deterministic room ordering, and
immutable events. Provider observations enter only through a JWT-authenticated
Supabase Edge Function and service-role-only database RPCs; Java remains the
fixture-discovery integration. Native and web
clients retain the room context, layer optimistic goal/drink deltas over an
ordered canonical snapshot, poll at most every four seconds, and use the #186
RPC for host-only reassignment. Completion waits for canonical confirmation and
does not write a second device-local history record.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2, Java 17, PostgreSQL 17

**Primary Dependencies**: Expo 57 / React Native 0.86 / Expo Router, Zustand 5,
Tamagui 2.5, `@supabase/supabase-js` 2.105, Spring Boot 3.5

**Storage**: Supabase PostgreSQL for multiplayer canonical rows/events/history;
AsyncStorage/Zustand and existing local history for solo play and session grants

**Testing**: pgTAP via Supabase CLI, Jest 29 with `jest-expo` and
`react-test-renderer`, JUnit/Spring Boot Test, Playwright 1.59 with
`playwright-bdd`, physical Android smoke via ADB

**Target Platform**: Expo native Android/iOS and React Native Web; Supabase Edge
Functions/PostgREST, plus the Java fixture-discovery API

**Project Type**: Cross-platform mobile/web application with Supabase database
with a Supabase Edge ingestion boundary and narrow Java discovery service

**Performance Goals**: Normal two-client convergence within 5 seconds; resumed
or restarted-client recovery within 10 seconds; an accepted retry applies once

**Constraints**: Supabase free tier; no offline mutation queue; service-role
credentials never ship to clients; provider matches remain participant
read-only; completed multiplayer history is canonical; existing solo flow stays
offline-capable

**Scale/Scope**: One active room aggregate at a time per client, small social
rooms and match pools, five user stories spanning database, client, Supabase
Edge ingestion, Java discovery, web E2E, and native smoke validation

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Cross-Platform First | Shared hooks, RPC clients, store context, and Tamagui controls serve native and web; Playwright plus physical Android cover the journey. | PASS |
| II. Server-Authoritative Shared State | Multiplayer writes are validated commands; room-row serialization, idempotency keys, event sequence numbers, and canonical snapshots define conflict behavior. | PASS |
| III. Event-Backed Game History | Goal, drink, provider-score, reassignment, and completion mutations append immutable events; snapshots remain reconstructible. | PASS |
| IV. Supabase-First | Participant mutations and reads use Supabase RPCs. A Supabase Edge Function owns authenticated ESPN score ingestion; Java remains discovery-only. | PASS |
| V. Story-First Delivery | Spec stories are independently testable; pgTAP/Jest/JUnit cover behavior and Playwright covers the substantial two-client UI journey. | PASS |
| VI. Skill-First AI Execution | Planning used Spec Kit, Supabase/Postgres, database design/testing, React Native testing, Tamagui, and CodeGraph guidance. | PASS |

Post-design re-check: the contracts below preserve platform parity, canonical
authority, immutable auditability, secure RPC boundaries, and required unit/E2E
coverage. No constitutional exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/024-server-authoritative-gameplay/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── active-game-sync.md
│   └── gameplay-commands.md
└── tasks.md                    # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
app/
└── gameProgress.tsx
components/gameProgress/
├── MatchQuickActionsModal/
├── MultiplayerGameStatus.tsx
└── ReassignmentControl.tsx
hooks/
├── useGameProgressController.ts
└── useActiveGameRoomSync.ts
store/
└── store.ts
types/
├── room.ts
└── database.types.ts
utils/
├── supabaseClient.ts
└── commandApiClient.ts

command-api/src/main/java/com/dong/commandapi/
├── match/
└── supabase/
command-api/src/test/java/com/dong/commandapi/

supabase/functions/
└── refresh-provider-scores/
supabase/migrations/
└── 042_server_authoritative_gameplay.sql
supabase/tests/database/
└── 280_server_authoritative_gameplay.test.sql

__tests__/
├── hooks/
├── store/
└── utils/
e2e/
├── features/server-authoritative-gameplay.feature
└── steps/server-authoritative-gameplay.steps.ts
```

**Structure Decision**: Extend the existing Expo client, Supabase migration/RPC
layer, Supabase Edge ingestion, and Java discovery integration in place. Keep canonical-state reconciliation
inside one active-game hook and keep the existing controller's solo branch,
rather than introducing a parallel screen or general repository layer.

## Delivery Phases

1. **Canonical command foundation**: add ordered goal/drink/provider events,
   signed-in and guest authorization wrappers, idempotency, snapshot sequence,
   and pgTAP coverage.
2. **Active-game recovery**: persist multiplayer context, hydrate the current
   snapshot, poll/resume, reject stale snapshots, and expose ended/access-lost
   states without changing solo behavior.
3. **Shared interactions**: route manual goals/drinks through optimistic command
   overlays, make provider values canonical through the Edge Function path, and add
   rollback/error behavior.
4. **Host controls and completion**: expose #186 reassignment in a responsive
   Tamagui control, call canonical completion from the active screen, and render
   the shared final state without local duplicate history.
5. **Journey verification**: database/Jest/JUnit regression suites, a two-browser
   Playwright journey, and one physical-device Android smoke paired with a
   second web client.

## Complexity Tracking

No constitution violations require justification.
