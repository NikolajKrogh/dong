# Phase 0 Research and Decisions

## 2026-09-26 approved amendment

Hosted testing disproved the original forwarded-header assumption. The replacement [trusted-ingress contract](contracts/trusted-ingress.md) supersedes that conditional decision: managed CF caller identity, public-key-authenticated Edge dispatch, server-only guest RPCs, and no direct client fallback. One-origin hosted spoof/grant verification passed. At the user's direction, independent network diversity is not a release gate for this task and is not claimed as tested.

## R1 — Secure credential generation and platform storage

**Decision**: Generate 32 random bytes for each new token and rotation using a platform adapter. On native, use `expo-crypto`'s asynchronous native random-byte API; on web, use Web Crypto `getRandomValues` in a secure context. Throw a typed `secure_random_unavailable` result before a join/renewal call if either source fails. Never use `Math.random` or a timestamp fallback. Store only the current bearer and a pending-rotation record in native `expo-secure-store` (Android Keystore-backed / iOS Keychain-backed). Web uses `sessionStorage`, never AsyncStorage/localStorage. Keep non-secret room display metadata separately if needed. Handle storage write failure as a failed join/rotation and do not claim durable access.

**Rationale**: The current `utils/guestRoom.ts` uses an 18-byte crypto path with a predictable fallback and AsyncStorage for the raw bearer. [Expo Crypto](https://docs.expo.dev/versions/latest/sdk/crypto/) documents that synchronous `getRandomBytes` can fall back to `Math.random` in development; the asynchronous native variant avoids that stated fallback. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) provides native protected storage but not web. The installed Android development binary must be rebuilt to include new native modules; a JavaScript-only reload is insufficient.

**Alternatives**: `Math.random` fallback rejected; web localStorage rejected as durable bearer persistence; secure storage of the entire snapshot rejected as unnecessary. Same-origin XSS can still read `sessionStorage` and live memory; CSP, dependency hygiene, and token expiry limit but do not remove that residual risk.

## R2 — Grant state, room scope, and migration

**Decision**: Add expiry/rotation metadata to `public.participants`, where `guest_rejoin_token_hash` already binds a guest participant to one room. Keep only token hashes in Postgres. Add a global partial unique index on current guest token hash (after duplicate preflight), an index for previous-hash retry lookup, and server-check `membership_type = guest`, `left_at IS NULL`, `expires_at > now()`, current hash, room ownership, and room state on every use. Use 48 hours from issue/rotation; snapshots do not extend it. Completed and closed rooms deny all guest access; the host-completion revocation amendment supersedes the original completed-room final-view rule. Existing guest hashes get a one-time 48-hour expiry from migration deployment, with no participant/event rewrite. If a legacy duplicate hash exists across rooms, stop migration and resolve explicitly rather than pick a room silently.

**Rationale**: Current guest join is idempotent only within a room; `resolve_guest_participant` picks the latest matching hash globally, and picks/leave have independent lookups. A shared helper and global uniqueness remove ambiguous identity and inconsistent enforcement. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database function guidance](https://supabase.com/docs/guides/database/functions) require explicit grants and careful `SECURITY DEFINER` use.

**Alternatives**: New standalone grant table would duplicate participant lifecycle and need an extra migration/backfill join; direct client table access is rejected. A token cannot prove physical device ownership, so a copied current token remains a valid bearer until rotation/revocation/expiry.

## R3 — Lost-response-safe rotation and join retry

**Decision**: Client generates a proposed new token and operation ID, persists `{oldToken, newToken, operationId}` in protected/session storage *before* calling rotation. Server locks the participant row, checks current token and active room, atomically swaps current hash, expiry, and a short-lived previous-hash/operation/new-hash retry record. A retry with old token succeeds only if the same operation ID **and** proposed new-token hash match; old token never authorizes snapshot or mutation after swap. No raw new token is stored server-side or echoed on retry. Client promotes pending new token after confirmation, and retries on uncertain network outcome; app restart checks pending state first. A same-token join retry returns the original participant/event, including when initial response was lost, but a token already bound to another room is denied before a new join. Rotation/leave races serialize on the participant and room locks with a fixed lock order; terminal room state wins.

**Rationale**: Merely accepting an old token for a grace period would keep stolen copies able to read. A server-generated replacement that must be returned in a lost response would strand the guest unless raw token were retained, which is undesirable. Matching client-proposed hash yields idempotent confirmation without restoring old access. The implemented previous-hash retry window is five minutes; its metadata is ignored after that deadline and replaced by the next rotation.

**Alternatives**: Silent renewal on every snapshot rejected because 1 Hz reads would create immortal grants; accepting old bearer for room reads during grace rejected; server retention of plaintext replacement rejected.

## R4 — One authorization boundary and privilege inventory

**Decision**: Refactor guest snapshot, picks, score/drink commands, leave, and renewal to call one private `resolve_guest_participant` (with operation-specific room-state policy) rather than repeat token lookups. Join has its own code admission check but must reject globally bound tokens. Public wrappers expose only required signatures; `private` is not an API-exposed schema and its helpers/tables have no `anon`/`authenticated` execute/select grants. All definer functions pin `search_path = ''` and qualify objects. Audit `pg_proc` privileges and `public` table/RLS grants in pgTAP. Registered-member RPCs remain separate.

**Rationale**: `026_guest_room_join.sql`, `032_room_membership_rpcs.sql`, `038_player_picked_mode.sql`, and `042_server_authoritative_gameplay.sql` currently have divergent validation; several private functions explicitly grant execution to `anon`. [Supabase function guidance](https://supabase.com/docs/guides/database/functions) notes default `EXECUTE` exposure and recommends explicit revocation. Existing immutable join/leave events must remain exactly once.

**Alternatives**: Client-side checks and patching only join are bypassable; routing all game commands through a new Java service would violate Supabase-first without a necessary secret/orchestration need.

## R5 — Anonymous abuse controls and trusted caller identity

**Decision**: Use a private Postgres fixed-window counter table, atomically upserted under a unique `(kind, key_digest, window_start)` constraint. Join checks per-caller and per-submitted-code budgets **before** participant insert; snapshot checks per-caller and per-current/invalid-token budgets, with a valid-token allowance above the 1 Hz polling cadence. Configurable defaults: join 20/caller/5 min and 40/code/5 min; invalid snapshot 20/caller/min and 5/token/min; valid snapshot 90/grant/min and 600/caller/min. Counter keys are HMAC-SHA256 with a private rotation-capable secret (Supabase Vault), not raw IP/code/token or bare hash of a low-entropy room code. Keep reason/category and bucket counts only, mark rows for seven-day expiry, and require an administrator cleanup job to enforce deletion (the local stack has no `cron` schema). Serialize increment/limit decision so concurrent requests cannot overshoot; return a typed rate-limited result instead of raising after the counter write (an exception would roll back its own increment).

For caller identity, use the PostgREST gateway-provided `x-forwarded-for` request header as described in [Supabase's API security guide](https://supabase.com/docs/guides/api/securing-your-api), **only after a hosted integration test proves clients cannot spoof the value that the RPC observes**. Reject missing/malformed caller address rather than disable the caller limit. This is a release gate, not an assumption of safety. If spoofing is possible, move public join/snapshot admission behind a trusted Supabase Edge boundary that strips client forwarding headers and supplies a trusted identifier, revoke direct public bypass RPCs, then re-run contract/abuse tests before release. Do not represent per-code/per-token quotas alone as per-caller protection.

**Rationale**: Supabase documents PostgREST request headers for per-IP limits, but provenance must be verified in this deployment. `db_pre_request` alone cannot see join code/token in the RPC body, so operation-specific checks belong in the RPC transaction. `GET` pre-request checks cannot write counters; these RPCs are POST. A database table avoids external Redis on the free tier. A caller behind shared NAT may hit per-caller limits; the thresholds and valid grant bucket keep ordinary use working, while metrics/canary establish actual tuning.

**Alternatives**: In-memory app limiter is bypassable; unsalted SHA-256 of short codes is reversible; IP-only limits punish shared networks; Redis adds an extra service and cannot solve caller provenance by itself. [Supabase's Edge rate-limit example](https://supabase.com/docs/guides/functions/examples/rate-limiting) uses Redis, but it is not required if the trusted gateway signal and atomic Postgres counters pass validation.

## R6 — Public errors, revocation, and delivery

**Decision**: Unknown, closed, started, and otherwise unavailable rooms return the same public `room_unavailable` result before proof of membership. Quota returns `rate_limited` plus bounded `retryAfterSeconds` with no room/participant data. Invalid/expired/revoked grant yields a generic guest-access-loss response for public callers; the client maps its known room state to rejoin guidance. Any response path that must persist a quota increment uses an error envelope, not a raised exception. Guests may leave joinable or in-progress rooms. Leave returns `confirmed`, `already_invalid`, or a retryable transport failure; the client clears local room context only after confirmed/already-invalid revocation and presents a pending state otherwise. Host completion revokes every guest grant immediately; it retains the participant, scores, assignments, and events for history. Expiry remains the fallback if a pending leave cannot be delivered.

**Rationale**: A participant should be able to leave a room they no longer want to join, including during play; the room event and `left_at` revoke future access while settled contributions remain historical. The client must not clear the local room state on an unconfirmed request. Completion ends guest access so every connected guest can return home without erasing game history.

**Alternatives**: Clearing local state immediately and calling it revoked rejected. Changing #165's settled gameplay and history effects is out of scope; T071 allows the access-revocation transition during play without changing those effects. Public error timing should also be sampled for gross enumeration differences, though perfect constant-time behavior is not promised.

## R7 — Validation and release

**Decision**: Use pgTAP for the grant matrix, function privileges, concurrency/idempotency, quota counters, active-game leave, and completion revocation; Jest for secure generation/storage migration and hook state machines; manual browser verification and ARTEMIS physical Android smoke for the changed journeys. The user explicitly prohibits adding or running E2E tests for this amendment. Existing #191 hosted spoof, performance, and release evidence remains separate from this scoped change.

**Rationale**: Local SQL tests do not establish hosted gateway behavior, and browser tests do not prove the native module is present in the installed Android binary. These are distinct release gates.

## R8 — Expiry-aware active roster without history mutation

**Decision**: Keep the snapshot's existing participants array unchanged because
it is also the source for game-state hydration and retained participant history.
Add a separate, non-persisted activeRoster array to the shared host/guest
snapshot. A row is eligible when it has not left and is either registered or is
a guest with a current token hash and a grant expiry later than server now().
Implement the eligibility rule once as a private, non-client-callable helper;
reuse it for joinable-room assignment feasibility, host
allocations, and the locked participant-ID set in start_game_session.
Expiry must not set left_at, append an event, delete assignments/picks/history,
or alter quota windows. If expiry follows game start, only access and the
derived active roster change; settled participants, assignments, scores, and
events remain as they were.

**Alternatives**: Filtering participants by grant expiry was rejected because
roomSnapshotToGameState maps that array into players and assignments, so an
expired guest could disappear from an already-started game. Persisting an
expiry-triggered leave was rejected because expiry is not a voluntary departure
and would fabricate history. Deleting or recreating abuse windows was rejected
because caller/code quotas are independent of a guest grant lifecycle.

**Validation**: pgTAP covers both snapshot arrays, helper privileges,
assignment-plan counts,
allocation rejection for inactive IDs, and the final participant set at game
start, then confirms after-start expiry leaves settled records and quota counts
unchanged. Client/snapshot tests prove only lobby-facing lists use
activeRoster; game hydration continues to use participants. Web and physical
Android smoke verify the next refresh removes the expired guest from the live
roster.
