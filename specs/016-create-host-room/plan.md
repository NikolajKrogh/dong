# Implementation Plan: Host Creates Room

**Branch**: `[to be created]` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-create-host-room/spec.md`

## Summary

Enable an authenticated host to create a multiplayer room via a Supabase PL/pgSQL RPC (`create_room_as_host`). The RPC generates a unique 6-digit numeric join code, persists the room in joinable state, and adds the host as the owner participant atomically. If the host already has a joinable room, the RPC returns that room instead of creating a duplicate. The client uses a new `useHostRoomCreate` hook and navigates the host to a new `app/lobby/[sessionId].tsx` screen that displays the join code.

## Technical Context

**Language/Version**: TypeScript (strict), PL/pgSQL

**Primary Dependencies**: Supabase JS client v2, Expo Router v4, React 18, Tamagui, Jest, pgTAP

**Storage**: Supabase Postgres — `public.game_sessions` and `public.participants` (existing schema, no DDL changes)

**Testing**: pgTAP (DB RPC), Jest + React Testing Library (hook unit), Playwright BDD (e2e)

**Target Platform**: iOS, Android, Web — all via Expo/React Native

**Performance Goals**: Room creation p95 < 5 seconds (SC-001)

**Constraints**:
- `authenticated` role has SELECT-only on `game_sessions` → RPC must be `SECURITY DEFINER`
- No Java endpoints (constitution §IV)
- Unit tests required for all new behavior before merge (§V)
- New UI flow requires at least one e2e test (§V)

**Scale/Scope**: Small-scale game; dozens of concurrent active rooms at most

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Cross-Platform First | ✅ PASS | New lobby screen via Expo Router — works on native and web; no platform-specific APIs |
| II. Server-Authoritative Shared State | ✅ PASS | RPC is sole write path; existing-room redirect prevents duplicate rooms; double submission returns same room atomically |
| III. Event-Backed Game History | N/A | Room creation is not a gameplay mutation |
| IV. Supabase-First | ✅ PASS | Pure Supabase RPC; no Java endpoint introduced |
| V. Story-First Delivery | ✅ PASS | Two independently testable P1 stories; Gherkin ACs defined; pgTAP + Jest unit + Playwright e2e all required |
| VI. Skill-First AI Execution | ✅ PASS | Constitution and skills checked before planning began |
| Multiplayer auth constraint | ✅ PASS | `auth.uid()` enforced inside SECURITY DEFINER RPC; unauthenticated callers get `not_authenticated` error |
| Schema migration rule | ✅ PASS | No DDL changes; new migration adds only RPC functions |

**Post-Phase 1 re-check**: All gates still pass. The partial return shape (`sessionId`, `joinCode`, `hostParticipantId`, `hostDisplayName`) satisfies §II without over-fetching. The `app/lobby/[sessionId].tsx` route satisfies §I (Expo Router targets both platforms).

## Project Structure

### Documentation (this feature)

```text
specs/016-create-host-room/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── create_room_as_host.sql   # RPC signature contract
│   └── HostRoomRpcClient.ts      # TypeScript client interface
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 029_host_create_room.sql            # New: SECURITY DEFINER RPCs + public wrapper
└── tests/database/
    └── 160_host_create_room.test.sql        # New: pgTAP tests

types/
└── hostRoom.ts                              # New: HostRoomCreateResponse type

utils/
└── supabaseClient.ts                        # Modified: HostRoomRpcClient interface + factory

hooks/
└── useHostRoomCreate.ts                     # New: isCreating / error / createRoom hook

app/
├── index.tsx                                # Modified: auth-aware "Create Room" button
└── lobby/
    └── [sessionId].tsx                      # New: lobby screen (code + host participant)

__tests__/
└── hooks/
    └── useHostRoomCreate.test.ts            # New: hook unit tests

e2e/
├── features/
│   └── host-create-room.feature             # New: BDD feature file
└── steps/
    └── host-create-room.steps.ts            # New: step definitions
```

**Structure Decision**: Follows the pattern established by guest room join: migration → types → `supabaseClient.ts` extension → hook → screen. No new architectural layers.
