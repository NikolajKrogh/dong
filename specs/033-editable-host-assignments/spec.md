# Editable host assignments

Host setup and running editing reuse local-play match cards, counters and list/grid presentation. Automatic generates an editable draft; it remains Automatic after manual changes. No assignment-step room, invite, common-match summary or instructional copy is added.

## Acceptance

```gherkin
Given Automatic assignment with a selected common match
When the host randomizes and expands two players
Then both show the complete non-common pool with assigned matches checked
When the host changes selections or a collapsed counter
Then expansion and other players' selections are preserved
And Start or Save is enabled only for exact per-player counts
When the host commits
Then the exact selections persist and the common match is inserted server-side
And the persisted assignment mode remains Automatic
```

Generation uses sharing one. Explicit host edits may change overlap. Count changes preserve picks. Removed players/matches are filtered; stale asynchronous generation cannot replace newer configuration. Failed requests retain edits and uncertain retries reuse their original idempotency key.

Guest picking remains unchanged. Existing themes, images, responsive breakpoints, confirmations and Use default controls remain in use. Older servers retain the existing proposal flow through snapshot capability negotiation.

## Shared presentation refinement

Local play, host setup and running editing share one randomization control and player-header composition. Use neutral counters, subordinate selection status, a collapsed selected-fixture summary and a reset action that names the inherited default. Remove redundant containers and instructional UI. The existing shared list renderer uses compact horizontal fixture rows with crests, full names, inline kickoff and checked state; the grid remains available. These presentation changes apply on native and web without changing assignment rules or guest caps. Shared wizard navigation highlights the current step and gives Back a quieter treatment.
