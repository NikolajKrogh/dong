# Specification Quality Checklist: Live Lobby Presence & Host Handover

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-06-21
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

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- Scope deliberately **never auto-transfers** the host role: a disconnected host keeps it and resumes on return (free, server-authoritative). Ownership changes only via explicit handover (US2).
- Roster/ownership are derived from durable state; **no online/away indicator** (FR-021) — polling-only.
- Abandoned **joinable** rooms are bounded by a 24-hour inactivity expiry (US4), not by presence timeouts; `in_progress` is out of scope for expiry.

### Resolved via design review/grilling (folded into spec/plan/research/data-model/contracts/quickstart)
- Live updates = shared **~4 s polling**, no presence dots (Q1/Q10).
- Expiry = event-based activity, **joinable-only** (Q2/Q3).
- **One active room** at a time, server-enforced on create + join, easy-exit reusing host/member leave (Q4/Q5/Q11); shared `find_active_room_for` also powers "Return to room" (Q12).
- Centralized **`useRoomExit` + `<SuccessorChooserModal>`**; decision logic stays in the RPC (Q6); chooser empties → server re-resolution + confirm-close (Q9).
- **Token-scoped guest leave** removes the row (Q7); all leave/handover **joinable-guarded**; in-game leave + history deferred to GitHub #165 (Q8).
- **Join code host-only** (Q15) — changes the existing guest lobby + its e2e.
- Handover mechanism de-risked from source (025 demotes-before-promotes).
