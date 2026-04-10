# Phase 0 Research: Define the Design Language

## Decision 1: Place the final DESIGN.md at the repository root

- **Decision**: The implementation should create a single `DESIGN.md` at the repository root, while supporting planning artifacts remain under `specs/001-define-design-language/`.
- **Rationale**: The document is intended to be the primary visual contract for contributors and coding agents. A root-level location makes it discoverable without prior knowledge of the feature directory and aligns with how `DESIGN.md` is typically consumed in agent-driven workflows.
- **Alternatives considered**:
  - `docs/DESIGN.md`: Rejected because the repository does not currently use a dedicated docs structure and this adds an extra discovery step.
  - `specs/001-define-design-language/DESIGN.md`: Rejected because the final artifact is meant to outlive the planning folder and serve day-to-day product work.

## Decision 2: Use the centralized palette and theme files as the audit anchor

- **Decision**: Treat `app/style/palette.ts` and `app/style/theme.ts` as the canonical token entry points, then validate recurring usage across the shared style modules in `app/style/`.
- **Rationale**: The repository already centralizes color roles in `palette.ts` and defines dark mode as overrides on top of the base theme in `theme.ts`. The shared style modules show how those values become real primitives and layout behaviors across the app.
- **Alternatives considered**:
  - Screen-by-screen visual inspection only: Rejected because it would miss the centralized token definitions and overemphasize local exceptions.
  - Component-directory-only audit: Rejected because the dominant visual rules are currently encoded in shared style modules, not solely in component files.

## Decision 3: Structure the document around token roles first, then primitives and layout rules

- **Decision**: The final `DESIGN.md` should use a Stitch-style, example-backed structure centered on color roles, typography rules, component primitives, spacing, border radius, depth/elevation, theme behavior, responsive rules, and explicit exceptions.
- **Rationale**: That structure matches the user’s requested source-of-truth direction, lines up with the accessible `getdesign.md` examples, and directly covers the acceptance criteria in issue #123.
- **Alternatives considered**:
  - Freeform narrative design notes: Rejected because contributors would have to scan prose to find specific rules.
  - Pure token dump with no primitives: Rejected because migration work also needs intent, states, and usage guidance for recurring components.

## Decision 4: Model light theme as the baseline and dark theme as documented overrides

- **Decision**: Document the light theme as the baseline system and describe dark theme behavior as explicit overrides where values or contrast handling differ.
- **Rationale**: The current implementation derives `darkColors` from the base palette and overrides only the roles that require contrast or surface changes. The documentation should preserve that mental model instead of implying two unrelated theme systems.
- **Alternatives considered**:
  - Two fully separate theme catalogs: Rejected because the codebase does not implement themes that way.
  - Light-theme-only documentation: Rejected because issue #123 explicitly requires theme rules for both light and dark presentation.

## Decision 5: Derive responsive guidance from observed width constraints instead of inventing breakpoints

- **Decision**: Responsive guidance should document current behaviors based on `Dimensions`, `minWidth`, `maxWidth`, percentage widths, and `flexWrap` patterns already present in the style modules.
- **Rationale**: The codebase has wider-layout behaviors and density controls, but no centralized breakpoint token system. The documentation must describe what exists today rather than introducing a new breakpoint architecture during a documentation-first task.
- **Alternatives considered**:
  - Introduce a new breakpoint system in the document: Rejected because that would be a redesign decision, not documentation of the current product.
  - Omit responsive guidance: Rejected because the issue and specification explicitly require web-layout guidance.

## Decision 6: Catalog recurring primitives at the abstraction level needed for migration

- **Decision**: The primitive catalog should focus on repeated building blocks: buttons, cards, modals, badges, inputs, tabs/navigation, row/list containers, counters, and status treatments.
- **Rationale**: These patterns recur across `indexStyles.ts`, `setupGameStyles.ts`, `gameProgressStyles.ts`, `historyStyles.ts`, and `userPreferencesStyles.ts`. Documenting them as primitives gives future Tamagui migration work a reusable mapping surface instead of a file-by-file style inventory.
- **Alternatives considered**:
  - Document every component individually: Rejected because it would create an overly verbose artifact and obscure the reusable system.
  - Delay primitive definition until Tamagui implementation: Rejected because the issue exists specifically to create the visual contract before migration.

## Decision 7: Use manual review instead of runtime tests for this feature

- **Decision**: Verification for this feature should be a documentation review against audited source files and representative screen patterns rather than new automated runtime tests.
- **Rationale**: The feature does not change code paths, runtime UI, auth, persistence, or shared state. The correct proof is coverage and accuracy of the documentation relative to the existing implementation.
- **Alternatives considered**:
  - Add automated UI tests: Rejected because there is no runtime behavior change to validate.
  - Skip verification entirely: Rejected because the document still needs a structured audit and review pass before it can serve as a reliable contract.