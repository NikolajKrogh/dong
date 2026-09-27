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

At `completed`, stop mutations and clear pending overlays. The host and
registered participants clear active-room context and navigate directly to the
existing Home screen, whose content and behavior remain unchanged. A guest whose
grant was valid when the host completion committed receives only the
`room_ended` terminal outcome, never a completed-room snapshot or final history;
the grant cannot authorize any later read or mutation. The client clears the
guest credential and room context once, then one root navigation owner shows
the standalone Room Ended screen.

With screen-reader access disabled, Room Ended shows a five-second countdown
measured only while the app/browser is interactive; backgrounding or losing
visibility pauses the remaining time. With screen-reader access enabled, it
offers one accessible Home button and performs no timed redirect. Repeated
polling, Realtime, and foreground signals must not duplicate cleanup, restart
the timer, or navigate twice. The multiplayer branch never invokes local
history creation; guests gain no persistent account history. Current React
Native Web accessibility detection reports enabled for every browser session,
so web uses the conservative button-only path pending resolution.

## Platform parity

- Native refetches on `AppState` foreground and uses a Tamagui Sheet for host
  reassignment; verify on physical Android with ADB.
- Web refetches on visibility/focus and uses a responsive dialog/panel; verify
  two browser contexts.
- Both share controller, RPC client, reconciliation, errors, test IDs, and the
  five-second convergence budget.
