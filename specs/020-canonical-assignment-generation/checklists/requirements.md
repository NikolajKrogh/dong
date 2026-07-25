# Specification Quality Checklist: Canonical Player Assignments on Game Start

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

### Verified during this session

- **Scoring attribution does not depend on the assignment table.** Checked against
  `008_create_gameplay_events.sql`, `018_history_read_models_support.sql` and
  `019_history_read_models_history.sql`: drink totals accumulate on
  `participants.current_drink_total`, goals on `matches.home_score`/`away_score`,
  and each gameplay event carries `actor_participant_id` directly. No total is
  derived by joining `public.assignments`. FR-045 is therefore satisfiable without
  versioning assignment data — a real risk to US7 that turned out not to bite.
- **But completed-game history does read the assignment table** to report each
  participant's matches (`_history_completed_assignments` → `player_assignments`).
  That reports the end state, so a reassigned game would be described as though
  its final map applied throughout. **Resolved**: snapshot the map at completion
  and repoint history at the snapshot (FR-047a). Because a snapshot is still an
  end-state record, FR-047b requires history to convey that assignments changed
  and FR-047c requires snapshot + reassignment records to reconstruct the
  timeline — which is what keeps constitution §III satisfied. Scoped to #186.
- **Draft picks need storage distinct from settled assignments** — named in the
  spec's Migration Impact as a design obligation for the plan phase rather than
  left implicit.

### Resolved this session

- **Scope roughly tripled.** The original draft covered server-side generation
  only. Clarification added three assignment modes, a configurable overlap
  constraint, a host override for under-supplied pools, and host-only mid-game
  reassignment. Story count went from 4 to 8, functional requirements from 25 to
  54. **The split has since been made**: this spec remains the shared reference
  for four issues — #135 (automatic generation, shortfall override, retry safety),
  #184 (mode setting + host-assigned), #185 (player-picked), #186 (mid-game
  reassignment). See the spec's Delivery Slices table. Planning on this branch
  covers the #135 row only; the deferred user stories and FR groups are tagged
  inline with their issue numbers.
- **Constraint scoping bug caught and fixed.** The per-player minimum derived from
  the overlap rule was written without a mode qualifier, so it would have refused
  a host's chosen count in player-picked mode for a rule that mode does not
  enforce, and silently raised the count participants had already been shown.
  FR-009, FR-010, FR-031 and FR-032 are now explicitly automatic-mode-only, and
  FR-011 states that the host's count is honoured verbatim in the other two modes.
- **The quadratic pool requirement is now a host choice, not a fixed cost.** The
  shared-per-pair count is the dial: zero gives `1 + P×N` (linear), one reproduces
  today's `1 + P(P−1)/2`. Recorded in Assumptions with the general formula.
- **The earlier FR-003/FR-004/FR-021 contradiction is resolved** by FR-009/FR-010,
  which make the per-player minimum derive from the roster and overlap setting
  rather than being a fixed default.
- **Mid-game reassignment moved from Out of Scope into scope** (User Story 7) with
  explicit history-immutability rules, keeping constitution §III satisfied.
- **Guest write boundary is new.** Player-picked mode is the first time a
  session-scoped guest writes room state beyond their own presence. Called out
  under Auth impact so it gets enforced server-side rather than in the UI.

### Retained deliberately

- File paths appear in Assumptions (`utils/setupGameAssignments.ts`) and
  Dependencies (`specs/` cross-references). These identify *which existing
  behaviour* is being adopted or superseded, not how to build the feature.
- FR-019 supersedes a requirement from a shipped feature (`specs/018` FR-008).
  Flagged so it is treated as an intentional behaviour change, not a regression.
