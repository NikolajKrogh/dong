# Research: History, Comparison, and Leaderboard Read Models

## Decision 1: Use `security_invoker` views for the non-parameterized read models

**Decision**: Implement the completed-session history overview, history totals, lifetime stats, and leaderboard as `security_invoker` views in the exposed schema.

**Rationale**: Supabase views bypass RLS by default unless they are created with `security_invoker = true`. The feature needs read surfaces that obey the underlying access rules without introducing a privileged helper layer, and conventional views keep the contract simple for the client.

**Alternatives considered**:

- Materialized views: rejected for v1 because the feature needs fresh results and the issue explicitly asks for benchmark validation before adding complexity.
- Private-schema helpers only: rejected because the client still needs a stable public read contract and the data should remain reachable through explicit grants.

## Decision 2: Use stable SQL functions for the comparison contracts

**Decision**: Implement comparison as stable SQL RPC functions, one for registered-user comparisons across completed sessions and one for session-scoped participant comparisons that can include guests when both inputs belong to the same completed session snapshot.

**Rationale**: Supabase database functions are callable through `rpc()`, can return table-shaped results, and are the right fit for parameterized read contracts. A function is also the cleanest way to return the fully aggregated comparison result, including timeline data, without forcing the client to recompute the metrics.

**Alternatives considered**:

- Client-side composition from multiple views: rejected because the feature goal is to stop local aggregation.
- A single overloaded function: rejected because the contracts are easier to reason about if the registered-user and session-scoped guest cases are explicit.

## Decision 3: Base all derived reads on completed sessions and participant rows

**Decision**: Derive session summaries, lifetime totals, comparisons, and leaderboards from `game_sessions`, `participants`, `matches`, and `assignments`, filtered to completed sessions. Use `participants.current_drink_total` as the per-session drink total and `accounts.id` as the durable key for registered users.

**Rationale**: The current schema already stores the final session-level totals and relationships needed by the client. Building read models from those tables avoids replaying gameplay events just to answer dashboard queries and keeps the contracts index-friendly.

**Alternatives considered**:

- Deriving from `gameplay_events`: rejected because it adds replay complexity that is not needed for the read-model slice.
- Introducing new summary tables: rejected because the issue asks for read models/views rather than a second mutable persistence layer.

## Decision 4: Keep leaderboards deterministic with a documented tie-break

**Decision**: Rank leaderboards by total drinks consumed in completed sessions, then by average drinks per game, then by `account_id` ascending.

**Rationale**: The clarified spec chose this order and it is deterministic, stable, and cheap to compute from the lifetime stats view. The extra tie-break on account ID prevents flicker for equal values.

**Alternatives considered**:

- Total games played as the primary rank: rejected because it would not match the agreed v1 behavior.
- Display name as the tie-break: rejected because names are not stable identity keys.

## Decision 5: Preserve guest session scope in comparisons

**Decision**: Allow guest participants in comparisons only when both inputs belong to the same completed session snapshot. Registered-user comparisons may span any completed sessions; if two registered users have no shared completed sessions, the comparison returns zero shared-session metrics and an empty timeline.

**Rationale**: Guests do not have durable identity in v1, so they must not be promoted into cross-session ranking. Registered users, however, can be compared across the full completed-session history because they do have durable account identity.

**Alternatives considered**:

- Reject guest comparisons entirely: rejected because the current client comparison flow still needs to compare session participants inside a history snapshot.
- Force registered-user comparisons to share a session: rejected because it would make the current comparison contract less useful than the existing client logic.

## Decision 6: Validate with pgTAP and benchmarked query plans

**Decision**: Use pgTAP tests for schema shape, result shapes, and guest/registered behavior, plus representative query benchmarks for the new read-model surfaces.

**Rationale**: This feature is database-first and performance-sensitive. pgTAP gives a repeatable way to prove the SQL contract, while benchmark checks make sure the views and functions remain practical as the dataset grows.

**Alternatives considered**:

- UI end-to-end coverage only: rejected because the contract is in the database layer and no new UI ships in this slice.
- Manual verification only: rejected because the issue explicitly requires validation and the repo already uses automated database tests.
