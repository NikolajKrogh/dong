# Issue Sync: #186 and #190

**Reviewed**: 2026-08-16

This artifact records the GitHub changes required to keep issue tracking aligned
with the server-only delivery decision. It does not itself change GitHub.

## Issue #186

Keep the full product acceptance criteria open, but split its checklist into:

### Server slice delivered by `specs/023`

- Host-only `in_progress` reassignment RPC
- Stable guards, malformed-input handling, and settled-cardinality preservation
- Exact-request idempotency replay and conflicting-key rejection
- Actor-attributed immutable reassignment events
- Scoring immutability on reassignment
- Atomic, complete, immutable completion snapshots
- History flag, legacy fallback, retention, and reconstruction invariant
- pgTAP and RPC-wrapper unit coverage

### Product completion delegated to #190

- FR-043a: host-only control on the active game screen
- FR-046: end-to-end proof that later scoring follows the new owner and earlier
  scoring remains with the owner at that time
- FR-047b: visible history indication that assignments changed during play
- FR-048a: human-readable presentation of every reassignment refusal
- FR-049: every active-game client converges within the normal refresh interval
- Playwright BDD journey that records scoring, reassigns, observes another
  device, completes the game, and verifies history

Do not close #186 as product-complete until both sections are complete. A server
PR may close only a linked server implementation subtask or milestone.

## Issue #190

Add these explicit checklist items:

- [ ] Consume `public.reassign_participant_matches` from a host-only active-game control
- [ ] Present every documented reassignment error without exposing Postgres details
- [ ] Apply reassigned ownership on all devices within the normal snapshot interval
- [ ] Prove post-change scoring uses new ownership and pre-change scoring does not
- [ ] Render `assignments_changed_during_play` in completed-game history
- [ ] Add a reassignment-specific two-device Playwright BDD journey

Add an acceptance scenario:

```gherkin
Scenario: Mid-game reassignment is visible, prospective, and auditable
  Given an active multiplayer game on two devices
  And scoring has been recorded for a participant's assigned match
  When the host replaces that match from the active game screen
  Then both devices show the new assignment within one normal refresh interval
  And the earlier scoring is unchanged
  And later scoring follows the new assignment
  When the host completes the game
  Then history indicates that assignments changed during play
```

## Stale issue note

Issue #186 currently points at migration 010 for the event-type constraint. The
latest definition is migration 031; update the note so implementation copies the
current list before adding `assignment_reassigned`.
