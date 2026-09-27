# Research: Server-Authoritative Multiplayer Gameplay

## R1. Synchronization transport

**Decision**: Registered participants use a private `room:<session UUID>`
Realtime channel for an empty `room_changed` Broadcast and Presence. An
authorized subscription or presence change triggers the existing canonical
snapshot RPC; the message payload never carries game state. The database emits
the Broadcast from committed gameplay events. Keep the four-second poll,
foreground refresh, mount hydration, and sequence fencing as recovery paths.
Only registered participants in an `in_progress` room may authorize the
channel; terminal rooms converge through the polling fallback.
Guests continue polling because their room-scoped bearer grants are not Auth
JWTs; do not make their channel public or put a guest credential in its topic.

**Rationale**: Issue #140 explicitly asks to restore subscriptions and presence.
Private channels plus `realtime.messages` RLS preserve the existing trust
boundary, while canonical RPC reads keep Broadcast payloads advisory. Guests
still recover within the existing poll bound. Supabase documents channel
authorization through `realtime.messages` RLS and private channels at
[Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
and client/database Broadcast at
[Broadcast](https://supabase.com/docs/guides/realtime/broadcast).

## R2. Transactions, ordering, and idempotency

**Decision**: Lock the `game_sessions` row; authorize current membership before
replay lookup; require `in_progress`; validate the idempotency key fingerprint;
apply the delta; allocate one sequence; append one immutable event; return the
result and sequence in one transaction.

**Rationale**: One aggregate lock deterministically orders score, drink,
reassignment, and completion races. Delta commands retain concurrent distinct
actions. **Rejected**: absolute last-write-wins values lose actions; per-target
locks complicate global ordering without useful room-scale throughput.

## R3. Score and drink representation

**Decision**: Manual scores carry `deltaGoals` of `-1` or `+1`. Drinks carry
integer `deltaHalfDrinks` of `-1` or `+1`, converted to the existing
`numeric(6,1)`. Events retain previous and resulting values.

**Rationale**: Half-units avoid floating-point ambiguity and absolute values
would permit stale overwrites.

## R4. Registered and guest authorization

**Decision**: One private implementation has signed-in and guest wrappers. The
first resolves `auth.uid()`; the second hashes the existing raw rejoin token in
PostgreSQL. Both require an active participant and authorize before replay.

**Rationale**: This preserves the established session-scoped guest model.
**Rejected**: anonymous table writes are unsafe; guest accounts change scope.

## R5. Trusted provider scores

**Decision**: Move active multiplayer provider refresh to
`refresh-provider-scores`, a Supabase Edge Function authenticated with the
caller JWT. The client submits only a room UUID and UUIDv4 request key. The
function derives the actor from JWT `sub`, claims a 60-second room lease through
a service-role-only RPC, fetches canonical ESPN league/date scoreboards, matches
exact event IDs, and commits validated observations through a second
service-role-only transactional RPC. Java remains responsible for setup/solo
fixture discovery and its five-minute cache, not active-game ingestion.

**Rationale**: This places the provider write boundary beside Supabase Auth and
the canonical database, prevents clients from submitting scores/provider IDs,
and keeps service credentials out of Expo. The function pins
`@supabase/server@1.5.2`, uses middleware authentication with function gateway
JWT verification disabled for current publishable-key compatibility, and
allows unauthenticated access only for CORS `OPTIONS`. **Rejected**:
client-reported provider values are forgeable; forwarding user JWTs through a
new Java mutation endpoint broadens the trusted deployment surface.

“Trusted provider ingestion” means the server fetched a configured HTTPS ESPN
endpoint and validated the response against stored provider metadata. ESPN does
not cryptographically sign these responses, so this is not cryptographic proof
of provider authorship.

## R6. Optimistic reconciliation

**Decision**: Render canonical values plus pending goal/drink deltas. Success
applies the returned absolute result/sequence then removes the delta; failure
removes it and explains why. Reassignment/completion only show pending. No
mutation is silently queued offline.

**Rationale**: An overlay survives ordinary polling and has unambiguous rollback.
In-place optimistic store mutation does not.

## R7. Completion and history

**Decision**: Use the existing canonical `end_game_session` transaction and
retain the database state `completed`, because history read models include only
that state. A completion event revokes guest grants; clients fetch the final
canonical snapshot and leave the game screen. Never call local history creation
for multiplayer. Solo completion remains unchanged.

**Rationale**: #186 already preserves assignment history; room ordering decides
whether an in-flight action precedes completion or is rejected after it.

## R8. UI and testing

**Decision**: Use existing Jest/react-test-renderer for hooks and pure Edge
modules, pgTAP for persistence and privileges, JUnit for retained Java
discovery, manual browser verification, and ARTEMIS for the connected Android
device. Do not create or run E2E tests for this task, per the user's explicit
instruction. Do not add RNTL solely for this feature.

Supabase guidance requires careful function privileges and recommends an
explicit `search_path` for `SECURITY DEFINER`; new functions therefore revoke
`PUBLIC` and grant only intended roles. RLS remains defense in depth while RPCs
are the mutation surface. References: [database functions](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[changelog](https://supabase.com/changelog).

## R9. Tamagui implementation guidance

`npx tamagui generate-prompt` was run after the local Tamagui CLI became
available. The generated guidance is retained in `tamagui-prompt.md`; the
multiplayer status and host reassignment surfaces use the existing shared
Tamagui-backed UI primitives while keeping their platform-specific modal and
layout behavior behind React Native-compatible components.

## R10. Guest-only Room Ended outcome

**Decision**: Preserve direct navigation to the existing Home screen for the
host and registered participants. A guest whose grant was valid when canonical
host completion committed receives only a data-free `room_ended` outcome; the
client clears its guest grant and active-room context once and shows a standalone
Room Ended screen. With screen-reader access disabled, its visible five-second
countdown measures only interactive foreground time and pauses while inactive.
Screen-reader users receive one explicit accessible Home action and no timed
redirect. Repeated poll, Realtime, and foreground signals use a single
non-persisted marker and navigation owner.

**Races and cleanup**: Room completion, confirmed guest leave, and grant expiry
are distinguished by server ordering. Only a grant active when completion
commits receives `room_ended`; a grant expired or revoked first keeps the
generic access-loss result. The terminal result never authorizes a snapshot or
mutation. Any completion-only grant-matching metadata is non-reversible and is
non-authorizing; retained with the existing historical participant row without deleting participants,
completed gameplay/history, or abuse counts.

**Platform limitation**: Current React Native Web accessibility detection
reports enabled for every browser session. Until the pending platform-choice
question is resolved, web follows the safe button-only path; do not claim the
five-second timer is available to all web users.

**Coverage**: Automated pgTAP/Jest/static checks cover terminal mapping,
expiry/completion/leave ordering, cleanup, history preservation, countdown
timing, accessibility, and exact-once navigation. The user owns pending manual
browser and physical Android acceptance in T051. No E2E may be added or run for
this amendment; the new substantial screen's Principle V E2E requirement is
intentionally unmet and tracked in `plan.md`.
