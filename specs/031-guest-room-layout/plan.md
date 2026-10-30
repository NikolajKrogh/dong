# Implementation plan

## Architecture

1. Preserve the session controller's RPC, credential renewal and retry behavior. Mount it once in GuestRoomSessionProvider; expose the existing useGuestRoomSession interface through context.
2. A root GuestRoomLifecycle coordinates restored-room navigation, gameplay hydration and confirmed departure. Keep the existing termination-navigation owner.
3. Keep GuestJoinModal for the join form only. Home opens the dedicated guestRoom route for existing sessions.
4. GuestRoomScreen owns URL tab selection, shared chrome, recovery states and leave confirmation. GuestRoomContent presents the existing picking panel or read-only assignments plus common match and expanded roster. Keep the panel mounted across tab changes.
5. Add a header action slot to MatchSelectionCard and a text variant to ShellActionButton. Use them for the shared Clear picks action without changing match cards.

## Contracts

Existing guest hook return shape, RPCs, protected storage, snapshot types, pick mutation and termination contracts remain unchanged. Add /guestRoom?tab=matches|room; invalid or absent tabs resolve to Matches. Add optional readOnly to the shared match list and flat to the pick panel for page composition.

## Constitution check

- Cross-platform: one page for native and web; native hardware verification excluded by explicit user instruction.
- Server-authoritative state: existing validated guest commands and snapshots retained.
- History: existing confirmed departure history behavior retained.
- Backend: no backend or schema work.
- Coverage: lifecycle/component unit tests and primary-journey BDD required.
- Skills: ui-taste, web-design-guidelines, ponytail, project-planner, Tamagui, React Native testing, systematic debugging, simplify and React Doctor guidance consulted where relevant.

## Rollout

Client-only release after tests and visual checks. Roll back by reverting this client change; persisted grants and server data formats are unchanged. No production room writes are required for verification.
