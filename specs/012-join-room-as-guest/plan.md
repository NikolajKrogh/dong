# Implementation Plan: Join Room as Guest

**Branch**: `131-us32-allow-a-guest-to-join-a-room-from-their-own-device-without-creating-an-account` | **Date**: 2026-05-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-join-room-as-guest/spec.md`

## Summary

Build a guest-room join flow that lets a player enter a room code and guest name without creating a durable account, validates the room server-side, persists a room-scoped guest access grant, replays join retries safely through a device-scoped guest token, and renders the room lobby and gameplay state from a home-owned modal on native and web with the existing Supabase-backed multiplayer model.

## Technical Context

**Language/Version**: TypeScript 5.3.3  
**Primary Dependencies**: Expo SDK 52, React Native 0.76.9, React 18.3.1, Expo Router 4, `@supabase/supabase-js` 2.105.4, Zustand 5, AsyncStorage, `react-native-safe-area-context`, `react-native-toast-message`, `react-native-reanimated`, `playwright-bdd` 8.5.0, `@playwright/test` 1.59.1  
**Storage**: Existing Supabase Postgres room tables (`game_sessions`, `participants`, `matches`, `assignments`, `gameplay_events`) plus AsyncStorage for a persisted guest-room session grant; no new business tables are required  
**Testing**: Jest-Expo plus React Native Testing Library for the guest join hook and home-owned modal behavior, including session restore and expiry; Supabase CLI plus pgTAP for RPC security, replay safety, and integrity validation; Playwright BDD for the web cross-device guest journey through gameplay transition; quickstart-based native smoke validation for join, lobby, gameplay transition, and grant recovery  
**Applicable Skills**: `supabase`, `database-testing`, `supabase-postgres-best-practices`, `react-native-testing`  
**Target Platform**: iOS, Android, and web  
**Project Type**: Mobile app with web support  
**Performance Goals**: Successful guest joins should render a usable lobby from one successful join RPC response, without requiring a second snapshot fetch before the initial lobby render  
**Constraints**: No durable account may be created for a guest; guest names may duplicate within a room; blank or whitespace-only guest names must be rejected; guest access must work on both native and web; existing local game-state data must not be cleared; the client must generate a guest token before the first join submission and reuse it on retry so the RPC can replay safely; an expired or invalid stored grant must be cleared locally before the player is returned to the home-owned guest join modal  
**Scale/Scope**: One home-owned guest-join modal, one redirecting fallback route, one new guest-room session hook, one replay-safe Supabase RPC contract with a public wrapper, one contract doc, two DB test slices, one BDD feature, and focused unit tests

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Cross-platform behavior is defined for native and web: the guest join form, room error states, session restore, and lobby handoff will be available in both environments, and the same route will drive the join journey on phone and desktop.
- Shared-state changes identify the canonical source of truth: `public.game_sessions` and `public.participants` remain authoritative, while the new guest command surface will validate and write through a Supabase RPC instead of direct client table writes.
- Idempotency and recovery are explicit: the client sends a pre-generated guest token with the join command, the server hashes it into `guest_rejoin_token_hash` and returns the existing participant on replay instead of inserting a duplicate row, and expired or unknown grants force the client to clear local storage and route back to guest join.
- Data-model changes stay within the existing room schema: no new business tables are added, the guest access grant is persisted locally and hashed on the participant row, and no backfill is required.
- Work remains sliced into independently deliverable user stories: guest join success, invalid join rejection, and guest limitation messaging all remain testable on their own.
- The test plan defines unit coverage for the new guest join and guest session hooks, database coverage for RPC validation and guest participant creation, and end-to-end coverage for the primary cross-device flow through gameplay transition.
- Applicable repository, platform, and domain skills were identified before design work began.

## Project Structure

### Documentation (this feature)

```text
specs/012-join-room-as-guest/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── guest-room-join.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── index.tsx
├── joinRoom.tsx
└── _layout.tsx

components/
├── index.ts
├── guestJoin/
│   ├── GuestJoinBanner.tsx
│   ├── GuestJoinForm.tsx
│   ├── GuestJoinLobby.tsx
│   └── GuestJoinModal.tsx
└── ui/

hooks/
├── useGuestRoomJoin.ts
└── useGuestRoomSession.ts

types/
└── guestRoom.ts

utils/
├── guestRoom.ts
└── supabaseClient.ts

supabase/
├── migrations/
└── tests/database/

__tests__/
├── components/guestJoin/
└── hooks/

e2e/
├── features/
├── fixtures.ts
└── steps/
```

**Structure Decision**: Keep the implementation inside the existing Expo app and Supabase database. Own the guest join flow from `app/index.tsx` with a dedicated `components/guestJoin/GuestJoinModal.tsx`, keep `app/joinRoom.tsx` as a redirecting fallback, reuse the shared UI system for form and lobby cards, add guest-room session helpers in `hooks/`, `types/guestRoom.ts`, and `utils/guestRoom.ts`, and cover the new command surface with Supabase migrations/tests plus BDD steps.

## Complexity Tracking

No Constitution Check violations require justification for this feature.
