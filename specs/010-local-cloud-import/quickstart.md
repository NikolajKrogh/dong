# Quickstart: One-Time Local-to-Cloud Import

## Purpose

This quickstart covers how to build and verify the one-time local-to-cloud import feature without mixing it into the unrelated gameplay or read-model flows.

## Prerequisites

- Docker Desktop or another supported local container runtime
- Node.js and npm used by this repo
- Supabase CLI available through `npx`
- Repository root at `C:\src\dong`

## Initial Setup

1. Start the local Supabase stack.

```powershell
npm run db:start
```

2. Confirm the local database and auth services are healthy.

```powershell
npm run db:status
```

## Implementation Order

1. Create a migration scaffold for the import ledger and RPC.

```powershell
npx --yes supabase migration new add_legacy_history_import
```

2. Implement the database changes in this order:

- private import-state tables and enums
- source fingerprint helper(s)
- private import processing helper
- public RPC wrapper with explicit grants
- supporting indexes for `account_id`, `source_fingerprint`, and cloud session lookups

3. Add database tests under `supabase/tests/database/`.

Recommended initial files:

- `120_legacy_history_import_schema.test.sql`
- `130_legacy_history_import_dedupe.test.sql`
- `140_legacy_history_import_claim.test.sql`
- `150_legacy_history_import_retry.test.sql`

## Authenticated User Testing

Use pgTAP fixtures inside rolled-back transactions to seed `auth.users` rows and matching `public.accounts` rows. The import contract depends on the signed-in account id and the chosen local claimant, so the database tests should build both fixtures explicitly.

Avoid browser login flows for database validation. The core correctness risks are the private import ledger, per-session fingerprint dedupe, and completion gating.

## Verification Workflow

1. Reset the local database so migrations apply from scratch.

```powershell
npm run db:reset
```

2. Run the database tests.

```powershell
npm run db:test
```

3. Run the focused unit tests for the Settings import flow and claimant selection.

```powershell
npx jest --runInBand <focused-test-file-or-pattern>
```

Use `npx jest` for one-shot runs; the repo's `npm test` script is watch mode.

4. Run the web end-to-end import journey.

```powershell
npm run test:e2e
```

The repo's Playwright BDD config already covers both desktop and phone viewports. Keep the feature flow in the main BDD config rather than moving it into the standalone home-shell config.

5. If repository metadata or developer guidance changed, run lint as the final repo-level check.

```powershell
npm run lint
```

## Smoke Checklist

- The Settings screen exposes claimant selection before import starts.
- The RPC returns per-session imported, skipped, failed, or conflict status.
- Guest participants remain session-scoped in the request payload and in the imported cloud sessions.
- Re-running the same import after completion no-ops or reports already imported.
- Imported sessions appear in the current cloud-backed history screens without extra client-side aggregation.

## Out of Scope For This Story

- Any new gameplay rules or read-model changes
- A custom backend outside Supabase
- Automatic cross-device syncing of live local and cloud state
- Guest identity promotion into durable registered accounts

## Shutdown

When you are done with local database work:

```powershell
npm run db:stop
```
