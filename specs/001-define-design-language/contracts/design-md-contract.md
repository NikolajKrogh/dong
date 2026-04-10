# DESIGN.md Contract

## Purpose

Define the minimum required structure and content for the final `DESIGN.md` deliverable so contributors can use it as the authoritative visual contract for the DONG application.

## Deliverable Location

- Final artifact path: `DESIGN.md` at the repository root.
- Planning support artifacts remain under `specs/001-define-design-language/`.

## Consumers

- Human contributors documenting or extending the current UI.
- Coding agents generating or migrating screens.
- Future Tamagui migration work that needs token and primitive mappings without guessing visual intent.

## Required Top-Level Sections

| Section | Required content | Primary source inputs |
| --- | --- | --- |
| `Overview` | Brief statement that the document describes the current design language rather than a redesign. | `spec.md`, issue #123 |
| `Color Palette & Roles` | Semantic colors by role, including brand, text, surface, border, and feedback/status usage. | `app/style/palette.ts`, `app/style/theme.ts` |
| `Typography Rules` | Display, section title, body, label/caption, emphasis, casing, and letter-spacing conventions. | Shared style modules in `app/style/` |
| `Component Primitives` | Buttons, cards, modals, badges, inputs, tabs/navigation, list-row containers, counters, and status treatments, with variants and states. | Shared style modules and representative screen patterns |
| `Spacing System` | Recurring spacing scale and layout density guidance. | Shared style modules |
| `Border Radius` | Recurring radius scale and where each level is used. | Shared style modules |
| `Depth & Elevation` | Shadow/elevation levels and intended usage. | Shared style modules |
| `Theme Rules` | How light and dark presentations relate, including stable roles and theme-specific overrides. | `app/style/theme.ts`, `store/store.ts` |
| `Responsive Rules` | Mobile-first behavior plus wider-layout adaptations, wrapping rules, container constraints, and modal sizing guidance. | Shared style modules using `Dimensions`, `minWidth`, `maxWidth`, and `flexWrap` |
| `Exceptions & Legacy Notes` | Patterns that do not fit the dominant system and whether they are intentional or cleanup candidates. | Audit findings across style modules |

## Authoring Rules

- The document must describe the existing product language, not propose a new aesthetic direction.
- Each major section must use semantic naming and explain intended usage, not just raw values.
- When light and dark behavior differ, both must be documented explicitly.
- When a pattern is screen-specific or inconsistent with the broader system, it must be labeled as an exception.
- Responsive guidance must describe observed behavior in the current codebase rather than introducing a new breakpoint framework.
- The document must be optimized for quick lookup, using headings and short structured descriptions rather than dense narrative blocks.

## Minimum Primitive Coverage

- Button family
- Card/container family
- Modal/dialog family
- Badge/chip family
- Input/search field family
- Tabs/navigation family
- Row/list item family
- Counter/status treatment family

## Acceptance Contract

The final `DESIGN.md` is acceptable only if all of the following are true:

- A contributor can find color, typography, spacing, radius, elevation, primitive, theme, and responsive guidance without leaving the document.
- A contributor can tell which patterns are standard system rules versus documented exceptions.
- A contributor can use the document to map an existing screen to reusable tokens and primitives without inferring undocumented visual intent.
- Light and dark behavior are both covered wherever values or surface treatment differ.
- Wider-layout and web-relevant behavior are covered wherever the current app already adapts to available width.