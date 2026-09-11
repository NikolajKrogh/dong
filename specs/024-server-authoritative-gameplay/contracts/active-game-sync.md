# Contract: Active Game Synchronization

## Entry and recovery

Registered and guest lobby-to-game transitions set multiplayer room/participant
context before navigation; guest secrets remain in their existing grant. No room
context selects the unchanged solo path.

The authorized snapshot adds `ownerParticipantId` and `lastEventSequence`. The
client fetches before enabling mutations, polls every four seconds while active,
refetches on foreground/reconnect and successful commands, and rejects snapshots
older than its last applied sequence. Recovery failure shows ended/access-lost
state rather than stale local gameplay.

## Optimistic overlay

Each goal/drink tap creates a UUID and ephemeral delta over canonical state.
Distinct pending deltas compose. Success applies the RPC absolute result and
sequence before removing the delta; failure removes it and announces the mapped
reason. An uncertain response retains the UUID for explicit retry but is never
silently queued offline.

Reassignment and completion do not alter canonical state optimistically; their
controls show pending until response or a confirming newer snapshot. Host
visibility is recalculated from every snapshot.

## Completion

At `completed`, stop mutations, clear pending overlays, show one read-only final
snapshot, and offer navigation away. The multiplayer branch never invokes local
history creation. Guests may view the final result but gain no persistent
account history.

## Platform parity

- Native refetches on `AppState` foreground and uses a Tamagui Sheet for host
  reassignment; verify on physical Android with ADB.
- Web refetches on visibility/focus and uses a responsive dialog/panel; verify
  two browser contexts.
- Both share controller, RPC client, reconciliation, errors, test IDs, and the
  five-second convergence budget.
