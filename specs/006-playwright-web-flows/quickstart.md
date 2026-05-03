# Quickstart: Web Flow Browser Coverage

## What this feature changes

This feature adds a stable browser-flow test path for the Expo web app and keeps the browser coverage organized around a canonical BDD suite.

## Verification steps

1. Generate the BDD output before running the browser suite:

```bash
npm run bddgen
```

2. Run the canonical browser-flow suite:

```bash
npm run test:e2e
```

3. If the remaining standalone home-shell layout regression still needs a direct check, run it with the dedicated script:

```bash
npm run test:e2e:home
```

4. If the local Expo web port is already in use or points to the wrong app, set the browser port or base URL before running the suite:

```bash
PLAYWRIGHT_WEB_PORT=8095 npm run test:e2e
```

or

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8095 npm run test:e2e
```

## Manual check list

- The home smoke path waits for actual home content, not just a loading shell.
- The setup journey completes with reusable test data.
- The canonical BDD suite owns shell launch and theme-switch coverage.
- Duplicate smoke-only browser checks are no longer required as separate coverage.
- Local and CI-oriented runs produce the same result when the app is healthy.

## Success signal

The feature is ready when one browser command covers the home smoke path and the setup journey reliably, and any remaining standalone Playwright spec is only used for a unique layout or geometry regression.
