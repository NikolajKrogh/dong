# Quickstart: Cloud Gameplay Core Data Model

## Purpose

This quickstart describes how to implement and verify the core Supabase schema for issue #128 without mixing it with UI login flows or Expo client integration work.

## Prerequisites

- Docker Desktop or another supported local container runtime
- Node.js and npm already used by this repo
- Supabase CLI available through `npx supabase`
- Repository root at `C:\src\dong`

## Initial Setup

1. Initialize the first local Supabase workspace if it does not exist yet.

```powershell
npx supabase init --yes
```

2. Start the local Supabase stack.

```powershell
npx supabase start
```

3. Confirm local service URLs and credentials.

```powershell
npx supabase status
```

## Implementation Order

1. Create a migration scaffold for the core schema foundation.

```powershell
npx supabase migration new core_shared_session_schema
```

Keep the schema changes in separate, ordered migration files so the local database can be reset and the full migration chain can be replayed cleanly during rollback or rerun scenarios.

2. Implement the migration in this order:

- enum types or constrained text conventions
- `accounts`
- `game_sessions`
- `participants`
- `matches`
- same-session `common_match_id` reference from sessions to matches
- `assignments`
- `gameplay_events`
- helper functions or triggers for completion guards, timestamps, and event sequencing
- indexes for join code, host ownership, participant identity, guest reclaim, assignments, and event replay

3. Add database tests under `supabase/tests/database/`.

Recommended initial files:

- `000_extensions.test.sql`
- `010_schema.test.sql`
- `020_constraints.test.sql`
- `030_authenticated_host.test.sql`
- `040_guest_reclaim.test.sql`
- `050_idempotency_and_completion.test.sql`

## Authenticated User Testing

Do not drive a browser or Expo login flow for this story. Use pgTAP with direct test fixtures in `auth.users` and `public.accounts` to create authenticated host and participant contexts inside database tests.

Implementation note: the current local Supabase image available in this repo supports `pgtap`, but does not currently expose the `basejump-supabase_test_helpers` extension. The database tests therefore seed `auth.users` rows directly inside rolled-back transactions when they need an authenticated identity fixture.

Example pattern:

```sql
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (
	id,
	aud,
	role,
	email,
	email_confirmed_at,
	created_at,
	updated_at,
	raw_app_meta_data,
	raw_user_meta_data,
	is_sso_user,
	is_anonymous
)
values (
	gen_random_uuid(),
	'authenticated',
	'authenticated',
	'host@test.local',
	now(),
	now(),
	now(),
	'{"provider":"email","providers":["email"]}'::jsonb,
	'{}'::jsonb,
	false,
	false
)
returning id;

-- authenticated host assertions go here

select * from finish();
rollback;
```

Use the inserted auth fixture to create matching `public.accounts` rows for host-owned session creation and later ownership assertions. Use unrestricted setup only for fixtures, never for the access-control assertions themselves.

## Verification Workflow

1. Reset the local database so migrations apply from scratch.

```powershell
npx supabase db reset
```

2. Run the database tests.

```powershell
npx supabase test db
```

3. If repository root metadata files changed, run lint as the final repo-level check.

```powershell
npm run lint
```

## Schema Smoke Checklist

- Host account ids map cleanly from `auth.users` into `public.accounts`.
- A non-completed session can be created with one active join code and one host account.
- The same registered account cannot create a duplicate participant membership in the same session.
- A reconnecting guest using the same rejoin token resolves to the existing participant row.
- Assignments cannot reference a participant or match from another session.
- Reusing the same `(session_id, idempotency_key)` does not create a second event.
- Any history-affecting write against a completed session is rejected.

## Out of Scope For This Story

- Expo or browser login UI tests
- Read models for history, comparison, or leaderboards
- Full RLS authoring and validation
- One-time local-to-cloud import
- Client integration with the new tables or RPCs

## Shutdown

When you are done with local database work:

```powershell
npx supabase stop
```