# Tasks: Harden Guest Room Access

**Input**: [plan](plan.md), [spec](spec.md), [research](research.md), [data model](data-model.md), [RPC contract](contracts/guest-access-rpcs.md), [storage contract](contracts/credential-storage.md), [quickstart](quickstart.md).

**Tests**: Existing #191 coverage remains historical. The 2026-09-27 amendment adds pgTAP/Jest checks; the user explicitly prohibited adding or running E2E tests for this work, so its browser/native acceptance is tracked as manual T074.

**2026-09-27 status:** The original task set was closed at the user's direction; see the prior closeout in `verification.md`. The guest-departure amendment below adds T071–T074: T071–T073 are implemented and T074 remains open pending manual browser/Android verification. Historical evidence and its original scope remain documented below.

**Organization**: Four user-story phases in spec priority order. The single additive migration is `supabase/migrations/20260920095616_harden_guest_room_access.sql`; edits to it are sequential, not parallel. Each checkbox has an exact repository path. `[P]` denotes different-file work without an unfinished task dependency.

## Phase 1: Setup

**Purpose**: Prepare only shared dependencies, preserving the dirty worktree and current Spec Kit artifacts.

- [X] T001 Install Expo-57-compatible `expo-crypto` and `expo-secure-store`, updating `package.json` and `package-lock.json`; verify the package versions rather than importing a potentially absent native module.
- [X] T002 Configure the SecureStore native plugin/backup behavior in `app.config.ts` and record the required Android/iOS development-client rebuild in `specs/025-harden-guest-room-access/quickstart.md`.

## Phase 2: Foundational — shared server boundary

**Purpose**: Establish the schema and resolver needed by all four stories. No story implementation starts until this boundary is testable.

- [X] T003 Write failing pgTAP assertions for global guest-hash uniqueness, 48-hour backfill, guest-only grant columns, expiry/left/closed denial, and registered-member non-regression in `supabase/tests/database/300_guest_grant_foundation.test.sql`.
- [X] T004 Add a duplicate-hash preflight, additive participant grant columns/checks, one-time 48-hour active-guest backfill, global current-hash and previous-hash indexes, and no event rewrite in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; stop migration on ambiguous hashes.
- [X] T005 Implement the single private current-grant/room-state resolver with schema-qualified `SECURITY DEFINER` SQL and fixed room/participant lock order in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; never authorize the previous hash for room reads or writes.
- [X] T006 Extend `supabase/tests/database/301_guest_access_privileges.test.sql` with failing assertions that `anon`/`authenticated` cannot directly execute private helpers or read guest grant columns, while permitted public wrappers and registered RPCs remain callable.
- [X] T007 Revoke obsolete private grants/default access, audit existing public overloads and RLS grants, and explicitly grant only intended public wrappers in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; make T003/T006 pass before stories proceed.

**Checkpoint**: A current, room-scoped grant resolves through one server boundary; old private entry points are not callable directly.

## Phase 3: User Story 1 — Join with a protected guest identity (P1) 🎯 MVP slice

**Goal**: Secure, retry-safe guest join and restore on native and web, with immediate cleanup of old plaintext storage.

**Independent Test**: Join/reopen in a test room on native and web; same-token retry yields one participant/event; unavailable secure randomness sends no join RPC; web session and native storage contain no durable unprotected bearer.

### Tests first

- [X] T008 [P] [US1] Add failing join retry/cross-room/reused-token/one-event assertions to `supabase/tests/database/302_guest_secure_join.test.sql`.
- [X] T009 [P] [US1] Add failing native secure-generation, SecureStore read/write/failure, and no-AsyncStorage-bearer tests in `__tests__/platform/guestCredential.native.test.ts`.
- [X] T010 [P] [US1] Add failing secure-context, same-tab `sessionStorage`, and no-`localStorage` tests in `__tests__/platform/guestCredential.web.test.ts`.
- [X] T011 [P] [US1] Extend `__tests__/hooks/useGuestRoomJoin.test.ts` and `__tests__/hooks/useGuestRoomSession.test.ts` with failing no-RPC-on-random-failure, lost-join-response retry, and immediate legacy-key deletion/validated transfer/offline-loss cases.
- [X] T012 [P] [US1] Add the web join/reload/new-session/legacy-cleanup scenario to `e2e/features/guest-room-join.feature` and failing steps plus updated RPC/storage fixture expectations in `e2e/steps/guest-room-join.steps.ts` and `e2e/steps/browser-flow.helpers.ts`.

### Implementation

- [X] T013 [P] [US1] Implement asynchronous 32-byte native token generation and SecureStore bearer/pending-record operations with typed fail-closed errors in `platform/guestCredential/index.native.ts` and `platform/guestCredential/types.ts`.
- [X] T014 [US1] Implement secure-context Web Crypto generation and browser-session-only bearer/pending-record operations in `platform/guestCredential/index.web.ts`, using the shared interface in `platform/guestCredential/types.ts` after T013 defines it.
- [X] T015 [US1] Replace the `Math.random` fallback and plaintext grant persistence in `utils/guestRoom.ts`, add expiry/error types to `types/guestRoom.ts`, and keep bearer values out of user-visible error strings.
- [X] T016 [US1] Harden `join_room_as_guest` in `supabase/migrations/20260920095616_harden_guest_room_access.sql` for global token binding, same-room idempotent retry, uniform unproven-room errors, expiry issuance, and one `participant_joined` event.
- [X] T017 [US1] Normalize compatible join success/failure envelopes and `grantExpiresAt` in `utils/supabaseClient.ts` without placing the token in URLs or diagnostics.
- [X] T018 [US1] Refactor join/restore in `hooks/useGuestRoomSession.ts` to use the platform adapter, persist retry identity safely, remove the old AsyncStorage key before any network wait, validate legacy access before protected transfer, and fail closed if storage/crypto is unavailable.
- [X] T019 [US1] Update browser-session and recovery copy in `components/guestJoin/GuestJoinForm.tsx` and `components/guestJoin/GuestJoinModal.tsx`; make T008–T012 pass and verify signed-in host join behavior is unchanged.

**Checkpoint**: US1 is demonstrable on web/native, but **not a public security release** until US2, US3, US4 and hosted/native gates pass.

## Phase 4: User Story 2 — Guest access ends predictably (P1)

**Goal**: Expiry, rotation, completed/closed access, and honest leave outcomes without changing #165 settled gameplay or history effects.

**Independent Test**: Rotate with a lost response and restart, then prove old token cannot read/act; expire, leave, complete, and close separate rooms and verify the specified read/write matrix and UI recovery.

### Tests first

- [X] T020 [P] [US2] Add failing atomic rotation, exact retry tuple, expiry, and old-hash denial assertions in `supabase/tests/database/303_guest_grant_rotation.test.sql`; verify concurrent copied-token replay with independent database sessions in `scripts/test-guest-concurrency.mjs`.
- [X] T021 [P] [US2] Add confirmed/pending leave, one leave event, original completed final-only read, and closed denial assertions in `supabase/tests/database/304_guest_grant_lifecycle.test.sql`; T073 later supersedes the final-read assertion with host-completion revocation. Verify a room-close/rotation terminal race with independent database sessions in `scripts/test-guest-concurrency.mjs`.
- [X] T022 [P] [US2] Extend `__tests__/hooks/useGuestRoomSession.test.ts` with failing proactive renewal, persist-before-call, crash/restart retry, no old-token poll, offline leave retry, and accurate expiry/rejoin copy tests.
- [X] T023 [P] [US2] Add web expiry/renewal/confirmed-leave/completed-final/closed-room scenarios in `e2e/features/guest-room-join.feature` and `e2e/steps/guest-room-join.steps.ts`, initially failing against current browser fixtures.

### Implementation

- [X] T024 [US2] Add `rotate_guest_room_grant(old_token,new_token,operation_id)` and bounded previous-hash retry confirmation to `supabase/migrations/20260920095616_harden_guest_room_access.sql`; swap hash/expiry transactionally, without storing or echoing the new raw bearer.
- [X] T025 [US2] Route guest snapshot, picks, score, and drink operations through the shared resolver in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; apply current/expired/left/room-state checks and the original final-result-only completed projection while preserving game-command idempotency. T073 later revokes completed-room guest reads.
- [X] T026 [US2] Implement the original joinable-only leave boundary in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; its in-progress `not_permitted` behavior is superseded by the later confirmed-departure amendment in T071.
- [X] T027 [US2] Extend `types/guestRoom.ts` with grant expiry, rotation ID, pending leave, and confirmed/invalid/not-permitted outcomes aligned to `contracts/guest-access-rpcs.md`.
- [X] T028 [US2] Implement rotation/leave RPCs and parse access-loss/terminal envelopes in `utils/supabaseClient.ts`, preserving compatible existing snapshot success fields.
- [X] T029 [US2] Implement proactive renewal, persisted pending replacement before RPC, exact retry on uncertain response, protected pending-leave retry, and terminal/access-loss clearing in `hooks/useGuestRoomSession.ts`.
- [X] T030 [US2] Show pending revocation, confirmed departure, expired access, and accurate rejoin eligibility in `components/guestJoin/GuestJoinLobby.tsx` and `components/lobby/RoomEndedNotice.tsx` without exposing the bearer or full code.
- [X] T031 [US2] Update `e2e/steps/browser-flow.helpers.ts` to mock rotation, expiry, leave outcomes, and terminal rooms without making browser-only tests appear to prove hosted authorization.
- [X] T032 [US2] Make T020–T023 pass and add a one-join/one-leave immutable-event regression to `supabase/tests/database/304_guest_grant_lifecycle.test.sql`.

**Checkpoint**: All old/replaced/expired/left/closed grants are denied server-side; client recovery and pending state are truthful.

## Phase 5: User Story 3 — Public room entry resists guessing and flooding (P1)

**Goal**: Server-side caller/code/grant quotas and indistinguishable pre-proof room failures, preserving valid 1 Hz refreshes.

**Independent Test**: From anonymous clients, exceed each quota concurrently and verify no extra participant or room disclosure; eight legitimate guests join and valid refreshes continue while unrelated traffic is limited.

### Tests first

- [X] T033 [P] [US3] Add failing atomic fixed-window, caller/code/invalid-token/current-grant threshold, missing/spoofed-identity, and rollback-resistant counter tests in `supabase/tests/database/305_guest_abuse_limits.test.sql`.
- [X] T034 [P] [US3] Add failing `room_unavailable`/`rate_limited`/`retryAfterSeconds` parsing and no-secret error tests in `__tests__/utils/supabaseClient.guestAccess.test.ts`.

### Implementation

- [X] T035 [US3] Create `private.guest_abuse_windows`, expiry index, HMAC/Vault key lookup, server-controlled bounded threshold config, and atomic counter helper in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; never store raw IP/code/token or bare low-entropy code hash.
- [X] T036 [US3] Apply caller and normalized-code admission **before** join insert and unify unknown/closed/in-progress public result shapes in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; return a committed limit envelope rather than raising after counter writes.
- [X] T037 [US3] Apply stricter invalid-grant and 1 Hz-safe valid-grant snapshot quotas in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; change the snapshot wrapper from `STABLE` to `VOLATILE` and cover old signature/overload bypasses.
- [X] T038 [US3] Map safe retry timing and uniform room-unavailable messages in `utils/supabaseClient.ts`, `utils/guestRoom.ts`, and `components/guestJoin/GuestJoinForm.tsx`; never reveal room existence or raw inputs in errors.
- [X] T039 [US3] Implement a staging-only hosted `X-Forwarded-For` spoof/origin probe in `scripts/test-guest-caller-provenance.ps1` that records only redacted observations and cannot target production without an explicit host argument.
- [x] T040 [US3] Verify caller provenance against the deployed managed Edge gateway from the available authorized hosted origin. Confirm forged non-CF headers cannot change caller attribution and direct guest RPC execution remains denied; record redacted results in `specs/025-harden-guest-room-access/verification.md` and **stop release** if caller identity is not gateway-controlled. Network diversity is not part of this task's user-approved scope. The initial bypass and ingress correction are already documented; do not re-plan that completed design change.
- [x] T041 [US3] Using the hosted gateway after T040 passes and T070 is provisioned, validate eight invited guests can join and authorized guests sustain normal 1 Hz snapshots while unrelated invalid requests are limited; record guest counts and functional outcomes in `specs/025-harden-guest-room-access/verification.md`. The 24-session local quota burst, copied-token rotation replay, and room-close/renewal race are already verified by `scripts/test-guest-concurrency.mjs`. Closed on user confirmation that all remaining verification is complete; see `verification.md`.

**Checkpoint**: Server quotas are atomic and gateway caller provenance is confirmed; otherwise the story and release remain incomplete.

## Phase 6: User Story 4 — One auditable guest boundary (P2)

**Goal**: No alternate guest RPC grants data or mutation privileges to invalid credentials, and diagnostic records expose no secrets.

**Independent Test**: For every guest-facing operation, test current/missing/expired/replaced/revoked/cross-room grant in each room state and audit function/table grants, events, responses, and client diagnostic paths.

### Tests first

- [X] T042 [P] [US4] Add the full guest-RPC and room-state allow/deny matrix plus `anon`/`authenticated` privilege assertions in `supabase/tests/database/306_guest_access_matrix.test.sql`.
- [X] T043 [US4] Add no-raw-token/code unit assertions for every guest RPC and error path in `__tests__/utils/supabaseClient.guestAccess.test.ts` and event assertions in `supabase/tests/database/306_guest_access_matrix.test.sql`.
- [X] T044 [P] [US4] Add web browser URL/session/local-storage and UI-error leakage assertions in `e2e/features/guest-room-join.feature` and `e2e/steps/guest-room-join.steps.ts`.

### Implementation

- [X] T045 [US4] Audit and close all historical private-function grants, public overloads, direct table/RLS paths, and guest command validators in `supabase/migrations/20260920095616_harden_guest_room_access.sql`; retain registered host/member access and immutable command events.
- [X] T046 [US4] Remove raw bearer/full-code propagation from client logging, URL construction, and exception serialization in `utils/supabaseClient.ts`, `utils/guestRoom.ts`, and `hooks/useGuestRoomSession.ts`.
- [X] T047 [US4] Reconcile guest score/drink/pick callers and signed-in host/member regression tests in `__tests__/utils/supabaseClient.gameplay.test.ts`, `__tests__/hooks/useActiveGameRoomSync.test.ts`, and `supabase/tests/database/306_guest_access_matrix.test.sql`.
- [X] T048 [US4] Make T042–T044 pass and record a redacted event/diagnostic sample plus resolved privilege inventory in `specs/025-harden-guest-room-access/verification.md`.

**Checkpoint**: Every guest entry point shares one enforcement policy and produces no raw-secret diagnostics.

## Phase 7: Polish, release, and cross-cutting verification

- [X] T049 Run `npm run db:test` against a verified disposable local Supabase stack and check the migrated schema through PostgREST; record results and any migration/schema-cache issues in `specs/025-harden-guest-room-access/verification.md`.
- [X] T050 Run `npm run test:ci -- --runInBand`, `npm run lint`, and a TypeScript check; record scoped versus pre-existing findings in `specs/025-harden-guest-room-access/verification.md`.
- [X] T051 Run `npm run test:e2e` with the web app and record primary guest journey results and mock limitations in `specs/025-harden-guest-room-access/verification.md`.
- [X] T052 Rebuild the native development client and perform a physical Android join/reopen/storage/expiry smoke, recording direct device and native-module evidence in `specs/025-harden-guest-room-access/verification.md`; if authoring mobile test code, explore first with ARTEMIS as required by `AGENTS.md`.
- [x] T053 After T040 and T070 pass, measure the hosted canary's p95 join/refresh latency under eight invited guests, valid 1 Hz polling, and a bounded invalid-request spray; record redacted gateway and latency evidence in `specs/025-harden-guest-room-access/verification.md`. Closed on user confirmation that all remaining verification is complete; no latency figures were independently captured by Codex.
- [X] T054 Document duplicate-hash preflight, local migration dry run, old-client compatibility, Vault/HMAC setup, quota cleanup, rollout order, and forward-fix rollback/recovery in `specs/025-harden-guest-room-access/quickstart.md`.
- [x] T070 After explicit user approval, provision a daily cleanup job in the approved hosted project using the Supabase Cron Dashboard or the supported `cron.schedule` function (never direct writes to `cron.job`) to delete only rows where `private.guest_abuse_windows.expires_at <= now()`; verify expired rows are removed, live-window counters are preserved, and a successful run is evidenced in `specs/025-harden-guest-room-access/verification.md`. Complete this before hosted canary traffic in T041/T053.
- [x] T055 After T040, T041, T053, and T070 are resolved, recheck FR-001–FR-019 and SC-001–SC-010, hosted caller-provenance gate, no-secret samples, Android evidence, old-client upgrade path, test status, retention job, and unresolved blockers in `specs/025-harden-guest-room-access/verification.md`; do not mark release ready while any security gate is unproved. Closed on the user's confirmation that all verification needed is complete; this is not an independent Codex release certification.

## Phase 8: Approved amendment — expiry-aware live roster

**Purpose**: Remove expired guests from the live lobby and next-game eligibility while keeping participant/game history and anonymous quota accounting intact. This is an additive #191 slice; it does not close the earlier incomplete security/release tasks above.

**Independent Test**: With registered, current guest, expired guest, and confirmed-left participants, compare host/guest snapshots, assignment feasibility, allocation validation, and game-start participants. Then expire a grant after start and prove settled records and abuse counters do not change.

### Tests first

- [X] T062 [P] [US2] Add pgTAP regressions for host/guest activeRoster, unchanged participants, expiry-aware assignmentPlan, inactive host-allocation rejection, eligible IDs at game start, unchanged started-game history, and private.is_active_room_roster_member privileges in supabase/tests/database/309_guest_active_roster.test.sql.
- [X] T063 [P] [US3] Add an isolated pgTAP regression that grant expiry preserves caller/code counts and still enforces the configured threshold without deleting, recreating, or refunding private.guest_abuse_windows rows in supabase/tests/database/310_guest_expiry_quota_preservation.test.sql.
- [X] T064 [P] [US2] Add failing snapshot-projection and guest-lobby tests: live-roster selection follows activeRoster with a legacy fallback, game hydration retains participants, and the guest roster hides expired identities, in __tests__/utils/roomSnapshot.test.ts and __tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx.
- [X] T065 [P] [US2] Add a web host-and-guest acceptance scenario where refresh hides an expired guest from the live roster but preserves the history/game participant projection in e2e/features/guest-room-join.feature, e2e/steps/guest-room-join.steps.ts, and e2e/steps/browser-flow.helpers.ts.

### Implementation

- [X] T066 [US2] Create a forward-only migration with supabase migration new guest_active_roster; define private.is_active_room_roster_member with explicit least-privilege grants, add the shared activeRoster snapshot projection, and align assignment-plan counts, host-assignment validation, and locked start_game_session IDs to that helper, preserving the participants JSON field and existing RPC signatures/grants.
- [X] T067 [US2] Add compatible activeRoster fields/fixtures to types/room.ts, types/guestRoom.ts, and test fixtures; add a roomSnapshotToActiveRoster helper and update app/lobby/[sessionId].tsx and GuestJoinLobby live/pre-start views to use it, while leaving roomSnapshotToGameState on participants.
- [X] T068 [US2] Make T062–T065 pass; run focused pgTAP, Jest, and Playwright tests plus migration dry-run, and record outcomes in specs/025-harden-guest-room-access/verification.md without changing unrelated task statuses.
- [X] T069 [US2] Verify the expired-guest lobby behavior on the connected physical Android using a fresh test room on the approved pre-release project; confirm expiry removes only the live-roster entry and preserves history, then document direct device evidence in specs/025-harden-guest-room-access/android-verification.md and specs/025-harden-guest-room-access/verification.md.

## Dependencies & execution order

### Approved trusted-ingress follow-up

- [x] T056 Verify managed Edge caller provenance and document the replacement contract.
- [x] T057 Add and validate a forward migration closing all direct guest RPC grants and requiring server-authenticated caller identity.
- [x] T058 Implement bounded allowlisted guest Edge dispatch with safe errors and automated tests.
- [x] T059 Route the guest client through Edge with no direct fallback and update transport tests.
- [x] T060 Deploy and verify hosted spoof rejection, shared caller limits, direct-RPC denial and preserved data; record outstanding acceptance gates.
- [x] T061 Fix AND-191-02: permit completed guests to revoke final-read access without changing historical membership, totals or events; observe regression failure, pass lifecycle/full database tests, and deploy a forward migration.

```text
Setup T001–T002
  → Foundation T003–T007
  → US1 T008–T019
  → US2 T020–T032
  → US3 T033–T041
  → US4 T042–T048
  → Release checks T049–T055 and T070 (hosted canary tasks T041/T053 depend on T040 and T070; final audit T055 follows those gates)
```

US2 relies on US1's protected pending-token storage and joined identity. US3 relies on the shared grant resolver and hardened join/snapshot wrappers; its tests can be drafted earlier, but implementation in migration 043 follows US2 to avoid conflicting edits. US4 audits the completed paths from all three P1 stories. The `[P]` tests in distinct files can be worked in parallel within their phase; any two tasks touching migration 043, `useGuestRoomSession.ts`, or the same E2E files are sequential. T049–T053 may run as separate verification streams, but writing their shared evidence document is serialized to avoid overwrites.

## Parallel examples

- **US1**: Draft T008 SQL test, T009 native adapter test, T010 web adapter test, and T011 hook tests in parallel; implement T013 before T014 because T013 creates the shared `types.ts` interface.
- **US2**: Draft T020 rotation pgTAP and T021 lifecycle pgTAP in parallel; T024–T026 are sequential edits to migration 043.
- **US3**: Draft T033 database limit test and T034 client error test in parallel; T035–T037 are sequential database edits. Hosted T040 follows T039 and working staging deployment.
- **US4**: Draft T042 database matrix and T044 browser leakage test in parallel; close server grants (T045) before the final privilege evidence (T048).

## Implementation strategy

**MVP slice**: Setup + Foundation + US1 gives a protected, retry-safe join/restore demonstration. Do not publicly release this slice as the completed security feature; access lifecycle and abuse controls are still outstanding.

**Incremental completion**: Add US2 for bounded/revocable grants, US3 for verified server abuse controls, US4 for comprehensive boundary audit, then complete all local, hosted, web, and physical-native release gates. If the hosted caller address is spoofable or unverifiable, stop at T040 and revise the ingress design before proceeding to release.

**Notes**: Tests should be observed failing for the intended reason before implementation. Do not reset a linked database, overwrite unrelated local work, put service/Vault secrets in the client, or equate browser mocks with hosted or physical-device validation. Optional Spec Kit git-commit hooks are not prerequisites to the tasks.

## User-reported guest departure amendment (2026-09-27)

- [x] T071 Allow a guest with a valid grant to leave a joinable or in-progress room; on confirmed in-progress leave, set `left_at`, append one `participant_left` event, deny the old grant, and preserve settled gameplay/history. Add pgTAP coverage.
- [x] T072 Return a confirmed/pending outcome from `useGuestRoomSession.leaveRoom`; only clear local room context and close the guest modal after the server confirms or reports access already invalid. Add Jest coverage for confirmed, denied, and offline outcomes.
- [x] T073 Verify host completion invalidates guest snapshot and mutation access without deleting the historical participant or changing scores, assignments, or events; extend pgTAP coverage in coordination with #140 T061.
- [ ] T074 Manually verify the in-progress leave and host-completion paths in the browser and on the connected Android device after an isolated test room is available; record that guest access loss and host-completion home navigation meet #140 SC-011's five-second target. No E2E test may be added or run for this task.

## Friendly room-ended amendment

- [x] T075 Add secure room_ended response in migration 20260927145117 and database test 312.
- [x] T076 Preserve terminal reason; serialize cleanup and reject stale responses and duplicate navigation.
- [x] T077 Run focused unit/database/static checks and independent review; see verification.md. No E2E.

Android is user-confirmed working; browser timing and unreported manual subcases remain pending.
