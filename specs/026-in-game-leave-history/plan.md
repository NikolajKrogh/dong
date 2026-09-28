# Implementation Plan: In-Game Leave and Preserved History

**Branch**: `codex/165-in-game-leave-history` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: [Issue #165](https://github.com/NikolajKrogh/dong/issues/165), user scope, and `spec.md`.

## Summary

Preserve and freeze early leavers in the canonical session, capture an immutable result at departure, expose it under the registered or guest history contract, and add a confirmed in-game leave action. Reuse #191 guest departure and #138 completed history.

## Technical Context

**Language/Version**: TypeScript 5.9 / Expo 57; PostgreSQL 17 / PL/pgSQL  
**Primary Dependencies**: Existing Expo Router, Tamagui, Supabase client, and guest ingress  
**Storage**: Supabase participant/event/history rows; device-local guest history  
**Testing**: Focused pgTAP and Jest, TypeScript, lint, manual web and Android; no E2E tests  
**Target Platform**: Web and Android, with shared React Native behavior  
**Project Type**: Expo client and Supabase database  
**Performance Goals**: One transaction for departure; result visible after the next history refresh  
**Constraints**: No hosted database changes, no E2E tests, immutable event history, guest ingress authorization  
**Scale/Scope**: Small multiplayer rooms; existing member, guest, and host roles

## Constitution Check

Gate before Phase 0 research: reviewed. Post-Phase 1 design: reviewed.

| Principle | Evidence | Result |
|---|---|---|
| I. Cross-Platform First | Shared action, confirmation, and history contracts; web and Android walkthroughs | PASS by design |
| II. Server-Authoritative Shared State | Room-locked departure, server result capture, existing command guards | PASS by design |
| III. Event-Backed Game History | One immutable departure event carries the captured result; final history uses retained participant | PASS by design |
| IV. Supabase-First | Existing RPCs and one invoker-security read projection; no Java API | PASS by design |
| V. Story-First Required Coverage | Focused unit and pgTAP checks planned. The user forbids E2E tests for this substantial UI flow. | INTENTIONAL USER-SCOPED UNMET REQUIREMENT |
| VI. Skill-First Execution | Applied repository Spec Kit, Supabase, Tamagui, database-testing, and CodeGraph guidance | PASS |

## Project Structure

### Documentation

```text
specs/026-in-game-leave-history/
  spec.md plan.md research.md data-model.md quickstart.md tasks.md verification.md
  contracts/in-game-leave.md checklists/requirements.md
```

### Source Code

```text
supabase/migrations/          additive leave/result migration
supabase/tests/database/      leave, auth, history checks
types/                       room and guest result shapes
utils/historyRepository.ts    provisional registered result mapping
hooks/                       active game and guest leave orchestration
store/store.ts                device-local guest result persistence
components/gameProgress/      Leave Game action and confirmation
app/gameProgress.tsx          shared game screen wiring
__tests__/                    focused non-E2E behavior checks
```

**Structure Decision**: Extend existing RPCs, projection, history loader, and game action sheet. Avoid a new backend or mutable result table.

## Delivery Sequence

1. Add the room-lock-safe SQL leave and capture transition, fixed game projection, and registered history read model.
2. Add the guest response and client result mapping, then wire the in-game action and host flow.
3. Verify focused database/client behavior and record manual-only scenarios in `verification.md`.

## Migration, Deployment, and Recovery

Create a forward-only additive migration. Apply it locally before the client build; do not touch hosted/production databases in this task. Existing clients ignore the extra event payload and guest response property. Roll back a client by reverting code only; retain persisted departure events and participants. Forward-fix SQL if a migration fails. Do not revive grants or alter confirmed history.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| No E2E coverage for a new in-game UI journey | Explicit user constraint | No E2E tests may be authored or run; focused tests and manual walkthroughs are permitted but do not satisfy Principle V |
