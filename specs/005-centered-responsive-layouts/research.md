# Research: Restore Centered Responsive Layouts

## Decision 1: Make the shared shell own centering

**Decision**: Treat [components/ui/ShellScreen.tsx](../../components/ui/ShellScreen.tsx) as the primary place where wide-layout centering and max-width are enforced.

**Rationale**: Multiple routes already route their wide behavior through ShellScreen, so fixing the shell gives the most leverage and reduces the chance of screen-by-screen drift.

**Alternatives considered**:

- Patching each route with ad hoc margins
- Adding more wrapper views inside every screen
- Leaving width and centering decisions to individual child components

## Decision 2: Use one shared wide-layout breakpoint

**Decision**: Reuse a single breakpoint for wide layouts instead of letting each screen and stepper re-declare `width >= 1024` independently.

**Rationale**: The regression spans Home, Setup, History, Game Progress, and Settings, so one shared breakpoint reduces mismatch risk and keeps the route behavior aligned.

**Alternatives considered**:

- Per-screen breakpoint tuning
- Device-specific breakpoints for each route
- Web-only centering rules

## Decision 3: Prefer shared width modes over local margins

**Decision**: Use the existing shared card and action width modes where possible instead of relying on `marginHorizontal` values per screen.

**Rationale**: Inline spacing is what allowed the Home screen to drift out of alignment and makes the center axis harder to reason about.

**Alternatives considered**:

- Keep route-local margin values and adjust them individually
- Add screen-specific centering wrappers around every card

## Decision 4: Constrain the setup wizard as one frame

**Decision**: Keep the setup wizard's stepper, main panel, and navigation inside one centered wide frame instead of letting the right-side content expand freely.

**Rationale**: The setup flow is the most structurally complex screen and the one most likely to produce visible drift if the shell is correct but the inner layout is unconstrained.

**Alternatives considered**:

- Center each step component independently
- Keep the current row layout and only adjust the step cards

## Decision 5: Verify with route tests plus headed Playwright

**Decision**: Keep the existing Jest route coverage and add the smallest test changes needed for Home and Settings, then use headed Playwright for visual confirmation.

**Rationale**: This is a layout regression, so prop-level assertions are useful but not sufficient by themselves.

**Alternatives considered**:

- Rely only on unit tests
- Rely only on manual smoke testing

## Notes

- No unresolved clarification markers remained after reviewing the spec and repo.
- No backend, persistence, or contract work is required for this feature.
