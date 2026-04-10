# DONG Design Language

## Overview

This document describes the current DONG visual language as it exists in the product today. It is a documentation artifact, not a redesign brief.

The app presents itself as a clean, game-day utility: bright action blue, white or near-black surfaces, strong semantic feedback, and card-based sections that keep live match data readable at a glance. The interface is mobile-first, but several screens already include wider-layout behavior such as wrapped badge rows, two-up cards, constrained dialogs, and full-width tab panes.

Primary audit sources:

- `app/style/palette.ts`
- `app/style/theme.ts`
- `app/style/indexStyles.ts`
- `app/style/setupGameStyles.ts`
- `app/style/gameProgressStyles.ts`
- `app/style/historyStyles.ts`
- `app/style/userPreferencesStyles.ts`

## Color Palette & Roles

### Brand and interaction colors

| Role | Light value | Dark value | Usage |
| --- | --- | --- | --- |
| Primary | `#0275d8` | `#0275d8` | Main call-to-action color, active UI accents, score emphasis, link-style interactions |
| Primary dark | `#0056b3` | `#58a6ff` | Hover/pressed emphasis and stronger contrast accent |
| Primary focus | `#1976d2` | `#1976d2` | Focused or active input state treatment |
| Primary light fill | `#e3f2fd` | `#0b2947` | Selected tabs, soft highlighted states |
| Primary lighter fill | `#f0f8ff` | `#0a223a` | Subtle icon backplates and supportive tinted surfaces |
| Primary transparent | `rgba(2, 117, 216, 0.08)` | `rgba(88, 166, 255, 0.12)` | Ghost buttons and lightweight status backgrounds |

### Surface and background stack

| Role | Light value | Dark value | Usage |
| --- | --- | --- | --- |
| App background | `#f5f5f5` | `#0e1116` | Base screen background |
| Background light | `#f8f9fa` | `#12161c` | Secondary page areas and light content zones |
| Background subtle | `#f0f0f0` | `#161b22` | Input fills, chip fills, subtle grouped regions |
| Surface | `#ffffff` | `#1b222c` | Cards, sheets, modals, headers, list items |
| Dark surface | `#333333` | `#0e1116` | Legacy dark panel role |
| Toast background | `#222222` | `#0d1117` | Toast and transient notification containers |
| Modal overlay | `rgba(0, 0, 0, 0.5)` | `rgba(0, 0, 0, 0.5)` | Global dim layer for dialogs and overlays |

### Text roles

| Role | Light value | Dark value | Usage |
| --- | --- | --- | --- |
| Text primary | `#212529` | `#e6edf3` | Main reading text and most high-contrast labels |
| Text secondary | `#333333` | `#c9d1d9` | Section titles, strong supporting text |
| Text muted | `#6c757d` | `#8b949e` | Helper copy, metadata, subtitles |
| Text disabled | `#adb5bd` | `#6e7681` | Disabled states and de-emphasized controls |
| Text light | `#ffffff` | `#ffffff` | Text on filled buttons and dark surfaces |
| Placeholder | `#999999` | `#999999` | Placeholder and low-priority hints |
| Link text | `#0275d8` | `#0275d8` | Link-like navigation and inline actions |

### Borders and dividers

| Role | Light value | Dark value | Usage |
| --- | --- | --- | --- |
| Border | `#dddddd` | `#2d333b` | Default 1px boundaries |
| Border light | `#e0e0e0` | `#30363d` | Inputs, list items, lightweight cards |
| Border lighter | `#eeeeee` | `#343a42` | In-card separators and soft rows |
| Border subtle | `#e9ecef` | `#2d333b` | Header rules, section dividers, low-contrast framing |

### Semantic feedback colors

| Role | Light/base value | Dark support value | Usage |
| --- | --- | --- | --- |
| Success | `#28a745` | `#12361c` support fill | Start and continue actions, positive confirmation, active game state |
| Danger | `#dc3545` | `#3b1519` support fill | Cancel, reset, destructive confirmation, alert contexts |
| Warning | `#ffc107` | `#3b2e0d` support fill | Warning emphasis and medal/highlight usage |
| Info | `#17a2b8` | `#11343a` support fill | Informational cues and subtle live context |

Semantic hue stays stable across themes. Dark mode changes the surrounding support surfaces rather than inventing new semantic colors.

### Contextual accents

| Role | Value | Usage |
| --- | --- | --- |
| Away team | `#fd7e14` | Alternate team accent when teams need differentiation |
| Live indicator | `#e74c3c` | Live badges, minute indicators, urgent in-game context |
| Count badge border | `#81d4fa` | Filter result count chips |
| Owed positive border | `#e57373` | Drink/owed status framing |
| Owed zero border | `#81c784` | Balanced or resolved owed state framing |
| Gold / Silver / Bronze | `#ffc107`, `#adb5bd`, `#cd7f32` | Ranking and medal treatment in history views |

## Typography Rules

The current system uses platform-default sans-serif typography. There is no custom font family token yet, so hierarchy is carried by size, weight, casing, spacing, and color.

| Token | Specs | Usage |
| --- | --- | --- |
| Display / Hero | `40px`, `bold` | Large home-screen titles and standout hero text |
| Screen title | `18-20px`, `600` to `bold` | Page headers, modal titles, key section headers |
| Section title | `16-20px`, `600` to `bold` | Card headers, filter headers, content section labels |
| Body / Row label | `15-16px`, `400` to `500` | Main content rows, inputs, supporting actions |
| Button label | `16-18px`, `600` to `bold` | Primary CTAs, start/continue actions, prominent buttons |
| Supporting text | `13-14px`, `400` to `500` | Subtitles, helper copy, filter details, empty-state support text |
| Caption / Micro | `11-12px`, `500` to `600` | Compact badges, category chips, score metadata |
| Eyebrow / Settings label | `14px`, `600`, uppercase, `letterSpacing: 0.5` | Settings section labels and compact organizational labels |

Typography behavior notes:

- Primary emphasis usually uses bold weight plus the primary blue rather than larger size alone.
- Supporting labels lean on muted color before reduced opacity.
- Button labels almost always pair icon + text, with a consistent `6-10px` visual gap.
- Compact chips and badges generally drop to `11-13px` to stay readable without dominating dense layouts.

## Component Primitives

### Button family

Base button characteristics:

- Default shape: `8px` radius
- Layout: horizontal row, centered content, icon + label composition
- Padding: `12-16px` vertical, `14-16px` horizontal depending on prominence
- Text: white, `16-18px`, `600` to `bold`

Primary variants:

- **Primary CTA**: filled blue button for setup, navigation, and key actions
- **Success CTA**: green-filled button for start/continue flows
- **Danger CTA**: red-filled button for cancel, reset, and destructive confirmation
- **Secondary CTA**: gray-filled or neutral action for modal cancellation
- **Surface CTA**: white or subtle-surface button with border for less dominant navigation
- **Compact action**: smaller padded button for filters and inline controls
- **Floating action**: circular blue action button used for persistent utility access

Common states:

- Default filled
- Active or hover emphasis through darker blue or stronger shadow
- Disabled using `textDisabled` plus reduced opacity
- Destructive confirmation using danger background with light text

### Card and container family

Base card characteristics:

- White or dark-surface background depending on theme
- Common radius: `8px` or `12px`
- Standard padding: `16-20px`
- Default elevation: `2`
- Shadow is shallow and vertical, used to separate cards from the page background rather than create dramatic depth

Common variants:

- **Standard card**: default content grouping for sessions, stats, and list items
- **Elevated card**: stronger shadow and/or thicker border for emphasis
- **Featured card**: primary-colored stat cards and highlighted surfaces
- **Compact card**: smaller padded utility cards, often in settings and history detail flows
- **Selection card**: border or glow treatment added for selected states

### Modal and dialog family

Base modal characteristics:

- Centered overlay over a `rgba(0, 0, 0, 0.5)` dim background
- Typical radius: `16px` or `20px`
- Padding: `20-35px`
- Elevated with `shadowOpacity` around `0.25` and `elevation` around `5-6`

Common variants:

- **Centered confirmation modal**: wide padding and simple action row
- **Sheet-like settings modal**: `16px` radius, more structured internal sections
- **Compact confirmation dialog**: constrained width with right-aligned actions

### Badge, chip, and status family

Common badge characteristics:

- Rounded pills, usually `10-16px` radius
- Compact horizontal padding (`6-12px`)
- Dense text sizes (`11-13px`)
- Often used in filter summaries, category chips, live status, and counts

Common variants:

- **Filter badge**: subtle background, thin border, wraps in rows, capped width
- **Count badge**: bordered badge with primary-colored count text
- **Category chip**: muted category pill for metadata
- **Live badge**: red-filled or red-text status element for active match context
- **Selected ribbon**: diagonal success ribbon used as a special-case flourish on selection cards

### Input and search field family

Common input characteristics:

- Background usually `backgroundSubtle` or `backgroundLight`
- Border: `1px` using `border` or `borderLight`
- Radius: `4px`, `8px`, or `10px` depending on compactness
- Text size: `15-16px`
- Focus or active state is usually signaled with stronger text and a primary-accent border treatment

Common variants:

- **Inline input**: compact text entry for team names and filters
- **Field wrapper input**: larger padded input shell with icon support
- **Active filter input**: uses a left primary-focus rail rather than a full border color swap
- **Search row**: horizontal icon + input arrangement on a subtle surface

### Tabs and navigation family

Common navigation characteristics:

- Rounded tabs with `8-20px` radius
- Neutral surface background for tab containers
- Active state uses either solid primary fill or `primaryLight` pill treatment
- Icon + text rows are common in higher-density tab bars

Common variants:

- **Setup and game tabs**: pill tabs with primary active fill and light text
- **History tabs**: segmented surface container with `primaryLight` active state and muted inactive text
- **Header navigation rows**: back button + title + utility action alignment

### Row and list-item family

Common row characteristics:

- Horizontal alignment with clear left label and right action or value
- Padding commonly `12-16px`
- Used in settings rows, stat rows, match rows, modal player rows, and history summaries
- Dividers are soft and low-contrast unless the row is a standalone card

### Counter and score treatment family

Common score and counter characteristics:

- Blue score values with bold weight
- Circular counter buttons around `36px` wide with `18px` radius
- Minimum widths used on score containers to prevent layout jumping
- Live minutes and status dots use compact, high-contrast semantic indicators

## Spacing System

The system behaves like an `8px` base grid with `4px` half-steps for dense controls.

| Value | Typical usage |
| --- | --- |
| `4px` | Micro spacing, icon nudges, fine separation |
| `6px` | Tight chip spacing, compact label rhythm |
| `8px` | Small control padding, icon gaps, compact card spacing |
| `10px` | Button icon offsets, chip offsets, dialog action spacing |
| `12px` | Row padding, compact cards, score and stat grouping |
| `14px` | Main button padding and medium-density action rows |
| `16px` | Default section padding, card padding, major internal spacing |
| `20px` | Modal bodies, larger containers, prominent sections |
| `24px` | Section separation and breathing room between major blocks |
| `30-35px` | Large centered modals and oversized hero spacing |

Practical rule: `16px` is the default content rhythm, while `8px` and `12px` are used to compress dense utility UI without making it feel cramped.

## Border Radius

| Value | Role |
| --- | --- |
| `4px` | Compact inputs, sharp utility menus, dense controls |
| `6px` | Small manage/action chips |
| `8px` | Default buttons, cards, inputs, list items |
| `10px` | Wrapped input shells, match list containers, secondary emphasis containers |
| `12px` | Stats cards, tab groups, subtle feature cards |
| `14px` | Contextual highlight cards; not a primary system step |
| `16px` | Modal content, chips, grouped utility surfaces |
| `18px` | Counter buttons and circular compact controls |
| `20px` | Dialog shells, rounded tab pills, larger visual groupings |
| `30px+` | Floating actions, circular shells, decorative or fully rounded treatments |

Default recommendation: treat `8px`, `12px`, `16px`, and `20px` as the main reusable steps. Smaller or larger values tend to be context-specific.

## Depth & Elevation

| Level | Typical values | Usage |
| --- | --- | --- |
| Level 0 | No shadow | Page background, flat sections, embedded content areas |
| Level 1 | `shadowOpacity: 0.08-0.1`, `elevation: 1-2` | Quiet cards, subtle list rows, low-priority floating elements |
| Level 2 | `shadowOpacity: 0.1-0.2`, `elevation: 2-3` | Standard cards, stats blocks, tab containers, list containers |
| Level 3 | `shadowOpacity: 0.15-0.2`, `elevation: 3-4` | Highlighted cards, selected surfaces, stronger action emphasis |
| Level 4 | `shadowOpacity: 0.25+`, `elevation: 5-6` | Modals, dialogs, dropdown-like overlays, selected match emphasis |

The depth model is practical rather than cinematic. The app relies on shallow, readable separation more than dramatic layered shadows.

## Theme Rules

Light mode is the baseline system. Dark mode is a controlled override layer that preserves the same information hierarchy and interaction structure.

Theme rules:

- **Brand blue remains the anchor**: the primary action color stays blue in both themes.
- **Surfaces invert, not the hierarchy**: white cards become dark slate surfaces, but cards remain visually elevated above the page background.
- **Text roles preserve rank**: primary text stays highest contrast, muted text remains supportive, disabled text remains visibly de-emphasized.
- **Support fills darken in place**: light supportive fills such as `primaryLight`, `successLight`, and `dangerLight` become deep tinted surfaces rather than disappearing.
- **Borders stay quiet**: dark theme uses low-contrast slate borders rather than bright outlines.
- **Toasts and overlays stay high contrast**: transient surfaces remain near-black for clarity.

Theme implementation guidance:

- Document the light value first when describing a token.
- Only add a dark override when the value materially changes.
- If a primitive keeps the same interaction meaning across themes, preserve the structure and only swap the supporting surface, text, and border values.

## Responsive Rules

The app is mobile-first. There is no centralized breakpoint token system yet, so responsive behavior is content-driven and implemented through width caps, `Dimensions`, minimum widths, and wrapping rules.

### Current responsive behavior

- **Single-column by default**: most screens stack content vertically with card padding and full-width CTAs.
- **Tabbed full-width panes**: history uses viewport-width tab content based on `Dimensions.get("window").width`, creating one full-screen panel per tab.
- **Two-up utility grids**: stat cards often use roughly `48%` width, and league grid items use `maxWidth: 46%` with `minWidth: 100` to create two columns when room allows.
- **Constrained dialogs**: settings confirmation dialogs cap at `maxWidth: 400`, preventing oversized modal bodies on wider screens.
- **Badge wrapping over scrolling first**: filter badges wrap when possible and are also constrained by `maxWidth: 110` and container caps such as `maxWidth: 85%`.
- **Minimum score widths**: score and player metric containers use minimum widths such as `50` or `70` to keep numbers aligned as content changes.

### Layout rules to preserve

- Prefer content-driven width caps over introducing artificial desktop-only spacing.
- Let dense chips, badges, and summary items wrap instead of shrinking text aggressively.
- Keep modal content readable by capping container width before increasing internal padding dramatically.
- Preserve minimum widths on scores, counters, and player metrics so live data does not jitter.
- Treat `flexWrap` as the main adaptation tool for dense secondary UI such as filter chips, stat rows, and league grids.

## Exceptions & Legacy Notes

- **No custom font family token exists yet**: the system currently depends on platform-default typography plus size and weight.
- **Some radii are local flourishes**: `14`, `18`, `30`, `40`, and `50` appear in special contexts such as counters, floating buttons, or oversized circular shells and should not be treated as the default radius scale.
- **The home screen uses oversized branded assets**: the logo and splash animation dimensions are branding-specific and not reusable layout tokens.
- **Some layout behavior is hard-coded to viewport width**: history tab panes and a few modal layouts use direct `Dimensions` values instead of reusable layout tokens.
- **Selected ribbons and glow states are decorative exceptions**: rotated ribbons and strong selected-card shadows are state-specific treatments rather than universal primitives.
- **A few component colors are local accents**: away-team orange, medal colors, and some owed-state borders are purposeful contextual accents, not primary brand colors.