# Completed multiplayer history (#138)

## Behavior

The host still returns Home after ending a game. Signed-in owners and registered
participants can read the canonical result in History, including participants who
left early. Guests retain the room-ended explanation and return Home without
receiving renewed room or history access. This is the user-approved narrowing of
#138's original connected-client results criterion.

History combines local games with completed sessions visible to the current
account. Successful import links identify duplicate local/cloud copies; the cloud
copy wins in the displayed dataset, while the local record remains stored. No
deduplication uses names, timestamps or scores. Games, details and statistics use
the same dataset. Cloud data stays in memory and is discarded on account changes.

Completion stores a server timestamp in the same transaction as its event,
assignment snapshots and terminal state. Existing missing dates are backfilled
only from completion events. Records without evidence show “Completion date
unknown”. No completed data is fabricated or deleted.

## Migration and recovery

Apply the `canonical_completed_history` forward migration before using the new
client. It preserves the previous guest revocation behavior and secures nested
history views, including snapshot membership checks. Import metadata remains
private behind a caller-scoped read-only RPC.

If the client must be rolled back, retain the migration: old clients remain
compatible. Do not roll back the security changes, reopen completed rooms or erase
completion timestamps. Correct backend defects with another forward migration.

Deployed to the linked DONG Supabase project on 2026-09-27 as migration
`20260927152611_canonical_completed_history.sql`. Hosted verification found no
remaining completed session with a missing timestamp and an available completion
event. All seven private history support views now use invoker security.

## Validation

Automated coverage includes canonical history, authorization, terminal write
rejection, import deduplication, complete pagination, failure recovery and account
switching. Database fixtures run inside rollback-only transactions.

The user explicitly waived Spec Kit and E2E tests for this change. No E2E tests
are added or run. Manual browser and Android testing belongs to the user; the
previous room-ended screen acceptance does not verify this new history feature.

Database validation: 140 assertions passed after deployment across suites 070,
080, 090, 100, 270, 304, 312 and 313. Before deployment, three additional checks
verified event-backed backfill, preservation of unknown dates, and preservation of
existing dates. Test 090 now expects zero statistics for an unrelated private
room; shared-room participant names remain available.

Client validation: 102 tests passed in 17 focused Jest suites, including the
previous room-ended regression coverage. New tests cover pagination, canonical
mapping, import deduplication, account changes, stale refreshes, error recovery,
unknown dates, early leavers and the shared History dataset.

Independent subagent review found no blocking authorization, merge or completion
race issues. It reviewed the source; the test results above were executed
separately, and are not manual device/browser verification.

Static review: full-project TypeScript and React Doctor still report existing
repository issues; the changed implementation passed targeted type-diagnostic
inspection and ESLint. The Supabase security advisor still reports existing
[function/search-path notices](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable),
[public privileged-function notices](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
and Auth configuration notices. No broad permission or Auth changes were made as
part of this history feature.

## Manual acceptance checklist (browser and Android)

- End a running game with known scores and drinks. Confirm the host returns Home
  and History shows exactly one completed result with the correct date and totals.
- Open the same account on the other device. Confirm the cloud result matches,
  including final assignments and an early leaver's preserved totals/label.
- Confirm Games, Players, player details/comparisons and Stats agree.
- Refresh repeatedly and reopen History. Confirm the result is never duplicated.
- With previously imported local history, confirm each imported game appears once
  and unimported local games remain visible.
- Interrupt connectivity. Available history remains visible; retry recovers it.
- Switch accounts or sign out while a result is open or a refresh is pending.
  Confirm the old cloud results/dialogs disappear and late responses cannot return them.
- Confirm guest termination still shows the friendly explanation and reaches the
  existing Home screen without a retry-join dialog.

## Responsive History redesign

This UI update uses a standard implementation plan (no additional Spec Kit
workflow), existing dependencies and the existing history API. It adds no
migration. The user explicitly excludes E2E and agent-driven browser/Android
testing; the checks below belong to the user.

### Identity and labels

- Registered cloud participants group by account ID, including renamed
  appearances. The latest dated game supplies the displayed name; session ID
  supplies deterministic ordering when dates are unknown.
- Guests and device-local players remain separate per session and participant ID.
  Legacy entries without an ID use their stored position within the session.
  Matching names never establish identity or link local records to an account.
- Rankings, details, comparison, and highlights use the same identity key.
  Same-name entries carry date/context information. Local storage stays intact.
- **Player participations** counts every appearance: one person in three games
  contributes three. **Avg. drinks per participation** divides total drinks by
  that count, returning zero for no appearances. Game cards still say **Players**.
- Unknown completion dates remain explicit; no date is invented.

### Responsive behavior

History stays centered within the existing 1120px maximum. Games and Players use
two columns at 1024px of available content width and one below it. Larger text
can collapse the grid. Date sorting groups games by month with unknown dates
last; other sort modes remain ungrouped. Each tab has one vertical scrolling
surface. Automatic focus refresh and error-only retry remain available.

### Manual redesign checklist

- Visit Games, Players and Stats on web and Android; compare totals and labels.
- Resize across the wide breakpoint and try a narrow window, dark mode and larger
  system text. Check reading order, card widths, wrapping and scrolling.
- Open game details through the card, View details and more-matches action.
  Check final assignments, scores and Left early labels.
- Check a game with no matches, no common match, unavailable/broken logos, long
  team/player names and at least 12 participants. Names and scores stay readable.
- Search and clear Players; select comparison entries, search again, then compare
  and cancel. Selection stays intact while filtering; global ranks do not change.
- Check registered-player renames, separate same-name accounts and same-name
  guests/local entries. Details, comparisons and highlights select the right entry.
- Check both Stats highlights and ties, empty history and unknown completion dates.
- Switch accounts/sign out with a dialog open and a refresh pending. Prior cloud
  results and selected details disappear; local history remains usable.
- End another multiplayer game; confirm the existing host Home navigation and
  guest explanation → Home flow remain unchanged.

### Redesign validation results (2026-09-27)

- **105 tests passed in 19 focused Jest suites.** Coverage includes identity and
  renamed accounts, separate same-name participants, legacy IDs, comparisons,
  participation metrics, ties, month grouping, grid breakpoints, search/selection
  with 12 entries, logo failures, cloud/local deduplication, account cleanup, Home
  integration and existing guest-ending navigation.
- Scoped ESLint exited successfully: zero errors, 41 warnings (primarily Jest
  mock imports and the existing AppIcon import convention). `git diff --check`
  passed. No new dependencies or backend migrations were added.
- Full-project TypeScript remains failing outside the changed files, including
  existing gameplay/test fixtures, E2E type declarations and Supabase RPC typing.
  No diagnostics remain in the changed implementation or test files.
- React Doctor completed with score 37/100 across the branch diff: 48 errors and
  196 warnings. The errors are outside this redesign. History retains advisory
  warnings about component size/complexity, inline list rendering and native
  shadow styles. These are not a claim of runtime or visual verification.
- Independent source review checked identity propagation, responsive behavior,
  account cleanup, merging and ending-flow regressions. Review fixes include
  maximum drinks across all appearances, deterministic ties, dialog context and
  accessible close buttons, row spacing, and wrapping core totals at larger text.
  The reviewer rechecked the corrections and reported no remaining blockers.

Reproduce the focused run in PowerShell:

```powershell
$env:EXPO_PUBLIC_USE_RN_FETCH = '1'
npx jest --runInBand --watch=false __tests__/components/history __tests__/utils/historyUtils.test.ts __tests__/utils/historyRepository.test.ts __tests__/utils/historyLayout.test.ts __tests__/utils/homeStats.test.ts __tests__/hooks/useHistory.test.ts __tests__/hooks/useRoomEndedExit.test.ts __tests__/hooks/useGuestRoomEndedNavigation.test.ts __tests__/hooks/useGuestRoomSession.test.ts __tests__/app/history.platform.test.tsx __tests__/app/index.platform.test.tsx __tests__/components/gameProgress/GameActionsSheet.platform.test.tsx
```

The fetch switch is test-process-only: it avoids Expo's lazy native fetch logger
being loaded during Jest teardown. Application configuration was not changed.
Manual web/Android acceptance remains pending with the user. No E2E tests or
agent-driven manual browser/device checks were added or run.

## Responsive History modals (2026-09-27)

Game Details and Player Comparison now share a native Modal frame with a fixed
accessible header, safe-area margins, a 960px maximum panel width, and one content
scroll area. Layout uses measured content width: desktop starts at 760px with
font scale below 1.5. Enlarged text stacks sections and removes decorative bars.
Game totals use four/two/one columns; widths below 360px use one. Player Details
and the history loading, identity, calculation, and ending flows are unchanged.

Game Details preserves all participants, early-leaver labels and full assignment
names in separate wrapping chips. Common final scores have a pale-blue surface;
the existing logo resolver and equally sized initials fallback are reused.
Comparison presents both sides in aligned rows with pair-scaled bars. Shared games
show both higher-drink-total counts and ties. With/without averages include their
supporting game counts; missing subsets are distinct from an actual 0.0 average.
Tooltips explain all-match and participation denominators without changing them.

### Validation

- 120 tests passed in 20 focused suites (the command above also includes the new
  modal tests). Covers measured breakpoints, enlarged text, twelve participants,
  assignments, early leavers, unknown dates, empty sections, logo fallbacks,
  same-name identities, renamed accounts, both comparison sides, ties, zero and
  missing averages, tooltips, dismissal callbacks and existing History regressions.
- Installed React Native Web Modal primitives were unit-tested in jsdom for
  active-dialog-only Escape handling, listener cleanup and opener focus restoration.
  Android Back is covered through the native Modal onRequestClose callback.
  These checks are not manual browser/device or visual verification.
- Scoped ESLint: zero errors, 12 warnings for test require imports. Diff checks pass.
- Full-project TypeScript still reports unrelated existing errors in gameplay,
  test fixtures, E2E declarations and Supabase typing. No diagnostics in these
  changed modal implementation/test files.
- React Doctor: 38/100 across the branch diff, 48 errors and 195 warnings. Errors
  are outside this modal change; Game Details retains a component-complexity
  advisory. No dependencies, backend changes or migrations were introduced.
- Independent subagent review checked shared frame and Game Details responsiveness,
  accessibility and identity use. Its enlarged-text concern was fixed with flexible
  avatars and stacked player rows. Parent review checked comparison identity and
  calculation propagation, both-side counts and tooltip denominators.
- No E2E or agent-driven manual browser/Android testing was added or run.

### Manual acceptance checklist (user)

- Open Game Details and Player Comparison from existing History actions on web
  and Android. Confirm data and both player identities remain correct.
- Resize through 760px of content width and narrow phone widths. Confirm Game
  Details columns stack, totals adapt, comparison labels wrap and scores stay visible.
- Try dark mode and enlarged system text. Check full names, assignment chips,
  comparison values, tooltip text and close controls for clipping.
- Open a game with 12+ participants and multiple assignments. Scroll to the end;
  confirm the title/close remain available and every early leaver is present.
- Check absent/failed club logos, long team names, common matches, no assignments,
  no matches and unknown completion dates.
- Compare same-name entries and renamed accounts. Check ties, no shared games,
  no other games and real zero averages on both sides.
- Close with the button, Android Back and web Escape. On web, verify keyboard
  focus returns to the opening control. Open a tooltip and press Escape: only
  the tooltip should close, leaving the comparison available.
