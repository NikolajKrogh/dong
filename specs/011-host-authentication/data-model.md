# Data Model: Account Authentication

## Entity: Account

Represents the durable authenticated identity that can create or join multiplayer sessions.

Fields:

- `id` uuid, primary key, foreign key to `auth.users(id)`
- `preferred_display_name` text, nullable until onboarding completes
- `created_at` timestamptz, default `now()`
- `updated_at` timestamptz, default `now()`

Relationships:

- One authenticated user maps to one account row.
- Multiplayer room/session tables reference `Account.id` as the owner identity.

Validation rules:

- `id` must match the signed-in user’s `auth.uid()` for client writes.
- `preferred_display_name` must be trimmed and non-empty when present.
- Duplicate display names are allowed.
- The row may exist with `preferred_display_name = NULL` before onboarding completes.

## Entity: AccountAuthSession

Represents the persisted Supabase session that restores auth state across launches and reloads.

Fields:

- `access_token`
- `refresh_token`
- `expires_at`
- `user_id`

Behavior:

- Stored and refreshed by the existing Supabase client wrapper and AsyncStorage.
- Not duplicated in Zustand or another local store.

## Entity: AccountAuthState

Represents the app-level state machine used by the auth screens and multiplayer owner gate.

States:

- `loading`
- `signedOut`
- `needsDisplayName`
- `ready`
- `recoveringPassword`

Transitions:

- `loading -> signedOut` when Supabase resolves with no session.
- `loading -> needsDisplayName` when a session exists but the account row is missing or the display name is blank.
- `loading -> ready` when a valid session and account row exist.
- `signedOut -> loading` during sign-in or sign-up submission.
- `needsDisplayName -> ready` after the display name is saved.
- `ready -> signedOut` after sign-out.
- `ready -> recoveringPassword` when a password recovery link is opened and the user is setting a new password.

## Data Integrity Notes

- Auth writes are client-driven and scoped to the signed-in user’s own account row.
- The app must never clear local game store state when auth state changes.
- No backfill of legacy local game data is required for this feature.
