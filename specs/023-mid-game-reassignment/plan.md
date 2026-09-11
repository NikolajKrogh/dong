# Implementation Plan: Host Reassignment During an Active Game

**Branch**: `186-us57-allow-the-host-to-reassign-player-matches-during-an-active-game` | **Date**: 2026-08-03 | **Reviewed**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/023-mid-game-reassignment/spec.md`

---

## Summary

Let the host — and only the host — change a participant's assigned matches while
a room is `in_progress`, without disturbing anything already recorded, and make a
completed game's history tell the truth about a game that was reassigned mid-play.

**Scope: server slice only** (decided 2026-08-03, see spec.md §Delivery scope).
The client half — the reassignment UI, the game screen's snapshot poll, and the
FR-047b history indication — is blocked on and moved to
[#190](https://github.com/NikolajKrogh/dong/issues/190).

**Technical approach**, from [research.md](research.md):

1. **Server (migration 041)**: a new host-only `reassign_participant_matches`
   RPC guarded on `in_progress`, writing `public.assignments` and appending a new
   `assignment_reassigned` gameplay event carrying the added/removed delta.
2. **History (same migration)**: an immutable `assignment_snapshots` table
   written inside `private.end_game_session` before the state flip — the correct
   seam, though one that today's game screen never reaches (R6a, and #190's to
   connect);
   a statement-level insert guard rejects partial maps before they can become
   history;
   `private._history_completed_assignments` repointed to read the snapshot with
   a fallback to the live table; `completed_session_summaries` gains an
   `assignments_changed_during_play` flag derived from the existence of a
   reassignment event.
3. **Client**: the typed RPC wrapper only — `reassignParticipantMatches` on the
   room RPC client, with error mapping. No UI, no store change, no new hook.

**Why the split**, from the two findings that contradict issue #186's seam
notes:

- **R2** — the active game screen is not server-connected at all. It renders
  from Zustand, hydrated once by the lobby at
  `app/lobby/[sessionId].tsx:196-226`; the store holds no `sessionId`; and there
  is no server-side scoring anywhere in the repo. FR-049's "the room snapshot it
  already polls" does not exist on this screen.
- **R3** — the naive fix for R2 (reuse the lobby's hydration on each poll)
  **destroys recorded scoring every ~4 seconds**, because the lobby shape
  overwrites local goals and drinks with server values frozen at kickoff. That
  is a direct FR-045 violation caused by the mechanism FR-049 requires, and the
  pgTAP suite would pass anyway — it asserts on server columns nothing writes
  during play.

R3 is not a hazard to guard against inside this slice; it is the symptom of
building sync onto a screen with no server truth to sync against. Both findings
are carried into #190, which owns the foundation. This slice therefore ships
**no user-visible behaviour** — an accepted, deliberate consequence.

---

## Technical Context

**Language/Version**: TypeScript 5 (Expo SDK / React Native, React 19) client;
PL/pgSQL on Supabase PostgreSQL (the verified local image is PostgreSQL 17.6;
the hosted major version remains deployment-controlled). No Java change —
`command-api` is the ESPN proxy only and is untouched by this slice.

**Primary Dependencies**: Expo Router, Zustand + AsyncStorage, Supabase JS
client (`utils/supabaseClient.ts`), Supabase Postgres RPC.

**Storage**: Supabase Postgres. New: one snapshot table. Modified:
`public.assignments` (now mutable in-game), `chk_gameplay_events_event_type`,
`private._history_completed_assignments`, `public.completed_session_summaries`.
Snapshot rows carry an expected total so partial captures are detectable.

**Testing**: pgTAP (`supabase/tests/database/`) carries the slice; Jest
(`__tests__/`) for the RPC wrapper's error mapping. No Playwright BDD — there is
no UI change to journey-test (see Constitution Check §V).

**Target Platform**: iOS, Android, and web from one Expo codebase — though this
slice is platform-neutral by construction, being server-only.

**Project Type**: Mobile/web app + Supabase backend (polyglot monorepo).

**Performance Goals**: A reassignment is visible on every other connected device
within one room-snapshot poll interval (~4s), matching the existing lobby
cadence. No new synchronisation channel.

**Constraints**: Recorded scoring is immutable — no goal or drink may be
altered, removed, or recomputed (FR-045), including by client re-hydration
(R3). The completion snapshot is immutable once taken (FR-047a). Reassignment
records must never be pruned (FR-047d).
Reassignment preserves settled non-Common cardinality, malformed sets fail
before mutation, and idempotency replay is bound to a request fingerprint.

**Scale/Scope**: One new migration, one new RPC, one new table, two read-model
changes, one pgTAP suite, and a typed client RPC wrapper. No UI.

**Skills applied (constitution §VI)**: `supabase` and
`supabase-postgres-best-practices` for migration 041; `database-design-expert`
for the snapshot table shape; `database-testing` for the pgTAP suite. Recorded
per R0 — this is an explicit statement, not an implied review.
`react-native-testing` no longer applies now the client half has moved to #190.

---

## Constitution Check

*GATE: evaluated before Phase 0 research closed, and re-evaluated after Phase 1
design below.*

| Principle | Assessment | Verdict |
|-----------|-----------|---------|
| **I. Cross-Platform First** | Not engaged: this slice is server-only and renders nothing, so it is platform-neutral by construction. The client surfaces it enables are specified for native and web in #190. This is a *scope* boundary, not a "temporary platform exclusion" — no platform is being deferred relative to another. | ✅ Pass |
| **II. Server-Authoritative Shared State** | The assignment set stays canonical in Postgres. The client never writes it directly — the mutation goes through a `SECURITY DEFINER` RPC re-checking host identity and room state server-side (R5, R9). **Idempotency**: an explicit replay lookup on `(session_id, idempotency_key)` returning the original payload — this slice's own design, *not* 036's pattern, which does not replay and works only because starting is once-per-room (R12). **Conflict handling**: `FOR UPDATE` on the room row serialises writers; beyond that last-write-wins, accepted as a documented limitation with optimistic concurrency deferred to a possible additive parameter once #190 has a client that could resolve a conflict. §II asks that both be *defined*; both are, including the part that is a known gap. | ✅ Pass |
| **III. Event-Backed Game History** | This is the principle FR-047c exists to satisfy, and the design now satisfies it in §III's own preferred terms: the kickoff map is already in the event log (R11), so the per-moment map replays **forward** from persisted events alone. The completion snapshot is an acknowledged denormalization kept for read cost and drift-bounding, and is *verified against* the replay by a pgTAP invariant rather than being trusted as an independent truth. Retention (FR-047d: never prune) and backfill (R7: none needed, fallback argued) are addressed. | ✅ Pass |
| **IV. Supabase-First** | Entirely Supabase Postgres + RPC. No Java endpoint, no duplicate CRUD layer, no new infrastructure. | ✅ Pass |
| **V. Story-First With Required Coverage** | Two independently testable stories (US7 mutation, US7a history), both with Gherkin acceptance criteria and edge cases. pgTAP covers every guard, the immutability assertions, the read-model fallback, and the FR-047c reconstruction; a unit test covers the RPC wrapper's error mapping. **No end-to-end test**, and the constitution agrees: §V requires one for "any substantial UI change", and this slice contains no UI change at all. The journey test moves to #190 with the UI it would exercise. | ✅ Pass |
| **VI. Skill-First AI Execution** | Applicable skills identified and named in Technical Context and R0. | ✅ Pass |

**Pre-Phase-0 result**: PASS, no violations.

**Post-Phase-1 re-evaluation**: PASS, no violations. Phase 1 design introduced
one new table and no new services; the R3 finding *strengthens* §III compliance
by making the immutability requirement testable at the layer where it can
actually be broken. **Complexity Tracking is empty** — nothing required
justification.

---

## Project Structure

### Documentation (this feature)

```text
specs/023-mid-game-reassignment/
├── plan.md              # This file
├── research.md          # Phase 0 output — R0-R13
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── issue-sync.md        # Exact #186/#190 tracking updates
├── contracts/
│   └── reassignment-rpc.md   # RPC + read-model contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks - NOT created here)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 041_mid_game_reassignment.sql        # NEW - RPC, event type, snapshot
│                                            #       table, read-model repoint
└── tests/database/
    └── 240_mid_game_reassignment.test.sql   # NEW - pgTAP

types/
└── room.ts                                  # Add reassignment request/response
                                             # types. RoomSnapshot is UNCHANGED -
                                             # it already carries `assignments`
utils/
└── supabaseClient.ts                        # Add reassignParticipantMatches
                                             # to the room RPC client, with the
                                             # contract's error mapping

__tests__/
└── utils/supabaseClient.reassign.test.ts    # NEW - error-mapping coverage
```

**Deliberately not touched in this slice** — all of it moves to
[#190](https://github.com/NikolajKrogh/dong/issues/190): `store/store.ts` (room
identity), a game-screen sync hook, `hooks/useGameProgressController.ts`,
`app/gameProgress.tsx`, `app/lobby/[sessionId].tsx`, `components/gameProgress/`,
the history UI, and `e2e/`.

**Structure Decision**: The existing monorepo layout is used unchanged. With the
client half moved to #190, the footprint is almost entirely SQL — one migration
and one pgTAP suite — plus a typed wrapper following the established
`utils/supabaseClient.ts` pattern beside `endGameSession`. R2's proposed
`useActiveGameRoomSync` hook (kept separate from `useRoomLobby`, which carries
start-observation and feasibility concerns the game screen must not inherit) is
recorded in research.md and carried into #190 rather than built here.

---

## Phase 0: Outline & Research

**Status**: Complete → [research.md](research.md)

Fourteen findings (R0–R13). The findings that change the shape of the work:

- **R1** — the load-bearing assumption re-verified, and corrected: it holds, but
  because of the *store's* structure, not only the database's. There is no
  server-side scoring in the repo at all.
- **R2** — the active game screen has no room identity and no snapshot poll.
  This is what rescoped the issue to its server slice; carried into #190.
- **R3** — assignment-only re-hydration is mandatory, or FR-045 breaks on a 4s
  cadence in a way the prescribed pgTAP tests would pass. Carried into #190 as
  a named constraint on that work.
- **R4** — `assignment_replaced` already exists and is taken by settlement;
  reusing it would make FR-047b true for every game. New type, and the CHECK to
  redefine lives in `031`, not `010` as the issue states.
- **R11** — the settlement event's payload already holds the **complete kickoff
  map**, so FR-047c replays forward from the log and the snapshot is a
  denormalization. Kept deliberately (read cost, drift-bounding), and the
  redundancy is spent on the slice's strongest test: `snapshot ==
  replay(kickoff, deltas)`.
- **R12** — repeatable reassignment needs explicit replay, authorization before
  replay, and documented last-write-wins conflict handling.
- **R13** — preserve settled cardinality; reject malformed arrays; bind each
  idempotency key to a canonical request fingerprint; resolve the non-null owner
  participant actor; detect partial snapshots; and pin event/snapshot retention
  to the completed session.

No `NEEDS CLARIFICATION` markers remain; the spec carried none.

## Phase 1: Design & Contracts

**Status**: Complete.

- **[data-model.md](data-model.md)** — the new `assignment_snapshots` table, the
  `assignment_reassigned` event payload, the mutation rules on
  `public.assignments`, and the read-model changes. §5 (client state) documents
  the store and hook design for #190 and is **not built in this slice**.
- **[contracts/reassignment-rpc.md](contracts/reassignment-rpc.md)** — the
  `reassign_participant_matches` RPC signature, its guard order and error
  vocabulary, and the read-model contract additions.
- **[quickstart.md](quickstart.md)** — runnable validation covering the mutation,
  the immutability guarantee, the R3 trap, and the history reconstruction.
- **Agent context** — `CLAUDE.md`'s plan pointer updated to this file.

---

## Complexity Tracking

*No Constitution Check violations. This section is intentionally empty.*

---

## Notes

- **Branch metadata.** The checkout is now on
  `186-us57-allow-the-host-to-reassign-player-matches-during-an-active-game`;
  this supersedes the older planned short branch name in the document header.
- **A delta against `specs/020`.** FR-049's premise — that every client already
  polls the room snapshot — is false for the active game screen (R2). 020 is not
  edited here; it is canonical for four issues. The missing poll is
  [#190](https://github.com/NikolajKrogh/dong/issues/190); raise the FR-049
  correction against 020 separately.
- **This slice ships no user-visible behaviour**, by decision. Reviewers should
  expect a PR that is migration + pgTAP + a typed wrapper, and should *not* ask
  for the reassignment UI — it is #190's.
- **The snapshot rarely fires until #190 lands** (R6a). The game screen's End
  Game is local-only, so real games expire to `closed` rather than completing,
  and server-side history is empty for them. Validate by ending the game from
  the lobby. A reviewer who reaches for the game screen's button and sees no
  snapshot has found a pre-existing gap, not a defect in this slice.
- **Re-verify R1 if server-side scoring lands first.** It would not invalidate
  FR-045, but it would relax R3's assignment-only rule.
