# Research: Protected Multiplayer Data Access

## Decision 1: Add the minimal `profiles`, `settings`, and `friendships` tables now

**Decision**: Treat the feature as policy-plus-minimal-data, not policy-only. Add 1:1 account-linked `profiles` and `settings` tables, plus a request-based `friendships` table.

**Rationale**: The issue explicitly names profiles, friendships, settings, and room data. The current schema only has the `accounts` anchor and room tables, so the RLS story needs actual social/settings rows to protect instead of deferring that work to a later slice.

**Alternatives considered**:

- RLS only on the existing room tables: rejected because it would leave the requested profile/settings surfaces undefined.
- Defer profile/friendship/settings tables to a follow-up story: rejected because the issue scope and clarified spec expect them in this slice.

## Decision 2: Model friendships as a request-based lifecycle with a single row per unordered pair

**Decision**: Use one `friendships` row per pair of accounts with `requester_account_id`, `addressee_account_id`, and a `friendship_status` enum containing `pending`, `accepted`, `declined`, and `canceled`.

**Rationale**: A request-based lifecycle matches the clarified requirements and keeps the access rules understandable. One row per unordered pair prevents duplicate inverse relationships and keeps accepted-friend profile visibility easy to reason about.

**Alternatives considered**:

- Accepted-friends list only: rejected because it cannot represent pending request transitions.
- Two directional rows per relationship: rejected because it makes lifecycle and uniqueness rules harder to enforce.

## Decision 3: Keep profiles friend-visible after acceptance, but keep settings owner-only

**Decision**: Let accepted friendship participants read profile rows, while settings remain owner-only for all non-service callers.

**Rationale**: The clarified specification explicitly chose accepted-friend profile visibility. Keeping settings private preserves the personal configuration boundary and avoids exposing preference data through social relationships.

**Alternatives considered**:

- Self-only profiles: rejected because the accepted clarification requires friend-visible profiles.
- Public profile reads for any signed-in user: rejected because the feature is intended to stop exposure at the friendship boundary.

## Decision 4: Protect room data with RLS and read-only client exposure, not direct client writes

**Decision**: Enable RLS on the existing room tables and keep direct client mutations off those tables. Reads are scoped to the host or current participants of a session, while mutations remain behind the approved database-command or service-role path established by the multiplayer contract.

**Rationale**: The repository already treats room state as server-authoritative and event-backed. This feature should harden that model with database policy, not weaken it by allowing direct table writes from clients.

**Alternatives considered**:

- Allow direct client updates with narrow policies: rejected because it would expose the protected gameplay surface to browser or mobile clients.
- Move room data into a separate backend service: rejected because the project is Supabase-first and already has the schema in Postgres.

## Decision 5: Use explicit grants together with RLS

**Decision**: Add explicit `GRANT` statements for the roles that should reach each table or function. Treat grants and RLS as a single migration concern.

**Rationale**: Supabase no longer auto-exposes every new public table the way older projects did. The Data API now requires explicit role privileges, and RLS only filters rows after the object is reachable.

**Alternatives considered**:

- Rely on old default grants: rejected because they are no longer reliable for new public tables.
- Hide all tables in a custom schema immediately: rejected because the feature can be secured cleanly in `public` with explicit grants and policies.

## Decision 6: Keep policy logic simple and index-backed

**Decision**: Use `auth.uid()`-based `EXISTS` checks over indexed `account_id` and `session_id` columns, and wrap direct `auth.uid()` references in `select` where the policy can benefit from per-statement caching.

**Rationale**: RLS is evaluated for every row that is considered, so the policy expressions must stay cheap. Indexed lookups on `profiles.account_id`, `settings.account_id`, `friendships.requester_account_id`, `friendships.addressee_account_id`, and the room membership columns are sufficient for this feature.

**Alternatives considered**:

- Security-definer helper functions in `public`: rejected because exposed-schema helper functions complicate the security surface.
- Broad joins inside policies: rejected because they are harder to read and can be more expensive on large tables.

## Decision 7: Validate with pgTAP fixtures inside rolled-back SQL transactions

**Decision**: Use pgTAP tests to seed `auth.users`, create matching `accounts` rows, and assert both allowed and denied access paths under authenticated and unauthorized contexts.

**Rationale**: This feature is database-first and security-sensitive. pgTAP gives the clearest evidence that grants, RLS, and policy boundaries behave as intended without involving browser or mobile login flows.

**Alternatives considered**:

- End-to-end UI login tests: rejected because there is no new UI flow in this slice.
- Service-role-only assertions: rejected because they would bypass the policies being validated.
