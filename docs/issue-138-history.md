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
