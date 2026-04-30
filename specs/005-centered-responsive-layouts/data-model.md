# Layout Model: Restore Centered Responsive Layouts

This feature does not change any persisted domain data. The relevant model is the
responsive layout contract that the screens and shared primitives follow.

## Layout Abstractions

### ResponsiveShell

| Field             | Meaning                                                        |
| ----------------- | -------------------------------------------------------------- |
| `padded`          | Whether the shell adds outer padding around the content column |
| `centerContent`   | Whether wide layouts should be centered                        |
| `contentMaxWidth` | Maximum width of the inner content column                      |
| `contentProps`    | Additional props passed to the inner content stack             |

**Relationships**: Used by Home, Setup, Game Progress, History, and Settings.

**Rules**:

- Phone layouts remain full-width and readable.
- Wide layouts center the inner content without conflicting width rules.
- Max width should cap the content column rather than stretching it edge-to-edge.

### ScreenContentColumn

| Field       | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| `width`     | Desired width behavior inside the shell              |
| `alignSelf` | Whether the content column centers within the parent |
| `maxWidth`  | The allowed width cap for readable content           |

**Relationships**: Wraps cards, lists, buttons, and empty states inside the main routes.

**Rules**:

- Do not combine width and centering values in a way that prevents the parent from centering the column.
- On wide screens, the content column should preserve a readable line length.

### SetupWizardFrame

| Field              | Meaning                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `stepIndicator`    | The stepper/sidebar or horizontal indicator depending on viewport |
| `wizardMainPanel`  | The scrollable step content region                                |
| `wizardNavigation` | The back/next/start button row                                    |
| `wideLayout`       | Boolean flag that selects the two-pane wide arrangement           |

**Relationships**: Owned by the setup route and fed by player/match/assignment step content.

**Rules**:

- The wide frame must stay inside one centered container.
- The main panel must not expand indefinitely when the viewport gets wider.
- Navigation should remain aligned with the wizard frame instead of drifting to the edges.

### SharedBreakpoint

| Field           | Meaning                                                    |
| --------------- | ---------------------------------------------------------- |
| `wideThreshold` | The viewport width at which centered wide layout activates |

**Relationships**: Used by route shells and setup components that switch between phone and wide arrangements.

**Rules**:

- One threshold should drive the current feature's wide/phone split.
- Screens should use the same threshold consistently so the layout does not change at different widths within the same flow.

## Layout State Transitions

| From                 | To                   | Trigger                                    |
| -------------------- | -------------------- | ------------------------------------------ |
| phone layout         | wide centered layout | viewport becomes wide enough               |
| wide centered layout | phone layout         | viewport shrinks below the breakpoint      |
| step 1               | later setup steps    | the user advances through the setup wizard |

## Validation Rules

- Centered wide layouts must keep the main content visually balanced.
- Empty states, long labels, and cards with active game data must stay inside the same content column.
- Route changes and viewport changes must not require manual reloads to preserve alignment.
