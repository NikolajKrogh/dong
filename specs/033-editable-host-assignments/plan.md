# Implementation

Reuse AssignmentCounter, MatchSelectionCard, SelectableMatchList and existing footer actions. AssignmentPlayerCard shares local/room row composition and the page-level layout switch. Extend the existing assignment workflow with explicit draft selections; keep immutable proposals for generation and legacy callers.

The forward migration adds nullable assignment_overrides to start/save RPCs, validates explicit selections atomically and advertises editableAutomaticAssignments in room snapshots. No generator rewrite, dependency or table is required. Existing common-match insertion, configuration tokens, host authority, idempotency and history remain authoritative.

Deploy the migration before the client. Rollback the client first; optional RPC arguments preserve older callers. Do not enable the capability on servers without explicit-override support.

Verification uses Playwright and axe, including Chrome on the connected Android phone, as explicitly requested instead of ARTEMIS. Mocked browser journeys verify UI/transport behavior; isolated pgTAP tests verify actual database validation and persistence separately.
