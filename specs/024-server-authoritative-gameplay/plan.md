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
fixture-discovery integration. Native and web clients retain the room context,
layer optimistic goal/drink deltas over an ordered canonical snapshot,
subscribe to authorized room Broadcast and Presence, and retain a four-second
polling fallback. Guests continue polling because their scoped grants are not
Supabase Auth JWTs. Completion waits for canonical confirmation, revokes guest
access, and returns every connected client home without writing a second
device-local history record.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2, Java 17, PostgreSQL 17

**Primary Dependencies**: Expo 57 / React Native 0.86 / Expo Router, Zustand 5,
Tamagui 2.5, `@supabase/supabase-js` 2.105, Spring Boot 3.5

**Storage**: Supabase PostgreSQL for multiplayer canonical rows/events/history;
AsyncStorage/Zustand and existing local history for solo play and session grants

**Testing**: pgTAP via Supabase CLI, Jest 29 with `jest-expo` and
`react-test-renderer`, JUnit/Spring Boot Test, static checks, and user-performed
manual browser/physical Android verification. Do not add or run E2E tests for
this amendment, per the user's instruction.

**Target Platform**: Expo native Android/iOS and React Native Web; Supabase Edge
Functions/PostgREST/Realtime, plus the Java fixture-discovery API

**Project Type**: Cross-platform mobile/web application with Supabase database
with a Supabase Edge ingestion boundary and narrow Java discovery service

**Performance Goals**: Normal two-client convergence within five seconds through
Realtime or bounded polling; resumed or restarted-client recovery within 10
seconds; host/registered clients return Home within five seconds of confirmed
completion; connected guests receive Room Ended within five seconds and then
remain there for five cumulative foreground-interactive seconds before Home
(screen-reader users choose Home explicitly); an accepted retry applies once

**Constraints**: Supabase free tier; no offline mutation queue; service-role
credentials never ship to clients; provider matches remain participant
read-only; completed multiplayer history is canonical; existing solo flow stays
offline-capable

**Scale/Scope**: One active room aggregate at a time per client, small social
rooms and match pools, five user stories spanning database, client, Supabase
Edge ingestion, Java discovery, manual browser, and native smoke validation

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Cross-Platform First | Shared hooks, RPC clients, store context, and Tamagui controls serve native and web; manual browser plus physical Android cover the journey. | PASS |
| II. Server-Authoritative Shared State | Multiplayer writes are validated commands; room-row serialization, idempotency keys, event sequence numbers, and canonical snapshots define conflict behavior. | PASS |
| III. Event-Backed Game History | Goal, drink, provider-score, reassignment, and completion mutations append immutable events; snapshots remain reconstructible. | PASS |
| IV. Supabase-First | Participant mutations and reads use Supabase RPCs. A Supabase Edge Function owns authenticated ESPN score ingestion; Java remains discovery-only. | PASS |
| V. Story-First Delivery | pgTAP/Jest/JUnit and static checks cover logic; the user performs browser/device acceptance. No E2E may be added or run. The substantial Room Ended UI therefore lacks this constitution-required E2E coverage. | INTENTIONAL USER-SCOPED UNMET REQUIREMENT |
| VI. Skill-First AI Execution | Planning used Spec Kit, Supabase/Postgres, database design/testing, React Native testing, Tamagui, and CodeGraph guidance. | PASS |

Post-design re-check: the contracts below preserve platform parity, canonical
authority, immutable auditability, and secure RPC boundaries. Principle V's E2E
requirement for the new substantial guest screen remains unmet under the user's
explicit no-E2E scope and is recorded below; the constitution itself is not
waived or amended. Automated coverage and user-performed browser/device checks
remain required.

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
├── gameProgress.tsx
└── roomEnded.tsx              # guest-only terminal screen
components/gameProgress/
├── MatchQuickActionsModal/
├── MultiplayerGameStatus.tsx
└── ReassignmentControl.tsx
hooks/
├── useGameProgressController.ts
├── useActiveGameRoomSync.ts
└── useGuestRoomEndedNavigation.ts # single navigation owner
platform/navigation/useRoomEndedExit.ts # foreground timer/accessibility path
utils/guestRoomTermination.ts  # one-shot guest cleanup
store/
└── store.ts                   # non-persisted endedGuestSessionId marker
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
   snapshot, receive authorized Realtime Broadcast/Presence notifications for
   registered participants, retain polling/foreground refresh as fallback,
   reject stale snapshots, and expose ended/access-lost states without changing
   solo behavior.
3. **Shared interactions**: route manual goals/drinks through optimistic command
   overlays, make provider values canonical through the Edge Function path, and add
   rollback/error behavior.
4. **Host controls and completion**: expose #186 reassignment in a responsive
   Tamagui control, call canonical completion from the active screen, route the
   host directly to the unchanged Home screen, and route guests through the
   separate Room Ended screen without local duplicate history.
5. **Room Ended guest handling**: classify host completion separately from
   expiry, clear guest grant/context once, show a five-second foreground timer
   with lifecycle pause, and provide a button-only screen-reader path. Current
   React Native Web accessibility detection reports enabled for every session,
   so web follows the conservative button-only path pending resolution.
6. **Journey verification**: automated database/Jest/static checks plus
   user-performed browser and physical Android verification in an isolated test
   room. Do not add or run E2E tests for this task.

## Complexity Tracking

Principle V's E2E requirement for the new substantial guest Room Ended screen is
intentionally unmet because the user explicitly prohibited adding or running E2E
tests. This is an explicit user-scoped E2E exception.
Existing two-client E2E evidence is historical and does not cover this screen.
The user owns the outstanding manual browser/device acceptance in T051.
