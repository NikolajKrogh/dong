# Quickstart: Host Profile and Synced Settings

## Local Setup

1. Start the local Supabase stack: `npm run db:start`
2. Refresh the local env wiring if needed: `npm run auth:env`
3. Run the database test suite: `npm run db:test`

## Focused Validation

1. Run the auth/profile unit tests with Jest:

```bash
npx jest __tests__/hooks/useAccountAuth.test.ts __tests__/components/preferences/AccountSection.platform.test.tsx __tests__/app/userPreferences.platform.test.tsx
```

2. Run the component and screen lint pass:

```bash
npm run lint
```

3. Run the Playwright BDD journey for the preferences/profile flow after the feature is implemented:

```bash
npm run test:e2e
```

4. If you need to inspect the web flow manually, start Expo web:

```bash
npm run web
```

## What to Verify

- Signed-in hosts can edit the profile fields from preferences and see the saved values restore after relaunch.
- Supported settings sync to the cloud and rehydrate after sign-in on another device or a later session.
- Sign-out and expired-session handling clears the signed-in experience without clearing device-local state.
- Database tests continue to pass for the account and settings RLS posture.