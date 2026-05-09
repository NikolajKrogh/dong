# Quickstart: Protected Multiplayer Data Access

## Purpose

This quickstart describes how to implement and verify the RLS and grant changes for issue #125 without mixing the work with UI changes or client integration.

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

2. Confirm local service URLs and database status.

```powershell
npx supabase status
```

## Implementation Order

1. Create a migration scaffold for the access-control changes.

```powershell
npx supabase migration new add_profile_friendship_settings_rls
```

2. Implement the schema in this order:

- `friendship_status` enum
- `profiles` table
- `settings` table
- `friendships` table
- supporting indexes for profile ownership, settings ownership, friendship lookups, and accepted-friend profile visibility
- explicit grants for `authenticated` and `service_role`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on the new tables and the existing room tables
- RLS policies for profile, settings, friendship, and room reads and writes

3. Add database tests under `supabase/tests/database/`.

Recommended initial files:

- `000_extensions.test.sql`
- `010_schema.test.sql`
- `020_constraints.test.sql`
- `030_profiles_and_settings_rls.test.sql`
- `040_friendships_rls.test.sql`
- `050_room_rls.test.sql`
- `060_privileged_write_paths.test.sql`

## Authenticated User Testing

Use pgTAP fixtures inside rolled-back transactions to seed `auth.users` rows and matching `public.accounts` rows. If you need an authenticated request context for policy tests, switch the SQL session into the `authenticated` role and set the request JWT claims required by `auth.uid()`-based policies.

Avoid browser or Expo login flows for this feature. The core validation target is the database policy matrix.

## Verification Workflow

1. Reset the local database so migrations apply from scratch.

```powershell
npx supabase db reset
```

2. Run the database tests.

```powershell
npx supabase test db
```

3. If repository metadata or developer guidance changed, run lint as the final repo-level check.

```powershell
npm run lint
```

## Schema Smoke Checklist

- A signed-in user can read and update only their own profile and settings rows.
- An accepted friendship unlocks profile visibility but not settings visibility.
- Friendship rows are only visible to the requester and addressee.
- A room host or current participant can read the room snapshot for that session only.
- An unrelated user cannot read or mutate another room's data.
- Direct client writes to protected room-state tables are rejected.

## Out of Scope For This Story

- Expo or browser login UI tests
- Read models for history, comparisons, or leaderboards
- One-time local-to-cloud import
- Client integration with the new tables or RPCs

## Shutdown

When you are done with local database work:

```powershell
npx supabase stop
```
