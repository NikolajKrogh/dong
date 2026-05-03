# Research: Cloud Gameplay Core Data Model

## Decision 1: Add a first top-level `supabase/` workspace and keep all schema and DB tests there

**Decision**: Introduce a new repository-root `supabase/` directory managed by Supabase CLI for local config, migrations, and pgTAP database tests.

**Rationale**: The repo has no existing Supabase layout, and the CLI expects a conventional `supabase/` workspace. Keeping migrations and DB tests together isolates backend persistence work from the Expo runtime code and makes later CI adoption straightforward.

**Alternatives considered**:

- Keep SQL files under `specs/` or `python/`: rejected because those locations are design or utility areas, not executable schema sources.
- Use ad hoc SQL scripts without Supabase CLI structure: rejected because it would make local reset, migration history, and DB test execution brittle.

## Decision 2: Treat `auth.users` as the identity source and map it 1:1 into `public.accounts`

**Decision**: Create a `public.accounts` table keyed 1:1 to `auth.users.id` instead of duplicating credential data in an application-owned auth table.

**Rationale**: Supabase Auth already owns durable authentication identity. Using the same UUID in `public.accounts` keeps the domain schema aligned with `auth.uid()`, avoids duplicated credential fields, and leaves room for future profile, friendship, and settings tables to hang off the account row cleanly.

**Alternatives considered**:

- Store a standalone `accounts` table with duplicated email and auth fields: rejected because it splits identity across two systems and complicates later RLS.
- Use only `auth.users` with no domain table: rejected because later application-owned relationships and profile-like data would have no stable public anchor.

## Decision 3: Model sessions as active-until-completed records with partial unique join codes and a direct common-match reference

**Decision**: Use `game_sessions` as the authoritative room table with `state`, `join_code`, `host_account_id`, `last_event_sequence`, and `common_match_id`. Enforce join-code uniqueness only for non-completed sessions and treat `completed` as the only no-longer-joinable state in v1.

**Rationale**: The clarified spec says sessions stay joinable until completion, so a partial unique index on active sessions matches product behavior better than a globally unique code. Storing `common_match_id` directly on the session mirrors the current app model and makes room hydration simple for later clients.

**Alternatives considered**:

- Enforce globally unique join codes forever: rejected because short room codes are easier to manage when they can be reused after a session completes.
- Store `is_common` on `matches` instead of `common_match_id` on the session: rejected because the session already owns the setup summary and the current app model centers common-match selection at the session level.

## Decision 4: Use composite foreign keys to enforce same-session relationships at the database layer

**Decision**: Carry `session_id` on `participants`, `matches`, `assignments`, and `gameplay_events`, and use composite keys like `(session_id, participant_id)` and `(session_id, match_id)` to guarantee assignments and event actors cannot cross session boundaries.

**Rationale**: PostgreSQL check constraints cannot safely depend on row lookups in other tables, while composite foreign keys let the database reject cross-session joins deterministically. This is especially important for assignments, actor references, and the session-owned common match.

**Alternatives considered**:

- Validate cross-session integrity only in application code: rejected because it allows bad writes from scripts, future bugs, or misconfigured service paths.
- Use trigger-based subquery checks everywhere: rejected because composite foreign keys are simpler, clearer, and easier to test.

## Decision 5: Store guest reclaim data as a hashed token on `participants` and keep one registered membership per account per session

**Decision**: Represent guest reclaim as a logical token attached to a guest participant row via a hashed token column, and enforce one registered participant membership per `(session_id, account_id)` with a partial unique index.

**Rationale**: The clarified spec requires guests to reclaim the same participant record and registered users to avoid duplicate memberships. One hashed token per guest participant keeps the core schema lean, avoids a separate token table in v1, and lets the server return the raw token once without storing it in plaintext.

**Alternatives considered**:

- Separate `guest_rejoin_tokens` table: rejected for the core story because it adds another lifecycle table without solving a current problem.
- Match reconnecting guests by display name: rejected because names are mutable and collision-prone.

## Decision 6: Use immutable `gameplay_events` with per-session sequencing and unique session-scoped idempotency on the same table

**Decision**: Append all history-affecting mutations to `gameplay_events`, give each event a deterministic `sequence_number` per session, and enforce one authoritative result with `UNIQUE(session_id, idempotency_key)` on the event table itself.

**Rationale**: The spec requires auditable history, retry safety, and reconstructable outcomes. Keeping idempotency and ordered history together in one table reduces moving parts, while `game_sessions.last_event_sequence` enables atomic event numbering without scanning the full event stream.

**Alternatives considered**:

- Maintain only mutable session snapshots and derive nothing from events: rejected because it violates the constitution’s event-backed history rule.
- Keep a separate `idempotency_keys` ledger table: rejected because one history-affecting command maps cleanly to one immutable event row in v1.
- Split event types into separate physical tables: rejected because it would complicate replay and ordering queries across multiple event streams.

## Decision 7: Use pgTAP plus `basejump-supabase_test_helpers` for authenticated DB tests instead of browser login flows

**Decision**: Validate schema, constraints, and authenticated-user behavior with `supabase test db`, pgTAP, and Supabase test helpers that create Auth users and impersonate them inside SQL tests.

**Rationale**: This story is database-first. The highest-value tests exercise constraints and future RLS-ready identity behavior directly inside Postgres, not through UI login flows. The helper extension gives repeatable authenticated contexts without mixing service-role setup with app-level assertions.

**Alternatives considered**:

- Drive real login UI flows in Playwright or Expo tests: rejected because there is no user-facing auth flow in this story and UI tests would not validate core DB invariants well.
- Use only service-role queries for test assertions: rejected because they can bypass the very ownership and policy boundaries the schema is preparing for.
- Rely only on Jest integration tests: rejected because the core correctness risks live in SQL constraints, triggers, and relational integrity.
