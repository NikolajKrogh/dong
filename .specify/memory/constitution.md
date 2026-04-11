<!--
Sync Impact Report
Version change: 1.0.0 -> 1.1.0
Modified principles:
- V. Story-First Delivery With Verifiable Gates -> V. Story-First Delivery With Required Coverage
Added sections:
- VI. Skill-First AI Execution
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ✅ README.md
- ✅ .github/copilot-instructions.md
- ✅ .github/agents/speckit.plan.agent.md
- ✅ .github/agents/speckit.implement.agent.md
- ✅ .specify/templates/commands/*.md (directory not present; no action required)
Follow-up TODOs:
- None
-->

# DONG Constitution

## Core Principles

### I. Cross-Platform First

Every user-facing feature MUST define expected behavior on both native and web
before implementation begins. Platform-specific APIs MUST be isolated behind
shared abstractions, and any temporary platform exclusion MUST be documented in
the specification, with an explicit reason and approval path. Rationale: DONG is
evolving into a cross-platform product, so parity cannot be treated as cleanup
work after mobile implementation.

### II. Server-Authoritative Shared State

Any multiplayer or otherwise shared game state MUST have one canonical source of
truth outside the client. Clients MAY use optimistic UI, but all shared-state
writes MUST go through validated commands or approved secure RPC paths, and each
mutation MUST define idempotency and conflict-handling behavior. Rationale:
multiplayer trust, replay safety, and cross-device consistency depend on
authoritative state transitions.

### III. Event-Backed Game History

Score changes, drink changes, session transitions, and other gameplay mutations
that affect history MUST be stored as immutable events or an equivalently
auditable record. Derived totals, leaderboards, and summaries MUST be
reconstructible from persisted records, and schema changes MUST include
migration, retention, and backfill considerations. Rationale: reliable history,
recovery, and analytics are impossible when only mutable snapshots are stored.

### IV. Supabase-First, Custom Backend by Exception

Supabase Auth, Postgres, Realtime, and generated REST/RPC capabilities MUST be
the default platform services for identity, persistence, and synchronization.
Custom Java endpoints MUST be introduced only when they add orchestration,
secrets handling, external integration, or cross-aggregate validation that the
client or direct Supabase access cannot safely provide. Duplicate CRUD layers
MUST be justified in the plan. Rationale: this keeps the system affordable,
operable, and simpler to evolve.

### V. Story-First Delivery With Required Coverage

Work MUST be sliced into independently deliverable user stories, and each story
MUST include Gherkin-style acceptance criteria and explicit edge-case coverage.
Every new feature MUST ship with unit tests that cover its new behavior before
merge. Any substantial UI change, including a new end-to-end flow, major
navigation change, or material interaction redesign, MUST add at least one
end-to-end test covering the primary user journey on the affected platform(s).
Changes that affect auth, multiplayer, persistence, or platform behavior MUST
still include the highest-leverage automated tests at the correct level.
Rationale: a large roadmap only remains manageable when each slice is
demonstrable, reviewable, and protected against regressions at both logic and
journey level.

### VI. Skill-First AI Execution

Any AI agent used for research, planning, implementation, or review MUST check
whether a repository, platform, or domain skill applies before proceeding. When
a relevant skill exists, the agent MUST load and follow that skill before
producing analysis, plans, code, or review feedback. If no suitable skill
exists, the agent MAY continue under the default workflow but MUST not imply
that a skill review occurred. Rationale: task-specific skills capture proven
workflows and constraints, reducing inconsistent or shallow AI output.

## Product & Architecture Constraints

- Client-facing application work MUST target Expo/React Native with TypeScript,
  and shared UI work MUST move toward a Tamagui-based design system.
- Web support is a release concern, not optional polish. New UI work MUST define
  both native and web behavior.
- Supabase free tier is the default hosted platform for auth, PostgreSQL,
  Realtime, and REST/RPC until measurable limits justify change.
- Multiplayer room creation MUST require an authenticated host. Guest players
  MAY join only from their own device using a room code and remain
  session-scoped identities in v1.
- Persistent schema changes MUST ship with migrations, indexes, and RLS updates.
- Additional infrastructure such as local MySQL, duplicate CRUD APIs, or
  self-hosted Supabase MUST not be introduced without written justification in
  the plan.

## Delivery Workflow & Review Process

- Every specification MUST describe platform impact, auth or guest impact,
  shared-state impact, migration or backfill impact, and test strategy whenever
  those concerns apply.
- Every specification MUST declare required automated coverage: unit tests for
  all new feature behavior, and end-to-end coverage whenever a change materially
  alters a primary UI journey, navigation pattern, or cross-screen interaction.
- Every implementation plan MUST pass Constitution Check before Phase 0 research
  closes and again after Phase 1 design is drafted.
- Tasks MUST be grouped by user story and include concrete file paths.
  Foundational tasks MAY exist only when they unblock all stories. Stories that
  add new feature behavior MUST include unit-test tasks, and stories with
  substantial UI changes MUST include end-to-end test tasks.
- AI-assisted research, planning, implementation, and review MUST identify
  applicable repository, platform, or domain skills before work begins. If no
  skill applies, that decision MUST be stated explicitly in the working notes,
  plan, or review context.
- Pull request review MUST verify acceptance criteria coverage, required unit
  tests for every new feature, end-to-end coverage for substantial UI changes,
  backend or RLS boundary changes, and runtime or developer documentation
  updates when behavior changes.
- Releases that modify persisted data or multiplayer flows MUST include rollback
  or recovery notes.

## Governance

- This constitution supersedes ad hoc workflow preferences for planning,
  implementation, and review.
- Amendments MUST update this document, include a Sync Impact Report, and review
  dependent templates and runtime guidance in the same change.
- Versioning policy for this constitution is semantic: MAJOR for removing or
  redefining principles or governance, MINOR for adding principles or materially
  expanding guidance, and PATCH for clarifications that do not change meaning.
- Compliance review is mandatory at specification, planning, task-generation,
  and pull-request time. Any unresolved violation MUST be recorded explicitly in
  Complexity Tracking or blocked until resolved.

**Version**: 1.1.0 | **Ratified**: 2026-04-10 | **Last Amended**: 2026-04-11
