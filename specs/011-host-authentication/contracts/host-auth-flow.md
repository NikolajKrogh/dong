# Account Auth Flow Contract

## Screen Contract

### `app/userPreferences.tsx`

- Must expose the current account status and a clear entry into the auth flow.
- Must remain usable when the user is signed out.
- Must not block local settings sections when account auth is unavailable.

### `app/auth/index.tsx`

- Must support sign-in and sign-up with email/password.
- Must route a newly authenticated user into username onboarding when `preferred_display_name` is missing.
- Must keep account bootstrap and login state separate from local game state.

### `app/auth/onboarding.tsx`

- Must require a non-empty display name before owner-only flows continue.
- Must save that display name to `public.accounts.preferred_display_name` for the current user.

### `app/auth/reset-password.tsx`

- Must complete password recovery on web and native.
- Must allow the user to set a new password without creating a new account.

## Hook Contract

`useAccountAuth()` should expose:

- `status`: `loading | signedOut | needsDisplayName | ready | recoveringPassword`
- `session`: the current Supabase session or `null`
- `account`: the current account row or `null`
- `signIn(email, password)`
- `signUp(email, password)`
- `signOut()`
- `saveDisplayName(name)`
- `requestPasswordReset(email)`

## Gate Contract

- Owner-only screens must redirect signed-out users to the auth entry flow.
- Owner-only screens must redirect authenticated users without a display name into onboarding.
- Local setup, history, and preferences screens remain public and must not depend on account auth.

## Database Contract

- The client may read, insert, and update only the row where `public.accounts.id = auth.uid()`.
- Duplicate display names are allowed.
- Blank display names are rejected.
- `service_role` or local test setup may seed arbitrary rows for fixtures, but the app runtime must not rely on elevated access.
