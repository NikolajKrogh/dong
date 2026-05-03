# DONG

A cross-platform Expo application supporting the drinking game DONG.

## About The Project

This React Native / Expo application was developed to improve the experience of
playing drinking game **DONG**.
It provides a digital platform for:

- Managing game rules
- Retrieving matches in a time window
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
