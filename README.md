# DONG

A cross-platform Expo application supporting the drinking game DONG.

## About The Project

This React Native / Expo application was developed to improve the experience of
playing drinking game **DONG**.
It provides a digital platform for:

- Managing game rules
- Retrieving matches in a time window through the command-api proxy
- Retrieving livescores

## Getting Started

Follow these simple steps to get the application running on your device.

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) and npm on your development machine
- [Expo CLI](https://docs.expo.dev/get-started/installation/) for React Native development
- A text editor or IDE of your choice (e.g., Visual Studio Code)
- An Android device/emulator for testing
- A modern browser for web preview

### Installation

1. Install dependencies:

```bash
npm install
```

2. Bootstrap the hosted Supabase public env vars for account auth:

```bash
npm run auth:env
```

This writes a gitignored `.env.local` using the linked Supabase project. If the command cannot read project keys, authenticate the CLI first with:

```bash
npx supabase login
```

After creating or changing `.env.local`, restart Expo so the `EXPO_PUBLIC_*` values are picked up by the bundle.

For local command-api backed match discovery, add the Java service base URL to `.env.local` before running Expo:

```env
EXPO_PUBLIC_COMMAND_API_URL=http://localhost:8080
```

Restart Expo after adding or changing `EXPO_PUBLIC_COMMAND_API_URL` so the match discovery client uses the updated backend URL.
The setup-game flow now calls the public Java `GET /v1/matches` endpoint instead of ESPN directly for match discovery, and repeated identical backend lookups are reused inside the configured default `PT5M` cache window.

## Local Supabase (optional)

This project supports a local Supabase development workspace for schema iteration and pgTAP tests. See `specs/007-core-supabase-schema/quickstart.md` for the authoritative quickstart.

Prerequisites:

- Docker Desktop or another supported container runtime
- Supabase CLI available via `npx supabase` (or use the Supabase MCP server if preferred)

Prefer the hosted Supabase MCP server for the shared development project when possible. This repository includes a project-scoped `.mcp.json` configuration that points at project `qccvlhblytuedgmlqfef`.

Example MCP configuration:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=qccvlhblytuedgmlqfef&features=database,development,docs"
    }
  }
}
```

When your MCP client prompts for authentication, complete the Supabase OAuth flow in the browser and then reload the client if the tools do not appear immediately.

Start the local Supabase stack:

```bash
npm run db:start
```

If you are using the hosted Supabase MCP server instead of the local stack, validate connectivity by listing migrations or querying the remote schema through the MCP database tools.

Check local service health and environment values:

```bash
npm run db:status
```

Reset the local DB and re-run migrations:

```bash
npm run db:reset
```

Run the database tests (pgTAP):

```bash
npm run db:test
```

## Account Auth Flow

Account authentication now lives in a dedicated `app/auth/` route group and is surfaced from Settings through the `Account` section.

- Signed-out users start at `/auth`.
- First-time users finish onboarding at `/auth/onboarding` before entering owner-only flows.
- Password reset starts from `/auth/reset-password` and uses the app scheme so native and web can complete the recovery link.
- Redirects preserve an optional `returnTo` query so gated owner actions can send users back to the same flow after sign-in or recovery.
- The hosted development project env can be bootstrapped into `.env.local` with `npm run auth:env`.

For local validation of the account-auth slice, use:

```bash
npm run db:test
npm run lint
npm test -- __tests__/hooks/useAccountAuth.test.ts __tests__/components/auth/AuthForm.platform.test.tsx __tests__/components/auth/UsernameOnboardingForm.platform.test.tsx __tests__/components/auth/PasswordResetForm.platform.test.tsx __tests__/components/preferences/AccountSection.platform.test.tsx __tests__/app/userPreferences.platform.test.tsx
```

## Host Profile And Synced Settings

Signed-in hosts can now manage their profile and the cloud-backed preference subset directly from Settings.

- The `Profile` section saves the visible display name to `public.accounts`.
- The synced preference subset now round-trips through `public.settings.settings_data` for `theme`, `soundEnabled`, `commonMatchNotificationsEnabled`, `configuredLeagues`, and `defaultSelectedLeagues`.
- The first authenticated restore seeds cloud settings from the device's current local preference values when no synced row exists yet.
- Signing out or losing the session clears account-bound UI state without wiping the local device store, and Settings shows a recovery message when the session expires.

For focused validation of this slice, use:

```bash
npm run db:reset
npx supabase test db supabase/tests/database/032_host_profile_and_settings.test.sql
npm test -- __tests__/hooks/useAccountAuth.test.ts __tests__/components/preferences/ProfileSection.platform.test.tsx __tests__/components/preferences/AccountSection.platform.test.tsx __tests__/components/preferences/AppearanceSettings.platform.test.tsx __tests__/components/preferences/SoundNotificationSettings.platform.test.tsx __tests__/components/preferences/LeagueSettings.platform.test.tsx __tests__/app/userPreferences.platform.test.tsx
npm run bdd:gen
```

2. Start the app in development mode:

For web preview:

```bash
npx expo start --dev-client
```

For Android preview:

```bash
npx expo run:android
```

### Building The Application

Local build:

```bash
eas build --platform android --profile preview --local
```

Remote build using EAS Build services:

```bash
eas build --platform android --profile development
```

### Contributing

Contributions are welcome. New features MUST include unit tests, and
substantial UI changes MUST include end-to-end coverage for the primary user
journey. Run `npm test` and `npm run lint` before opening a pull request.
