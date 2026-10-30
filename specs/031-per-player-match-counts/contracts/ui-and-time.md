# Contract: Player Controls and Match-Time Displays

## Per-player controls

Reuse `AssignmentCounter` and existing player `MatchSelectionCard` rows in local setup, `AssignmentSettingsPanel`, `RoomAssignmentPlayers`, lobby and running editor. Group label: "Default matches per player", with "Plus the common match". Individual controls identify the player, show their resolved count, and offer "Use default" when overridden. Zero shows "Common match only".

Do not add a separate configuration screen, readiness protocol, account preference, drink multiplier or new navigation flow. Host/organizer can edit counts; members/guests see counts/progress and keep only their existing own-pick actions. Busy state prevents duplicate submissions; stale/conflicting draft changes remain available for review.

All decrement/increment/reset controls have player-specific accessible labels, touch targets, keyboard focus and disabled state. Default changes visibly preserve overrides. Server-rejected reductions identify the players whose picks/allocations need releasing.

Preview shows each player's exact target and actual assigned total, sharing preference, actual overlap summary and whether it is optimal or best effort. Expand a player to inspect who shares with them rather than adding a large mandatory pair table to mobile. A stale preview disables commit until refreshed and reviewed. Proposed assignments remain drafts until canonical acceptance.

The lobby/editor use the [RoomAssignments interface](assignment-module.md) for preview and commit; they do not coordinate request generations, protocol tokens, expiry or replay keys. A relaxed preview states its actual departure from strict sharing and requires explicit acceptance for that preview. Consent does not carry to a replacement preview. Busy/pending requests preserve the newest draft; old responses never replace it. If aggregate sharing assessment is incomplete, label it as not fully assessed and show actual overlap for a selected pair on demand. Do not display a missing metric as zero deviation.

For all-zero v2 targets, show "Common match only" for the group and every player, regardless of stored sharing preference. No sharing-minimum error or relaxation dialog applies. Returning to positive equal targets restores strict rules; existing legacy-policy games are unchanged.

Counts shown in progress and history are individual/actual counts. The Common Match is labeled separately; an average history rollup is never displayed as everyone's count.

## Match-time output

Every displayed kickoff clock is exactly `HH:mm` using hours 00..23 and minutes 00..59. No AM/PM, seconds, unpadded hour, or `24:00`. Keep existing timezone selection and displayed date/instant. Unknown or absent kickoff remains unknown/absent; never invent midnight.

- Recognized bare `9:05`, `09:05`, or `09:05:30` becomes `09:05` after validating the clock range. Bare clocks already describe local display time and must not be timezone-converted a second time.
- ISO instants and the existing recognized ESPN fallback convert using the viewer's existing timezone and use explicit h23 output with Latin digits and a colon. Remove the current forced hour12 flag; do not combine conflicting hour12/hourCycle options.
- Invalid clock-shaped strings should use the current unknown-time presentation rather than fabricate a valid time; preserve genuinely descriptive unknown labels such as "kick-off TBC". Preserve safe failure handling, without returning a raw known AM/PM clock as a successful normalized kickoff.
- A recognizable legacy AM/PM clock must normalize (for example `8:30 PM` to `20:30`, `12:00 AM` to `00:00`); unrecognized text remains an unknown label rather than undergoing a speculative date parse. Keep this narrow to known clock formats.

## Source inventory and reach

| Surface/path | Current state | Planned action |
| --- | --- | --- |
| `features/football-matches/matchTime.ts` | Explicit `hour12: true`; raw clock pass-through | Single central kickoff fix, bounds and legacy clock normalization |
| `features/game-setup/SelectableMatchList.tsx:99` | Sole production formatter caller | Retain shared rendering, test noncompact rows |
| `LeagueMatchSections.tsx` / `MatchList.tsx` | Discovery/setup/lobby/editor pool lists use shared rows | Verify 24-hour output |
| `AssignmentSection.tsx` | Local assignment list uses shared rows | Verify list; compact grid currently has no kickoff |
| `RoomLobbyWizard.tsx` / `RoomAssignmentPlayers.tsx` | Member pool and host allocation rows | Verify timestamps and per-player counters |
| `PlayerPickPanel.tsx` / `GuestJoinLobby.tsx` | Registered/guest picks | Verify same formatting and individual caps |
| `EditGameScreen.tsx` | Shared pool/allocation rows | Verify timestamp consistency |
| `useMatchData.ts:54` | Discovery already creates local HH:mm | Preserve semantics; do not change to UTC accidentally |
| `platform/date-input/PlatformTimePicker.tsx:46` | Already sets use24HourClock | Retain; verify under 12-hour device preference |
| `CommonMatchSelector.tsx` | Currently no kickoff shown | No new display required |
| `MatchesGrid/LastUpdatedFooter.tsx:120` | Refresh timestamp is locale-dependent | Adjacent AM/PM inventory, not a kickoff; outside this requirement |
| `history/historyFormatting.ts:32` | Game completion timestamp is locale-dependent | Adjacent inventory, not a kickoff; unrelated timestamp changes excluded |

Apply the central rule to any additional kickoff renderer found during implementation; do not infer that every named screen currently displays a kickoff. Existing formatter tests explicitly expecting AM/PM must be changed.

## Acceptance checks

Use en-US plus a 24-hour locale and explicit UTC/viewer-zone cases: midnight `00:00`, morning `09:05`, noon `12:00`, evening `23:59`; time-zone date rollover; valid raw clocks with seconds; known AM/PM legacy clocks; absent/unknown/invalid input. The result must not depend on the browser/device clock preference. Verify actual shared-list output on Android and phone/desktop web after ARTEMIS exploration.
