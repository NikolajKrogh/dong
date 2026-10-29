# Naming migration follow-ups: implementation plan

Status: implementation complete; final integration and delivery checks in progress.
Date: 2026-10-29.

## Objective and delivery

Resolve every outstanding item from docs/naming-layout-migration.md: lifecycle
contracts, nullable scores, score corrections and drink balances, accessibility,
three failing browser journeys, biased assignments, normalization duplication,
large modules, history helper ownership, team-directory naming, and the
concurrency-script diagnostic.

- Parent branch: refactor/file-naming-and-layout (PR #207, targeting multiplayer).
- Follow-up branch: fix/naming-migration-followups, created from parent commit 6348cf5.
- Create one follow-up PR targeting refactor/file-naming-and-layout.
- Make focused commits per milestone; include the module refactors as separately
  reviewable commits. Keep this plan updated with checks and evidence.
- After the follow-up checks and CI pass, merge it into the naming migration.
  The user has authorized that merge. Do not merge PR #207 into multiplayer as
  part of this authorization.
- Preserve unrelated package/skill edits and older untracked audit reports.
- No Android/device acceptance is required. No hosted deployment, Cron activation,
  destructive data reset, or new infrastructure is part of this plan.

## Agreed behavior

1. Java and TypeScript preserve the same nine lifecycle values: scheduled, live,
   delayed, suspended, postponed, finished, canceled, abandoned, unknown.
   Use finished consistently, including the Java HTTP projection.
2. Canceled/abandoned status alone does not void previously accepted goals or
   drink requirements. Show a persistent status label on both the active match
   card and its saved history entry.
3. Missing score sides remain null/unknown and display as an em dash independently.
   Missing data is not a score of zero and does not erase the last accepted score
   or alter an existing drink requirement.
4. Delayed/suspended/postponed matches continue within existing tracking lifetimes,
   demand budgets and request limits. Resumed matches update normally. Expired
   tracking requires an explicit restart; never silently renew it indefinitely.
5. A newly accepted score correction changes the active match score both upward
   and downward and recomputes affected players' required drinks.
6. Required drinks and user-entered consumption are separate. Provider updates,
   corrections, lifecycle changes and retries must never write drinksTaken or
   current_drink_total. Only an explicit authorized consumption action changes it.
7. Keep current weights: common-match goal = 1 drink; other assigned-match goal =
   0.5 drinks. Count the common match once even if also listed in assignments.
8. Display remaining = max(required - consumed, 0). If consumed exceeds required,
   display the exact surplus as "X ahead". Preserve consumed and required totals;
   future goals naturally consume that surplus within the current game.
9. Freeze ended-game history at completion. Later observations must not modify its
   scores, lifecycle labels, required drinks or user-entered consumption. Preserve
   existing immutable early-leaver results as well.
10. Replace random-comparator sorting with Fisher–Yates. Keep the common match,
    exact configured match counts and exactly one additional shared match per
    player pair. Do not introduce team-strength/expected-goal weighting.
11. Keep Home → Settings → Friends for signed-in users. Update the test journey,
    retaining genuine keyboard and browser-Back coverage.
12. Accessibility fixes may adjust failing color pairs, accessible names, labels,
    roles and keyboard behavior. Preserve the existing visual identity, cards and
    layout; no unrelated redesign.

## Architecture and scope constraints

- Supabase remains authoritative for multiplayer scores, replay safety, ordering
  and events. Solo state remains in the existing persisted Zustand store.
- Keep provider acquisition in the existing Edge/catalog path; Java remains its
  existing projection and action interface. Do not add a second polling owner.
- Reject stale/duplicate observations using existing versions and sequences;
  accepting downward score corrections must not allow an old response to win.
- Any multiplayer correction remains auditable through immutable events or
  existing equivalent records. Derive obligations from authoritative match facts;
  do not compensate by changing the user's consumption counter.
- Inspect the latest definitions of database functions before editing. Add new
  migrations if necessary; preserve historical migrations, grants and RLS. Add
  pgTAP and update generated contracts/schema expectations for any schema change.
- Retain existing persistence keys and user data. Add optional snapshot fields
  with explicit legacy fallbacks when needed; do not fabricate past facts.
- No compatibility wrappers are needed for pre-production internal/API renames.
  Update every maintained caller, mock, fixture and current document together.
- Refactor by cohesive responsibility and simpler interfaces, not line quotas.
  Preserve behavior outside the explicit decisions above.

## Milestones and dependency order

### M0 — Establish reproducible browser and automated baselines

Use the seeded mock-auth browser environment. Reproduce the three failing BDD
journeys and the axe findings before fixing their causes. Update discovery mocks
to intercept maintained Edge discovery and start-game fixtures to use game-api
actions with the payload envelope; do not assume Java discovery is used by the app.
Investigate guest-lobby state and transitions before changing text assertions.
Replace the obsolete direct Friends-link journey with the agreed Settings path.

Done: all three journeys have meaningful passing assertions, including host start,
guest roster/history and keyboard/Back navigation; no journey is skipped, weakened
or replaced with an unrelated smoke test. Record source of each original failure.

### M1 — Unify lifecycle, nullable-score and history contracts

Work through types/footballMatch.ts, features/football-matches/matchDiscoveryAdapter.ts,
footballMatchSchemas.ts, useLiveScores.ts, types/matchScores.ts, game-api footballmatch
DTOs/projection, store snapshots and history mapping. Keep raw provider labels
separate from the canonical lifecycle used for decisions. Use an explicit shared
test matrix across Java and TypeScript rather than parallel undocumented mappings.

Implement the active/history labels, partial-score display and bounded interrupted
tracking behavior. Review store/gameStore.ts captureSavedMatches: it currently
visits saved history as well as active matches. Stop later observations from
rewriting ended snapshots. Check cloud history for equivalent live-catalog joins.

Done: every state round-trips; partial scores display independently; status-only
changes preserve accepted scores; expired tracking has an explicit restart path;
ended and early-leaver histories stay frozen after subsequent observations.

### M2 — Correct active score reconciliation and owed/consumed separation

Remove increase-only application in useLiveScores and trace corrections through
goalScoring.ts, useGameProgressController, room synchronization, room snapshots
and the server catalog-to-room application path. Inspect current SQL before deciding
whether a new migration is necessary; do not replace existing correct server logic.

Centralize the pure calculation of required, remaining and ahead amounts. Preserve
1/0.5 weights and separate consumption mutations from score reconciliation. Render
"X ahead" on player cards with a clear accessible name. A score correction must
not produce a new-goal notification or replay the original goal effects.

Done: upward/downward, duplicate, stale and partially unknown observations behave
correctly in solo and multiplayer; host/guest clients converge; consumption changes
only through explicit user actions; completion fences late responses. This can be
verified with automated clients/local fixtures, without physical devices.

### M3 — Assignment fairness, filtering ownership and small correctness fixes

- Replace shuffle in features/game-setup/createRandomAssignments.ts with
  Fisher–Yates and an injectable random source. Test permutation invariants and
  controlled draws; avoid flaky statistical thresholds or claiming the entire
  constrained assignment algorithm samples all valid solutions uniformly.
- Characterize current allocation rules, input immutability, missing common match,
  insufficient matches, impossible counts and repeat attempts. Fix any violation
  of the agreed constraints revealed by these tests without changing the rules.
- Consolidate team-name matching/display cleanup and date/time filtering behind
  clear pure modules in football-matches. Keep display names separate from lookup
  keys and preserve provider/league identity; do not add fuzzy entity merging.
  Retain characterized behavior for accents, punctuation, affixes and date boundaries.
- Rename useTeamData to useTeamDirectory and update callers/tests; keep its existing
  OpenFootball directory behavior distinct from match discovery.
- Add a clear assertion/guard before dereferencing the participant find() result
  in scripts/test-match-catalog-concurrency.mjs. Preserve the script's scenario.

Done: constraints hold under deterministic random inputs; duplicate helpers are
removed; no matching/timezone regression is introduced; a missing fixture participant
fails with an explanatory error; the React Doctor warning is resolved without a suppression.

### M4 — Accessibility repair

Fix the recorded findings on Home, Preferences, Appearance, History, Setup and Auth:
contrast, visible-label/accessibility-name mismatches, the unlabeled Appearance
input and History tab/tablist relationships. Prefer shared-control fixes where the
same cause recurs. Cover status labels and the new ahead display as well.

Done: relevant routes pass automated WCAG A/AA axe checks on phone and desktop
browser viewports in both supported themes; keyboard focus, tab interaction and
accessible names are verified. Preserve before/after screenshots to review small
contrast changes against the existing design. Do not suppress valid findings.

### M5 — Refactor the identified large modules, one commit at a time

Stabilize the behavior checks above first. The following names are proposed internal
owners; use existing modules where they already serve the same responsibility.

| Existing owner | Cohesive extraction | Required protection |
| --- | --- | --- |
| store/gameStore.ts | Pure snapshot capture, persisted-state normalization, preferences and game/history action builders | One persistence owner; hydration and frozen history remain correct. |
| features/rooms/roomRpcClient.ts | Lifecycle operations, gameplay operations and RPC error/result parsing behind the existing client interface | Auth, guest access, payload validation, idempotency and bounded pending retries. |
| features/rooms/useActiveGameRoomSync.ts | Identity/lifecycle fencing, snapshot application and optimistic mutation/retry coordination | Delayed responses cannot cross identities/rooms; corrections never mutate consumption. |
| features/rooms/RoomLobbyScreen.tsx | useLobbyAssignmentController, useLobbyGameplayHydration, RoomLobbyWizard and dialog views | Host/member eligibility, wizard navigation, overrides and exits stay unchanged. |
| features/history/HistoryScreen.tsx | Route/selection state, filtering/sorting and existing view modules | Browser Back, account-scoped data and frozen/early-leaver history. |
| features/account/AuthForm.tsx | Form interaction state, confirmation-code handling and existing form views | Sign-in/sign-up, confirmation, returnTo and account-change fencing. |
| features/history/historyUtils.ts | historyStatistics, historyPlayerIdentity and historyFormatting function modules | Registered identity remains account-based; guest/local identity stays session-scoped. |

Done per row: responsibilities actually move behind a smaller coherent interface;
original callers continue to work; characterization tests exercise the same behavior;
no broad eager-loading barrels, redundant state stores, speculative abstractions or
forwarding-only compatibility files are introduced. Every row must be addressed;
record the resulting owners and any evidence-based decision to retain a cohesive part.

### M6 — Integration, review and delivery

Run the complete client suite, typecheck, lint, Knip, Java clean verify/coverage,
Edge typechecks and React Doctor. Run pgTAP and contract/schema checks for any DB
change, then the full maintained browser suite and axe matrix. Re-run final
behavior journeys after refactoring. Classify failures rather than weakening gates.

Update the follow-up PR description around the final implementation, including
breaking contracts and real test limits. Merge into the naming branch only when
required checks pass; verify the resulting naming branch and update PR #207.
No Android run is required, and browser success is not represented as native acceptance.

## Acceptance scenarios that must be executable

- Given an active assigned match at 2–1, when a newer accepted observation changes
  it to 1–1, then its score and weighted requirement decrease, consumption stays
  identical, and replaying that observation changes nothing further.
- Given a required total of 3 and user-entered consumption of 4, then the card shows
  1 ahead; after required rises to 5 it shows 1 remaining. Consumption remains 4.
- Given one unknown score side, then that side displays an em dash while the known
  side displays its number; unknown data does not undo prior accepted requirements.
- Given a canceled or abandoned match with accepted goals, then its goals and
  requirements remain and the status label appears on the active card and history.
- Given an ended game, when the catalog later changes score, status or details,
  then the stored history snapshot and totals remain unchanged.
- Given a delayed/suspended/postponed match, then bounded tracking continues and
  play may resume; once tracking expires, no automatic renewal occurs.
- Given valid assignment inputs, then everyone gets the common match, each pair
  shares exactly one other match and configured counts hold with no input mutation.
- Given a signed-in user, when navigating Home → Settings → Friends by keyboard,
  then the screen loads and browser Back returns through the expected route state.

## Completion evidence

- M0: reproduced all three failures. Discovery mocked the obsolete Java path;
  direct-lobby fixtures omitted get_my_active_room membership; navigation expected
  an obsolete Home Friends link. Once fixture setup was corrected, the roster
  assertion exposed a real bug: useRoomLobby used historical participants instead
  of activeRoster. Fixed the hook while preserving the snapshot's game projection.
  The original three phone-browser journeys now pass (3/3); assertions still verify
  host start, two live roster removals, preserved game history, keyboard navigation
  and Back through Settings. Added a focused active-roster regression test.

Keep a milestone checklist and actual test results here during implementation.
All behavior and maintenance rows above must be closed with tests/evidence. If
investigation exposes a new product decision, ask one focused question before
implementing that dependent behavior; continue independent tasks in the meantime.

### M1-M2: lifecycle, reconciliation, balances and frozen history

- Java and TypeScript use the shared nine-value fixture. Java emits finished;
  independent unknown score sides survive ingestion, projections and rendering.
- Newer corrections apply in either direction. Unknown sides preserve accepted
  gameplay goals; provider processing never changes user consumption. Requirements,
  remaining and ahead amounts use one pure weighted calculation.
- Local history is cloned at completion and is no longer refreshed from the catalog.
  Room matches capture public catalog snapshots in a new additive migration. Completed
  and early-departure projections use captured facts rather than live catalog joins.
- Expired solo tracking remains stopped until the user chooses Restart tracking.
  Existing finite grants, interruption lifetimes and request budgets remain authoritative.
- Local pgTAP verifies partial downward correction, replay/stale ordering, unchanged
  consumption, cancellation labels, frozen completed history and write privileges.
  Full CLI pgTAP run: 71 files, 1,170 assertions passed. Generated contracts match.
  Only the existing disposable local feature database was migrated; no reset was used.

### M3: assignments and helper ownership

- Fisher-Yates uses an injectable random source. Deterministic draws and allocation
  invariants cover common-match counting, exact additional counts, one extra shared
  match per pair, input immutability and invalid inputs.
- teamNames.ts owns lookup and display policies. The legacy logo-affix policy stays
  distinct from option display and lookup keys. Characterization covers punctuation,
  accents, affixes and whitespace. Provider/league identity is retained.
- useTeamDirectory replaces useTeamData. Existing pure matchFilters date/time rules
  and platform date-input normalization keep their separate responsibilities.
- The concurrency fixture checks its participant before dereferencing it.

### M4: accessible browser behavior

- Shared palette and text tokens now meet the tested contrast requirements in both
  themes. Settings names include their visible values, the theme switch has a label,
  History tabs have a tablist, and match logos expose their team names.
- Match cards derive their web names from visible content and informative logos.
  Consumption controls have explicit action names. Ahead/status/history checks cover
  partial scores and abandoned matches alongside the six-route accessibility matrix.
- Home choices finish dismissing before navigation on web, releasing the modal focus
  trap. Native choices run after visibility commits. Failed hosting reopens the choices.
- Browser fixtures use current manual-entry disclosures, account bootstrap, visible
  route controls and the Settings-to-Friends path. Assertions retain actual keyboard,
  Back, two-client propagation, read-only membership and safe error-message coverage.
- All 28 accessibility cases passed across phone/desktop and light/dark themes.
  Before/after screenshots were retained locally and checked for layout preservation.

### M5: completed responsibility splits

| Owner | Result |
| --- | --- |
| gameStore | syncedPreferences and matchSnapshots own pure normalization/capture. Game/history actions remain next to the single persist owner; splitting these remaining short actions would add indirection. |
| roomRpcClient | guestRoomRpcClient, hostRoomRpcClient, roomGameplayOperations and roomRpcErrors own transport roles and parsing. The existing client interface remains the entry point. |
| useActiveGameRoomSync | activeGameIdentity, activeGameLifecycle, activeGameSnapshot, gameplayMutationQueue, roomRealtimeSubscription and activeGameTypes separate fences, reconciliation, retries and subscriptions. |
| RoomLobbyScreen | useLobbyAssignmentController, useLobbyGameplayHydration, RoomLobbyWizard and RoomLobbyDialogs own their respective responsibilities. |
| HistoryScreen | HistoryContentView and historySorting separate presentation and calculations from route/selection state. |
| AuthForm | AuthFormViews owns fields, credentials and verification presentation; confirmation/account/returnTo state stays in AuthForm. |
| historyUtils | historyCalculations, historyPlayerIdentity and historyFormatting replace the generic utility owner. The calculation name avoids a Windows collision with HistoryStatistics.tsx. |

Existing characterization tests exercise these owners through the same public flows.
The RPC, synchronization, lobby, authentication, store and history changes are separate
reviewable commits. No new persistence owner or forwarding-only compatibility module
was introduced.

### M6: integration evidence

- Client: 165 suites / 1,073 tests passed.
- Java: 93 tests passed; clean verify and coverage gates passed.
- Database: 71 files / 1,170 assertions passed; generated contract drift check passed.
- Edge entry-point typechecks, client typecheck, lint and Knip passed.
- React Doctor: 100/100, no findings.
- Browser: all 142 maintained cases passed in one complete run.
- Accessibility: all 28 cases passed. Remote CI must pass before merging the follow-up
  into the naming branch.
- Physical Android/device acceptance is excluded by agreement. Hosted deployment and
  acquisition/Cron activation remain outside this task.
