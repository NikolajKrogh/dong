# Tamagui Configuration

This document provides an overview of the Tamagui configuration for this project.

## Configuration Settings

**IMPORTANT:** These settings affect how you write Tamagui code in this project.

### Web Container Type: `inline-size`

Enables web-specific container query optimizations.

## Shorthand Properties

These shorthand properties are available for styling:



## Themes

Themes are organized hierarchically and can be combined:

**Level 1 (Base):**

- dark
- light

### Theme Usage

Themes are combined hierarchically. For example, `light_blue_alt1_Button` combines:
- Base: `light`
- Color: `blue`
- Variant: `alt1`
- Component: `Button`

**Basic usage:**

```tsx
// Apply a theme to components
export default () => (
  <Theme name="dark">
    <Button>I'm a dark button</Button>
  </Theme>
)

// Themes nest and combine automatically
export default () => (
  <Theme name="dark">
    <Theme name="blue">
      <Button>Uses dark_blue theme</Button>
    </Theme>
  </Theme>
)
```

**Accessing theme values:**

Components can access theme values using `$` token syntax:

```tsx
<View backgroundColor="$background" color="$color" />
```

**Special props:**

- `inverse`: Automatically swaps light ↔ dark themes
- `reset`: Reverts to grandparent theme

## Tokens

Tokens are design system values that can be referenced using the `$` prefix.

### Space Tokens

- `0`: 0
- `0.5`: 2
- `1`: 4
- `1.5`: 6
- `2`: 8
- `2.5`: 10
- `3`: 12
- `3.5`: 14
- `4`: 16
- `5`: 20
- `6`: 24
- `7`: 28
- `8`: 32
- `true`: 16

### Size Tokens

- `0`: 0
- `1`: 4
- `2`: 8
- `3`: 12
- `4`: 16
- `5`: 20
- `6`: 24
- `7`: 28
- `8`: 32
- `9`: 36
- `10`: 40
- `11`: 44
- `12`: 48
- `true`: 16

### Radius Tokens

- `0`: 0
- `1`: 4
- `2`: 6
- `3`: 8
- `4`: 10
- `5`: 12
- `6`: 16
- `7`: 18
- `8`: 20
- `9`: 30
- `true`: 8

### Z-Index Tokens

- `0`: 0
- `1`: 100
- `2`: 200
- `3`: 300
- `4`: 400
- `5`: 500

### Color Tokens

- `awayTeam`: #fd7e14
- `background`: #f5f5f5
- `backgroundLight`: #f8f9fa
- `backgroundModalOverlay`: rgba(0, 0, 0, 0.5)
- `backgroundSubtle`: #f0f0f0
- `black`: #000
- `border`: #ddd
- `borderLight`: #e0e0e0
- `borderLighter`: #eee
- `borderSubtle`: #e9ecef
- `bronze`: #cd7f32
- `danger`: #dc3545
- `dangerLight`: #ffebee
- `darkGray`: #adb5bd
- `darkSurface`: #333
- `gold`: #ffc107
- `info`: #17a2b8
- `infoLight`: #e0f7fa
- `lightGray`: #f8f9fa
- `liveIndicator`: #e74c3c
- `mediumGray`: #e9ecef
- `neutralGray`: #ccc
- `primary`: #0275d8
- `primaryDark`: #0056b3
- `primaryFocus`: #1976d2
- `primaryLight`: #e3f2fd
- `primaryLighter`: #f0f8ff
- `primaryTransparentLight`: rgba(2, 117, 216, 0.08)
- `secondary`: #6c757d
- `silver`: #adb5bd
- `success`: #28a745
- `successLight`: #e8f5e9
- `surface`: #fff
- `textDisabled`: #adb5bd
- `textLight`: #fff
- `textLink`: #0275d8
- `textMuted`: #6c757d
- `textPlaceholder`: #999
- `textPrimary`: #212529
- `textSecondary`: #333
- `toastBackground`: #222222
- `warning`: #ffc107
- `warningLight`: #fff8e1
- `white`: #fff

### Token Usage

Tokens can be used in component props with the `$` prefix:

```tsx
// Space tokens - for margin, padding, gap
<View padding="$4" gap="$2" margin="$3" />

// Size tokens - for width, height, dimensions
<View width="$10" height="$6" />

// Color tokens - for colors and backgrounds
<View backgroundColor="$blue5" color="$gray12" />

// Radius tokens - for border-radius
<View borderRadius="$4" />
```

## Media Queries

Available responsive breakpoints:


### Media Query Usage

Media queries can be used as style props or with the `useMedia` hook:

```tsx
// As style props (prefix with $)
// Using the useMedia hook
const media = useMedia()
```

## Fonts

Available font families:



## Animations

Available animation presets:



## Components

The following components are available:

- AlertDialogAction
- AlertDialogCancel
- AlertDialogDescription
- AlertDialogOverlay
- AlertDialogTitle
- AlertDialogTrigger
- Anchor
- Article
- Aside
- AvatarFallback
  - AvatarFallback.Frame
- AvatarFrame
- Button
  - Button.Frame
  - Button.Text
- Card
  - Card.Background
  - Card.Footer
  - Card.Frame
  - Card.Header
- Checkbox
  - Checkbox.Frame
  - Checkbox.IndicatorFrame
- Circle
- DialogClose
- DialogContent
- DialogDescription
- DialogOverlay
  - DialogOverlay.Frame
- DialogPortalFrame
- DialogTitle
- DialogTrigger
- EnsureFlexed
- Fieldset
- Footer
- Form
  - Form.Frame
  - Form.Trigger
- Frame
- Group
  - Group.Frame
- H1
- H2
- H3
- H4
- H5
- H6
- Handle
- Header
- Heading
- Image
- Input
  - Input.Frame
- Label
  - Label.Frame
- ListItem
  - ListItem.Frame
  - ListItem.Subtitle
  - ListItem.Text
  - ListItem.Title
- Main
- Nav
- Overlay
- Paragraph
- PopoverArrow
- PopoverContent
- PopperAnchor
- PopperArrowFrame
- PopperContentFrame
- Progress
  - Progress.Frame
  - Progress.Indicator
  - Progress.IndicatorFrame
- RadioGroup
  - RadioGroup.Frame
  - RadioGroup.IndicatorFrame
  - RadioGroup.ItemFrame
- ScrollView
- Section
- SelectGroupFrame
- SelectIcon
- SelectSeparator
- Separator
- SheetHandleFrame
- SheetOverlayFrame
- SizableStack
- SizableText
- SliderFrame
- SliderThumb
  - SliderThumb.Frame
- SliderTrackActiveFrame
- SliderTrackFrame
- Spacer
- Spinner
- Square
- Stack
- Switch
  - Switch.Frame
  - Switch.Thumb
- Tabs
- Text
  - Text.Area
  - Text.AreaFrame
- ThemeableStack
- Thumb
- View
- View
- VisuallyHidden
- XGroup
- XStack
- YGroup
- YStack
- ZStack

