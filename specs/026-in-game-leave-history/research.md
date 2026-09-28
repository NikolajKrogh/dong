# Research: In-Game Leave and Preserved History

## R1. Existing departure and completion contracts

**Decision**: Widen the existing registered member leave RPC for `in_progress`, reuse the existing in-progress guest leave and host handover RPCs, and retain `left_at` as the authoritative departure marker.

**Rationale**: Guest leave already locks the room and participant, writes `participant_left` once, and rejects subsequent grant use. Registered member leave currently returns `left` without changing anything outside the lobby. Host handover already accepts running rooms. End-game history already reads all persisted participants and includes `leftAt`.

**Alternative**: Add new leave RPCs for every role. Rejected because the same identity, lock, and grant lifecycle rules would be duplicated.

## R2. Live game projection

**Decision**: Restore all participants, including departed ones, in the shared game's `participants` projection while keeping `activeRoster` restricted to active identities. Expose departure time on the historical participant projection.

**Rationale**: The latest snapshot builder filters `left_at IS NULL` from `participants`, which removes early leavers from client hydration even though the database row survives. The active roster already has its own predicate.

**Alternative**: Reinsert departed players only on the client. Rejected because guests and members would receive a misleading canonical snapshot.

## R3. Exact result at departure

**Decision**: Attach a server-captured result to the immutable `participant_left` event for an in-progress departure. A registered leaver reads their own event through an invoker-security history projection until completion; the existing completed history then wins by session ID. The guest leave response returns that same capture for a local history entry after confirmation.

**Rationale**: An event snapshot is atomic with the confirmed departure. It avoids a second mutable result table and prevents later score changes from rewriting the leaver's result. The guest's bearer is cleared after confirmation, so the captured result must be returned with that response. If the response is lost, the same unexpired bearer may retrieve only its own immutable departure receipt through the leave RPC; other guest reads and writes stay revoked.

**Alternatives**: Read a mutable live room after leave (access is correctly denied and values may change); store a duplicate result table (another source of truth).

## R4. Authorization and concurrency

**Decision**: Keep the existing room-first lock order. Use the established participant/grant checks before mutation. A retry after `left_at` is set must not insert a second event. Keep score/drink/reassignment guards on active participants and require the history projection to match the signed-in account to the departed event actor.

**Rationale**: Current gameplay commands and guest grant resolution already reject `left_at` identities. Session locking serializes leave with gameplay and completion.

**Alternative**: Client-only disablement. Rejected because it cannot enforce trust boundaries.

## R5. Delivery and verification

**Decision**: Use focused pgTAP and Jest checks, static typing/lint, and manual browser/Android walkthroughs. No E2E tests are authored or run. The later user authorization permits applying the verified migration to the linked hosted project used for testing.

**Rationale**: The user explicitly prohibited E2E work and authorized connected Android exploration. Constitution Principle V's E2E gate stays recorded as unmet. Local database verification requires local Supabase availability and must be reported precisely.

**Recovery**: Deploy the additive event payload and read projection before the client. If the client must roll back, preserved participants and departure events remain valid; existing history readers ignore the added fields. Forward-fix any SQL error rather than deleting departed participants or immutable events.
