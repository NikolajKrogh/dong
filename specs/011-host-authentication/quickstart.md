# Quickstart: Account Authentication

## Prerequisites

- Set the Supabase client environment variables expected by the app.
- Ensure the Supabase project allows immediate sessions on sign-up for this feature.
- Register the app redirect URLs for both the Expo scheme `myapp` and the web origin used in local development.

## Local Validation

1. Start the local Supabase stack.

   ```bash
   npm run db:start
   ```

2. Reset the local database so migrations and RLS are applied from scratch.

   ```bash
   npm run db:reset
   ```

3. Run the database test suite to verify schema, grants, RLS, and account bootstrap behavior.

   ```bash
   npm run db:test
   ```

4. Run the focused unit tests for the auth hook and account-related screens.

   ```bash
   npx jest --runInBand __tests__/hooks/useAccountAuth.test.ts __tests__/components/preferences/AccountSection.platform.test.tsx
   ```

5. Run the browser journey for the new auth flow.

   ```bash
   npm run test:e2e
   ```

6. Run lint before merge.
   ```bash
   npm run lint
   ```

## Manual Checks

- Sign up with a fresh email address, complete the display-name onboarding, and confirm the app reaches the account-ready state.
- Sign out, reload the app, and confirm the session is not restored until the user signs in again.
- Trigger password reset and confirm the recovery route can finish the password update on the target platform.
- Verify local game setup, history, and preferences still open while signed out.
