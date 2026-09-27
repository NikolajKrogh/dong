# Implementation Plan: Harden Guest Room Access

**Branch**: `187-harden-guest-room-access` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Issue [#191](https://github.com/NikolajKrogh/dong/issues/191) and `specs/025-harden-guest-room-access/spec.md`.

## Summary

**Approved amendment (2026-09-26):** The first forwarded address was proven
spoofable hosted. Replace direct guest RPC transport with an allowlisted Supabase
Edge Function and revoke direct API-role execution for all seven guest functions.
See [trusted ingress contract](contracts/trusted-ingress.md), which supersedes
the conditional no-Edge decision below. Constitution recheck: Supabase-first,
server-authoritative and platform parity remain satisfied; no new external service.

**Approved amendment (2026-09-26 — expiry-aware roster):** Expiry changes a
guest's access and live-lobby eligibility, not persisted participant/game
history. Add an activeRoster projection to the shared snapshot; retain the
existing participants field unchanged for game hydration and historical
records. Use one server-side eligibility predicate for the live roster,
pre-start feasibility, host allocations, and game-start participant IDs. Do not
write a leave event or reset abuse counters on expiry.

Replace predictable-fallback guest tokens and plaintext local persistence with fail-closed, 256-bit credentials and platform-specific protected/session storage. Add a database-enforced 48-hour grant lifecycle with transactional, retry-safe rotation and revocation, and route every guest read/command through one participant-and-room validator. Add atomic, bounded anonymous join/read counters keyed by trusted caller and HMAC-correlated code/token, normalize pre-proof room responses, and retain registered-member behavior. This amendment also permits confirmed guest departure during active play and revokes guest grants on host completion while preserving history. The user forbids adding or running E2E tests for this work; use pgTAP, unit tests, and manual browser/physical-device verification.

**Approved amendment (2026-09-27 — completion signal)**: A guest grant valid
when host completion commits receives a data-free `room_ended` terminal result,
distinct from a grant that expired or was revoked first. This result grants no
room reads or writes. Completion-only grant-matching metadata is non-reversible,
non-authorizing, and retained with the existing historical participant row; participant,
gameplay/history, and abuse-window records remain unchanged. The connected guest
uses #024's standalone Room Ended screen; its UI/countdown and direct Home rules
are owned by #024.

## Technical Context

**Language/Version**: TypeScript 5.9 / Expo 57 / React Native 0.86, PostgreSQL 17 / PLpgSQL

**Primary Dependencies**: `@supabase/supabase-js` 2.114, Expo Router, `expo-secure-store` and `expo-crypto` (to add at Expo-compatible versions); PostgREST RPC, `pgcrypto`

**Storage**: Supabase Postgres for membership, grant hashes, and abuse windows; native SecureStore for the bearer and pending rotation; web `sessionStorage` only (no durable bearer); AsyncStorage solely for legacy cleanup/non-secret state

**Testing**: pgTAP/Supabase CLI, Jest/jest-expo, and static checks for response
classification, terminal races, and cleanup. The user performs manual browser
and physical Android acceptance (T051/T074). Do not add or run E2E tests for
this amendment, per the user's instruction.

**Target Platform**: Android, iOS, web; Supabase hosted and local PostgREST

**Project Type**: Expo cross-platform client with Supabase database/RPC backend

**Performance Goals**: ≥95% of authorized joins and refreshes within five seconds under normal and unrelated limited traffic; normal 1 Hz guest refresh accepted; eight invited joins pass in one room

**Constraints**: Supabase free tier; no new Java API or external Redis; no client-held service key; no raw bearer/code in logs/events; cross-platform UX; existing room state/history semantics; migration-safe old clients

**Scale/Scope**: Small social rooms; five existing guest RPC families (join, snapshot, leave, picks, score/drink commands), client restore and recovery; forward-only security and roster migrations, automated tests, and limited UI/state changes

## Constitution Check

*Gate before Phase 0: PASS. Re-checked after Phase 1 design: PASS, subject to the deployment gates in quickstart.*

| Principle | Design evidence | Result |
|---|---|---|
| I. Cross-Platform First | Shared credential interface; native SecureStore and web sessionStorage adapters; parity tests and physical Android smoke. | PASS |
| II. Server-Authoritative Shared State | Grant/room authorization, rotation, leave, quotas, and the expiry-aware active-roster/game-start predicate are server-authoritative; retries preserve identity. | PASS |
| III. Event-Backed Game History | Existing join/leave events stay immutable and exactly-once; expiry creates no false leave and completion signaling does not rewrite settled participants, assignments, scores, or events. | PASS |
| IV. Supabase-First | Postgres RPCs, private helpers and tables; no new Java layer, external rate-limit service, or duplicate CRUD API. | PASS |
| V. Story-First Required Coverage | This amendment uses pgTAP, unit/static tests, and user-performed manual browser/device checks; the user explicitly prohibited adding or running E2E tests. The new substantial guest terminal UI therefore lacks Principle V E2E coverage. | INTENTIONAL USER-SCOPED UNMET REQUIREMENT |
| VI. Skill-First Execution | Used `speckit-plan`, `supabase`, `supabase-postgres-best-practices`, `database-testing`, and CodeGraph guidance. The desktop/SQLite database-design skill is not applicable to this PostgreSQL feature. | PASS |

Post-design re-check: the RPC contract preserves all registered-member paths,
makes guest enforcement server-side, and treats migration/recovery as release
requirements. Principle V's new-screen E2E requirement remains unmet under the
user's no-E2E instruction; the constitution is not changed or waived. **Release
is blocked** if hosted caller IP cannot be shown to be gateway-controlled; see
research R5 and quickstart.

## Project Structure

### Documentation (this feature)

```text
specs/025-harden-guest-room-access/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── guest-access-rpcs.md
│   └── credential-storage.md
└── tasks.md                 # Created later by speckit-tasks
```

### Source Code (repository root)

```text
platform/guestCredential/      # native SecureStore / web sessionStorage adapters
utils/guestRoom.ts             # grant parsing, errors, secure generation
utils/supabaseClient.ts        # guest RPC response normalization
types/guestRoom.ts             # expiry, rotation, pending leave, error/status types
hooks/useGuestRoomSession.ts   # restore, renewal, leave retry, polling
hooks/useGuestRoomJoin.ts      # unchanged public join hook surface where possible
components/                  # existing guest join/access-loss messaging
supabase/migrations/         # additive guest-grant/limit and roster-projection migrations
supabase/tests/database/     # pgTAP access, concurrency, privilege, quota tests
types/room.ts                # active roster snapshot projection
types/guestRoom.ts           # guest snapshot projection
utils/roomSnapshot.ts        # preserve participants-based game hydration
components/lobby/            # active-roster display and pre-start allocation
__tests__/                  # hook, adapter, snapshot, and client unit tests
e2e/features/guest-room-join.feature
e2e/steps/guest-room-join.steps.ts
```

**Structure Decision**: Keep the existing Expo + Supabase shape. Public guest ingress uses the allowlisted guest-room-access Edge Function defined in the trusted-ingress contract; private helpers and guest RPCs stay server-only. The roster change adds no service, persisted column, or new authorization path.

## Delivery Sequence

**Roster-expiry delta in addition to the sequence below:** Add failing
database/client/web regressions first; implement the shared activeRoster
projection and aligned pre-start eligibility; then verify that an after-start
expiry leaves settled game state and abuse windows unchanged.

1. Establish server boundary first: migration/backfill, single validator, room-state policy, all guest RPC callers and privilege audit, pgTAP regressions. Do not expose expiry/rotation to old clients until compatibility is measured.
2. Add atomic quota enforcement and safe response envelopes; verify gateway caller identity and spoof resistance against the hosted environment before rollout.
3. Add native/web credential adapters and secure generation; remove legacy AsyncStorage immediately on read, hold the old grant only in memory while server-validating it, then transfer valid access to protected storage. Fail closed when native crypto/storage is unavailable.
4. Add rotation and leave-pending state machine with persistent pending replacement, no silent read renewal, retry behavior, confirmed in-progress leave, and guest revocation at host completion; update copy and API types.
5. Return a data-free `room_ended` result only for grants valid at the completion event; distinguish expiry/leave races, clear obsolete client credentials safely, and preserve history/quotas.
6. Run pgTAP/Jest/static checks, then leave manual browser and physical Android acceptance to the user. Do not add or run E2E tests for this amendment.

## Migration, Deployment, and Recovery

- The roster amendment is a forward-only derived projection: migration output adds activeRoster but does not remove or narrow participants. Deploy the database key before clients consume it; keep a client fallback to participants only for a server that has not yet been migrated. Expiry itself performs no data/event/counter cleanup.
- Backfill unexpired existing guest hashes to `now() + interval '48 hours'` at migration time; preserve participant IDs and existing join/leave events. Legacy credentials remain valid only within that bounded transition. Do not silently prolong on snapshots.
- Deploy database compatibility before the new client. Existing guest RPC signatures remain callable during the bounded legacy period but gain shared validation, limits, and safe responses. Version/shape checks in the client must accept both compatible success and new denial envelopes during staged rollout.
- Confirm unique-hash preflight, exact `EXECUTE` privileges, hosted forwarded-IP behavior, migration dry run, and pgTAP before deploy. Never grant `anon` access to private helpers/tables. Remove old insecure branches when the compatibility window ends.
- Rolling back client code alone cannot undo issued/rotated grants. Prefer forward-fix of security checks; if database rollback is unavoidable, retain new grant columns and deny rather than reactivating expired/rotated/left credentials. Preserve event history and abuse records; document manual recovery for legitimately stranded guests.

## Complexity Tracking

The private abuse table and platform credential adapter are required security
boundaries, not extra application backends. Principle V's E2E requirement for
the new substantial guest Room Ended screen is intentionally unmet under the
user's no-E2E instruction; this is an explicit unresolved scope exception, not
a PASS. User-performed manual acceptance remains open in T051/T074.
