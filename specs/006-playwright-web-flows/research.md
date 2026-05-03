# Research: Web Flow Browser Coverage

## Decision 1: Make the BDD flow canonical

**Decision**: Use `e2e/features/app-shell.feature` and `e2e/steps/app-shell.steps.ts` as the canonical browser-flow suite for the home smoke path and the setup-to-start-game journey.

**Rationale**: One shared browser-flow suite is easier to keep stable than multiple overlapping smoke specs, and it matches the existing `playwright-bdd` setup already in the repo.

**Alternatives considered**:

- Keep smoke-only browser checks separate from the journey suite.
- Split the browser coverage between BDD and standalone specs as equal peers.

## Decision 2: Wait for actual app content, not just page load

**Decision**: Treat hydration and visible home content as the readiness signal instead of relying on `page.goto()` or `networkidle` alone.

**Rationale**: Expo web can show loading or onboarding states before the real UI is ready, so page-load events are not enough to prevent false passes.

**Alternatives considered**:

- Use only navigation completion as the smoke signal.
- Assert on the browser body being visible without waiting for app-specific markers.

## Decision 3: Parameterize the setup journey

**Decision**: Make the setup journey data-driven so player counts, match selections, and starting state can be reused across scenarios.

**Rationale**: Parameterized test data keeps the core journey reusable and makes it easy to add edge cases without rewriting the flow.

**Alternatives considered**:

- Hardcode one setup path per scenario.
- Duplicate the setup steps for each edge case.

## Decision 4: Keep standalone specs only for unique regression value

**Decision**: Retain `e2e/playwright/home-shell-flow.spec.ts` only if it covers unique layout or geometry regressions that are awkward to express in the shared BDD flow.

**Rationale**: The browser-flow suite should own the behavioral coverage; standalone specs should only exist when they add non-overlapping value.

**Alternatives considered**:

- Keep all current standalone specs indefinitely.
- Delete all standalone specs even if they provide unique layout assertions.

## Decision 5: Use one primary entrypoint for local and CI runs

**Decision**: Keep `playwright.config.ts` as the primary browser-flow entrypoint and keep `playwright.home.config.ts` only if a standalone layout spec remains necessary.

**Rationale**: One main entrypoint reduces runner confusion and makes the local and CI paths easier to document and reproduce.

**Alternatives considered**:

- Maintain separate configs for each browser check.
- Move all browser coverage to bespoke ad hoc commands.
