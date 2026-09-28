# Leave Contract Requirements Checklist

**Purpose**: Check the precision of the leave and history requirements, not code behavior.
**Feature**: [spec.md](../spec.md)

## Departure and retry

- [x] Are in-progress and joinable departures distinguished? (FR-001, FR-007)
- [x] Is the preserved state named, including drink totals and assignments? (FR-001)
- [x] Is retry identity and event uniqueness explicit? (FR-002, Edge Cases)
- [x] Is a failed or uncertain departure distinguished from a confirmed one? (US3, Edge Cases)

## Identity and history

- [x] Are registered cloud and guest device-local results distinguished? (FR-004)
- [x] Is the frozen departure result distinct from the later completed result? (US2, FR-005)
- [x] Are leaver read/write boundaries and active-player continuity stated? (FR-003)
- [x] Does the spec cover host handover and the no-successor close case? (Edge Cases)

## Platform and verification

- [x] Are web and native action/confirmation expectations stated? (FR-006, SC-004)
- [x] Are deployment and E2E testing boundaries explicit? (FR-008, Assumptions)

The constitution's E2E requirement remains intentionally unmet under the user's explicit constraint.
