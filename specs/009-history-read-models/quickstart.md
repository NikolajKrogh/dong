# Quickstart: History, Comparison, and Leaderboard Read Models

## Purpose

This quickstart covers how to implement and verify the read-model layer for issue #126 without changing the current Expo screens in the same slice.

## Prerequisites

- Docker Desktop or another supported local container runtime
- Node.js and npm already used by this repo
- Supabase CLI available through `npx supabase`
- Repository root at `C:\src\dong`

## Initial Setup

1. Start the local Supabase stack.

```powershell
npx supabase start
```

2. Confirm the local database is healthy.

```powershell
npx supabase status
```

## Implementation Order

1. Create a migration scaffold for the read-model changes.

```powershell
npx supabase migration new add_history_read_models
```

2. Implement the read surfaces in this order:

- `completed_session_summaries` security-invoker view
- `history_overview_totals` security-invoker view
- `lifetime_player_stats` security-invoker view
- `leaderboard_entries` security-invoker view
- `compare_registered_players` stable SQL function
- `compare_session_participants` stable SQL function
- explicit grants for `authenticated` and `service_role`
- supporting indexes if benchmarked queries need them

3. Add pgTAP tests under `supabase/tests/database/`.

Recommended initial files:

- `070_history_read_models_schema.test.sql`
- `080_history_read_models_results.test.sql`
- `090_history_read_models_contract.test.sql`
- `100_history_read_models_performance.test.sql`

## Authenticated User Testing

Use pgTAP fixtures inside rolled-back transactions to seed `auth.users` rows and matching `public.accounts` rows. For guest scenarios, seed the session-scoped `participants` rows directly and keep the comparison tests focused on the relevant completed session snapshot.

Avoid browser or Expo login flows for this feature. The core validation target is the database contract matrix.

## Verification Workflow

1. Reset the local database so migrations apply from scratch.

```powershell
npx supabase db reset
```

2. Run the database tests.

```powershell
npx supabase test db
```

The test suite covers history summaries, lifetime stats, comparisons, leaderboards, and a performance smoke file under `supabase/tests/database/`.

3. Benchmark the representative read-model queries.

Use either a dedicated performance pgTAP file or `EXPLAIN (ANALYZE, BUFFERS)` against the fixture data to confirm the query plan stays index-backed and deterministic.

4. If repository metadata or developer guidance changed, run lint as the final repo-level check.

```powershell
npm run lint
```

## Smoke Checklist

- Completed-session history only returns completed sessions.
- History overview totals match the underlying completed-session dataset.
- Lifetime stats exclude guest participants.
- Leaderboards are ordered by total drinks, then average drinks per game, then account ID.
- Registered-user comparisons return zero shared-session metrics and an empty timeline when there is no overlap.
- Guest comparisons are only valid inside one completed session snapshot.

## Out of Scope For This Story

- Expo or browser login UI tests
- Materialized views unless performance benchmarks show they are required
- One-time local-to-cloud import
- Client integration with the new read models

## Shutdown

When you are done with local database work:

```powershell
npx supabase stop
```
