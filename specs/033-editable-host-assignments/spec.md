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

The shared player-card shell, count badge and controls, randomization panel and list/grid action use Tamagui primitives, theme tokens and existing ShellCard/ShellActionButton components. Preserve their visual composition and interaction semantics on native and web. Keep the match renderer and wizard navigation outside this migration; retain the native Modal as the platform boundary for assignment help.

Players pick shows the host's own selections and editable target in one shared player card, excluding that player from the remaining roster. The default count uses the compact shared control. The footer provides Start Game directly using the latest persisted picks and configuration token. Players pick has no review step or assignment preview panel. Preserve uncertain-commit recovery. Initial under-selection uses neutral progress rather than duplicate red errors. Assignment modes expose their pressed state on web, and wizard navigation stays on one row.

Local play, host setup and running editing share one randomization control and player-header composition. Follow the original local-play panels: grey background, separate white player panels, pale inset headers, blue selected/target badges, circular blue counters and a prominent blue randomization action. Keep the reset action that names the inherited default. Remove the collapsed fixture summary and redundant instructional UI. Preserve the original match cards: gradient, side-by-side team crests and names, VS, numbered badge, kickoff footer, selection border and checkmark. Assignment screens use a compact density of that same renderer, reducing only padding, logo sizes and gaps. Default cards retain their original dimensions. List/grid remains available, with an unselected gradient in the assignment grid too. These presentation changes apply on native and web without changing assignment rules or guest caps. Shared wizard navigation retains accessible current-step state and the original blue step icons and filled Back button.
