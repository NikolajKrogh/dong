# Verification Guide: In-Game Leave and Preserved History

## Prerequisites

- Use disposable room data for manual checks. The migration was applied to the linked hosted project after the user's explicit authorization; that project is the unreleased app's test environment.
- Use two registered accounts or one registered host and one guest on separate clients. Install the current client build on Android; use a local web build for web checks.
- Start a multiplayer game with an assigned match and a nonzero drink total for the person who will leave.

## Permitted automated checks

Run the focused pgTAP and Jest checks listed in `tasks.md`, TypeScript, and lint. Record each exact command and result in `verification.md`. Do not author or run E2E tests or suites.

## Manual web walkthrough

1. Start a room with a host and another participant; start play and give the participant a drink. Expect both players in the game.
2. On the participant's web client, open Game actions → Leave Game → Cancel. Expect play to remain available and no departure event.
3. Reopen and confirm Leave Game. Expect navigation home and a result in that participant's history showing the captured drink total.
4. Refresh that history before host completion. Expect one unchanged result. Attempt to rejoin or write with the departed identity; expect denial.
5. On the host client, continue play and end the game. Expect completed history to include the leaver once, with their departure time and frozen drink total. Expect the registered leaver's provisional result to be replaced by the completed result.
6. Repeat with a guest. Expect a device-local result after confirmed departure and no retained guest room access.

## Manual Android walkthrough (user-run; unverified by Codex until separately recorded)

1. On a connected Android device with the current build, join a local test room as a registered participant or guest and have the host start it. Expect the game screen.
2. Open Game actions. Expect Leave Game alongside Home, Setup, and End Game where applicable.
3. Cancel the confirmation. Expect to remain active. Reopen it and confirm. Expect a saved departure result, Home navigation, and no gameplay access.
4. Inspect History. Expect the captured drink total. Ask the host to continue and finish. Expect the final completed record to retain the early leaver once.

## Recovery

If a local migration or check fails, preserve the local database evidence and source. Correct forward through a new migration. Never delete a confirmed departure event or participant row to make a test pass.
