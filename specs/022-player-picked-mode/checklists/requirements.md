# Specification Quality Checklist: Player-Picked Assignment Mode

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- This spec is a scoped extract of the already-clarified
  `specs/020-canonical-assignment-generation/spec.md` (User Story 6,
  FR-038–042), plus three slice-specific refinements this issue's own tracking
  (GitHub issue #185) adds on top: FR-038a names the authorisation shape for
  a non-host participant writing their own row (the security-sensitive part
  the issue calls out first), FR-040a makes the Common Match's no-op status
  explicit for picks (mirroring #184's equivalent host-allocation case), and
  FR-041a states the leave-before-start cascade the issue's subtasks call for.
- References to specific files (`026_guest_room_join.sql`,
  `032_room_membership_rpcs.sql`, `hooks/useRoomLobby`, etc.) appear only in
  the Dependencies, Assumptions, and Migration Impact sections as seams for
  `/speckit-plan`'s research phase to build on — the same pattern
  `specs/021-host-assigned-mode`'s checklist accepted — not inside the user
  scenarios or functional requirements themselves, which stay behavioural.
- No [NEEDS CLARIFICATION] markers were needed: `specs/020`'s clarification
  session already resolved the mode's core ambiguities (pool confinement,
  shortfall handling, overlap non-enforcement), and this issue's own GitHub
  tracking already resolved the three slice-specific questions folded into
  the Clarifications section above.
