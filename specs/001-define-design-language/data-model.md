# Data Model: Define the Design Language

## Overview

This feature does not introduce runtime persistence. The data model below defines the conceptual entities that the final `DESIGN.md` must capture so the visual system can be documented consistently and reviewed systematically.

## Entity: DesignDocument

**Purpose**: The final authored artifact that assembles all visual-system guidance into a single contributor-facing contract.

| Field | Type | Description |
| --- | --- | --- |
| `path` | string | Final repository location of the document (`DESIGN.md`). |
| `title` | string | Human-readable document title for the current design language. |
| `scope` | string[] | Major coverage areas such as tokens, primitives, themes, responsive rules, and exceptions. |
| `sourceFiles` | string[] | Repository files audited to build the document. |
| `status` | enum | `draft`, `reviewed`, or `approved`. |

**Relationships**:
- Contains many `DesignToken` entries.
- Contains many `PrimitiveDefinition` entries.
- Contains many `ResponsiveRule` entries.
- Contains many `DocumentedException` entries.

**Validation rules**:
- Must include all categories required by the specification.
- Must reference audited source files for each major section.
- Must distinguish system rules from exceptions.

**State transitions**:
- `draft` -> `reviewed` -> `approved`

## Entity: DesignToken

**Purpose**: A reusable visual rule captured from the existing application.

| Field | Type | Description |
| --- | --- | --- |
| `category` | enum | `color`, `typography`, `spacing`, `radius`, or `elevation`. |
| `name` | string | Stable semantic token name or role label. |
| `lightValue` | string | Baseline value used in the light theme or default state. |
| `darkValue` | string/null | Dark-theme override when the value differs. |
| `usage` | string | Intended visual role or where the token appears. |
| `sourceFiles` | string[] | Files where the token or role is observed. |
| `classification` | enum | `core`, `semantic`, or `exception`. |

**Relationships**:
- Referenced by `PrimitiveDefinition`.
- May be further qualified by a `ResponsiveRule` or `DocumentedException`.

**Validation rules**:
- Token names must be unique within a category.
- `darkValue` is optional only when the token behaves identically across themes.
- Exception-classified tokens must cite a concrete source location.

## Entity: PrimitiveDefinition

**Purpose**: A recurring UI building block that contributors should reuse conceptually during migration work.

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Primitive name such as button, card, modal, badge, input, or tab. |
| `purpose` | string | What the primitive is used for in the product. |
| `variants` | string[] | Named visual variants currently present in the application. |
| `states` | string[] | Relevant states such as default, active, disabled, selected, or destructive. |
| `tokenRefs` | string[] | Tokens used by the primitive. |
| `sourcePatterns` | string[] | Representative files or screen families where the primitive appears. |
| `responsiveNotes` | string[] | Layout or sizing behaviors that change with available width. |

**Relationships**:
- References one or more `DesignToken` entries.
- Can be constrained by one or more `ResponsiveRule` entries.
- May cite `DocumentedException` when variants do not align to the dominant system.

**Validation rules**:
- Each primitive must define purpose, base behavior, and at least one representative source pattern.
- Each primitive must call out meaningful variants or explicitly state that no major variants exist.

## Entity: ResponsiveRule

**Purpose**: A documented adaptation pattern for narrow versus wider layouts.

| Field | Type | Description |
| --- | --- | --- |
| `pattern` | string | The layout or density scenario being described. |
| `defaultBehavior` | string | Expected mobile-first or narrow-layout behavior. |
| `wideBehavior` | string | Expected wider-layout or web behavior. |
| `constraints` | string[] | Width caps, minimum widths, wrapping rules, or modal/container constraints. |
| `affectedPrimitives` | string[] | Primitives influenced by this rule. |
| `sourceFiles` | string[] | Files where the pattern is observed. |

**Relationships**:
- Applies to one or more `PrimitiveDefinition` entries.

**Validation rules**:
- Must describe both narrow and wider-layout behavior.
- Must describe how overflow, wrapping, or density is controlled when relevant.

## Entity: DocumentedException

**Purpose**: A currently implemented pattern that does not fit the dominant token or primitive system and must be called out explicitly.

| Field | Type | Description |
| --- | --- | --- |
| `label` | string | Short identifier for the exception. |
| `scope` | string | Token, primitive, or screen family affected. |
| `location` | string | Source file or pattern location where it appears. |
| `reason` | string | Why it is considered an exception today. |
| `disposition` | enum | `preserve`, `review-later`, or `cleanup-candidate`. |

**Relationships**:
- Can attach to a `DesignToken`, `PrimitiveDefinition`, or `ResponsiveRule`.

**Validation rules**:
- Must identify the concrete source pattern.
- Must state whether the exception is intentional or a cleanup candidate.

## Relationship Summary

- `DesignDocument` is the container entity.
- `DesignToken` supplies reusable visual roles.
- `PrimitiveDefinition` groups tokens into contributor-facing UI building blocks.
- `ResponsiveRule` explains how primitives adapt across layout widths.
- `DocumentedException` prevents one-off patterns from being mistaken for system rules.