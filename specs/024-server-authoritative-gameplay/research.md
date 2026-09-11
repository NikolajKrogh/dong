# Research: Server-Authoritative Multiplayer Gameplay

## R1. Synchronization transport

**Decision**: Reuse `get_room_snapshot` with a four-second active-game poll,
plus immediate fetch on mount, foreground, reconnect, and successful commands.
Add `lastEventSequence` to snapshots and command results; ignore older snapshots.

**Rationale**: The lobby already proves this polling path, it meets the
five-second budget, and sequence fencing prevents slow responses rolling state
back. **Rejected**: Realtime adds channel/guest authorization work without an
acceptance benefit here; client timestamps do not define commit order.

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

**Decision**: Use the existing canonical `end_game_session` transaction. Show a
read-only final snapshot before leaving and never call local history creation
for multiplayer. Solo completion remains unchanged.

**Rationale**: #186 already preserves assignment history; room ordering decides
whether an in-flight action precedes completion or is rejected after it.

## R8. UI and testing

**Decision**: Use Tamagui for new responsive multiplayer/reassignment surfaces.
Use existing Jest/react-test-renderer for hooks and pure Edge modules, pgTAP for
persistence, JUnit for retained Java discovery, Playwright BDD for two clients,
and ADB for native smoke. Do not add RNTL
solely for this feature.

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
