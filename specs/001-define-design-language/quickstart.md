# Quickstart: Define the Design Language

## Goal

Author a repository-root `DESIGN.md` that documents the current DONG visual language accurately enough to guide future UI work and Tamagui migration.

## Inputs

- `specs/001-define-design-language/spec.md`
- `specs/001-define-design-language/research.md`
- `specs/001-define-design-language/data-model.md`
- `specs/001-define-design-language/contracts/design-md-contract.md`
- `app/style/palette.ts`
- `app/style/theme.ts`
- Shared style modules under `app/style/`

## Implementation Steps

1. Audit the centralized token sources in `app/style/palette.ts` and `app/style/theme.ts`.
2. Confirm recurring primitives, spacing, radius, elevation, and responsive patterns across `indexStyles.ts`, `setupGameStyles.ts`, `gameProgressStyles.ts`, `historyStyles.ts`, and `userPreferencesStyles.ts`.
3. Draft `DESIGN.md` at the repository root using the contract-defined section order.
4. Capture light-theme baseline behavior and dark-theme overrides explicitly.
5. Document responsive behavior based on observed width constraints, wrapping rules, and modal/container sizing patterns.
6. Mark one-off or inconsistent patterns as exceptions instead of treating them as reusable system rules.
7. Review the finished document against the acceptance contract and feature success criteria.

## Review Checklist

- Every required top-level section from the contract is present.
- Colors are grouped by role, not just listed as hex values.
- Typography includes hierarchy, weight, casing, and label conventions.
- Core primitives include purpose, variants, and states.
- Responsive rules describe both narrow/mobile and wider/web behavior.
- Exceptions are explicitly labeled.
- The document reads as a description of the current product, not a redesign proposal.

## Expected Output

- `DESIGN.md` created at the repository root.
- No runtime code changes required unless gaps in the current design-system sources must be clarified separately.