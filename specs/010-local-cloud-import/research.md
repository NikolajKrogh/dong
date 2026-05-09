# Research: One-Time Local-to-Cloud Import

## Decision 1: Store import state in a private Supabase ledger instead of a client-only marker

**Decision**: Add private import ledger tables in Supabase Postgres to record account-level completion and per-session source fingerprints.

**Rationale**: The import has to survive retries, partial failures, and cross-device repeats. A client-side flag would be easy to lose, while a private ledger gives the server a durable source of truth without exposing extra tables through the Data API.

**Alternatives considered**:

- A local AsyncStorage marker only: rejected because it disappears with app reinstall, device migration, or a second device.
- A public table in `public`: rejected because this creates an unnecessary exposed surface and requires extra RLS/grant work for metadata that the client never needs to read directly.
- No ledger at all: rejected because per-session retries and once-per-account completion would be impossible to enforce safely.

## Decision 2: Use a secure RPC wrapper that calls a private helper, not an Edge Function

**Decision**: Expose a minimal public RPC that invokes private import helpers in the `private` schema.

**Rationale**: This feature is data-heavy and needs to create the cloud session graph, ledger rows, and error metadata atomically. A database function can validate the payload, compute fingerprints, and insert the imported sessions in one boundary without introducing a separate backend or network hop.

**Alternatives considered**:

- An Edge Function: rejected because it adds infrastructure and still needs the database for the actual writes and dedupe ledger.
- Direct client inserts into `public` tables: rejected because the client would have to bypass or duplicate the import validation logic and would not be able to enforce one-time completion safely.
- A new custom API service: rejected because the repo already standardizes on Supabase for this kind of server-authoritative workflow.

## Decision 3: Let the user choose one local participant to represent the imported account

**Decision**: Ask the user once, at import start, to choose which legacy local participant represents the signed-in account.

**Rationale**: The local snapshot has names and scores but no durable account identity. Exact-name matching is ambiguous, and guessing would make it easy to attach the wrong history to the signed-in account. A single explicit claimant selection keeps the import understandable and audit-friendly.

**Alternatives considered**:

- Match by display name automatically: rejected because duplicate names are common and mutable.
- Use the first local participant: rejected because the ordering is not a reliable identity signal.
- Import every player as a guest: rejected because the signed-in account would never get a durable identity row in the imported sessions.

## Decision 4: Compute the source fingerprint server-side from a canonical normalized session snapshot

**Decision**: The RPC will canonicalize each legacy session snapshot and compute a deterministic fingerprint in the database.

**Rationale**: The server should own dedupe semantics. Server-side fingerprinting avoids trusting the client to create uniqueness correctly and makes retries deterministic even if the payload is re-sent from another device.

**Alternatives considered**:

- Client-computed hash only: rejected because the server would still need to trust the client for uniqueness.
- Batch-level import IDs only: rejected because a batch ID can mark a retry, but it cannot uniquely identify the source session being imported.
- Fingerprint derived from the claimant choice: rejected because the same source session must remain dedupable even if the claimant selection changes or is retried incorrectly.

## Decision 5: Gate repeat runs by account completion but keep per-session dedupe until the account is completed

**Decision**: Record account-level import status and let per-session fingerprint rows dedupe retries, while treating a completed account import as terminal.

**Rationale**: The clarified story says the import is one-time for the account, but it also needs partial failures and retry behavior. The cleanest way to satisfy both is to keep the job retryable until it reaches a completed state, then no-op later runs for the same account.

**Alternatives considered**:

- Always allow re-imports: rejected because it would violate the one-time import requirement.
- Only allow one session at a time without account completion: rejected because the UX would be confusing and would not provide a clear success boundary.
- Block partial retries once any session succeeds: rejected because the spec explicitly requires retrying failed sessions without duplicating successful ones.

## Decision 6: Reuse the existing canonical session tables for imported data

**Decision**: Imported sessions will be written into the existing `game_sessions`, `participants`, `matches`, `assignments`, and `gameplay_events` tables.

**Rationale**: The repository already has a mature cloud schema and read models. Reusing those tables means imported history automatically appears in the existing history, comparison, and leaderboard surfaces without a second transformation layer.

**Alternatives considered**:

- A separate import-only mirror of history: rejected because it would duplicate the read-model work and create a second source of truth.
- Client-only cached summaries: rejected because the imported sessions would never become durable cloud history.

## Decision 7: Validate with database tests, one Settings-flow unit test, and one web E2E path

**Decision**: Use pgTAP to verify the RPC/ledger semantics, Jest + RNTL for the claimant-selection and status UI, and Playwright BDD for the web import journey.

**Rationale**: The highest risk lives in the database contract, but the new UI journey is substantial enough to warrant a single end-to-end test. The repo already has the exact tooling needed for this split.

**Alternatives considered**:

- Manual validation only: rejected because the feature is security- and idempotency-sensitive.
- E2E-only coverage: rejected because it would miss the database invariants.
- Database tests only: rejected because the claimant-selection UI is a new user journey.
