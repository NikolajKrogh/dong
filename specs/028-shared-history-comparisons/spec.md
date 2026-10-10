# Feature Specification: Shared History and Player Comparisons

**Feature Branch**: `feat/shared-history-comparisons`

**Created**: 2026-10-09

**Status**: Draft

**Input**: Specify [issue #143](https://github.com/NikolajKrogh/dong/issues/143): allow registered users to view shared history and player comparisons using cloud-backed account identities, preserve guests as session snapshots, and enforce privacy permissions.

## Clarifications

### Session 2026-10-09

- Q: Should statistics cover all time or offer period selection? → A: All time, with no date filter in this version.
- Q: Should shared comparisons include games where either person left early? → A: Include them in shared totals, averages, higher-drink counts, ties, and timelines using preserved departure results; visibly label affected games “Left early”.
- Q: How should friend statistics behave when permissions cannot be checked offline? → A: Hide friend statistics until a successful permission check; show a connection message and Retry. Personal history retains its existing access rules.
- History → Stats is the main statistics destination. Personal totals stay at the top, current friends show aggregate summaries automatically, and selecting a friend expands an inline comparison. Players, game participant details and Friends provide shortcuts to that expanded row.
- Accepted friends can compare overall statistics, including results from games played separately. Individual separate-game records remain private.
- Count completed online multiplayer games only, including early leavers using drinks recorded at departure. Count each game once; exclude local and ongoing games. Local personal history remains supported independently.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View games shared with a friend (Priority: P1)

A signed-in registered user opens History → Stats, sees their completed online totals and friend summaries, and expands a friend to compare overall and shared totals in place. Stats contains no individual game records or timeline; Games retains recorded game details, and the existing direct shared-history route remains compatible.

**Why this priority**: Shared games give the comparison a clear, permission-bounded source of truth.

**Independent Test**: Create two friends with two shared completed games and separate private games; the shared view shows exactly the two shared games on web and native.

**Acceptance Scenarios**:

1. **Given** two accepted friends with completed games together and apart, **When** either opens their shared history from History, **Then** only games in which both accounts participated appear, newest completion first; separate games contribute to overall aggregates but their individual records are not disclosed.
2. **Given** a shared completed game containing guests and a participant who left early, **When** game details open, **Then** recorded participants and their preserved results remain visible, including guest snapshot names and departure status.
3. **Given** accepted friends with no completed games together, **When** shared history opens, **Then** an explicit empty state appears rather than invented results or an error.
4. **Given** a game is still in progress and a personal departure result exists, **When** shared history opens, **Then** that result is not counted as a completed shared game; after completion the game appears once.

### User Story 2 - Compare registered players reliably (Priority: P1)

A registered user compares their overall statistics with one accepted friend and separately compares results over their completed games together. Clearly labelled sections explain the different datasets.

**Why this priority**: Names change and can be reused; comparison must describe the actual accounts and persisted results.

**Independent Test**: Compare two accounts across known shared results, rename one, and repeat from another device with no local history; the contributing games and figures remain identical.

**Acceptance Scenarios**:

1. **Given** accepted friends with known persisted shared results, **When** comparison opens, **Then** it shows games played together, each person's total drinks and average drinks per shared game, counts of higher-drink results and ties, and a per-game timeline derived only from those completed games.
2. **Given** a registered participant changes username or another account later owns a recorded name, **When** comparison refreshes, **Then** results remain attached to the original account, current usernames label registered comparison subjects, and game details retain recorded names.
3. **Given** local games have matching player names, **When** a cloud comparison opens, **Then** those local records do not contribute to its figures.
4. **Given** a comparison includes a game with a guest named the same as a registered player or another guest, **When** results render, **Then** each guest remains a distinct participant of that game and never contributes to a registered account's cross-game totals.
5. **Given** no shared games, a zero-drink game, or tied results, **When** comparison renders, **Then** counts and totals are accurate, unavailable averages have an explicit empty presentation, and no invalid numeric values appear.

6. **Given** friends have completed games together and apart, **When** “Overall stats” opens, **Then** each account shows its games participated in, total drinks, and average drinks per completed online game without separate-game dates, participants, timelines, or links.
7. **Given** a player finished one game with 4 drinks, left another with 2 drinks before the host completed it, and has local and ongoing games, **When** overall statistics load, **Then** they show 2 games participated in, 6 drinks, and 3 drinks per game; each completed online game counts once and local/ongoing games contribute nothing.
8. **Given** accepted friends have no completed games together, **When** their destination opens, **Then** overall statistics remain available and shared games show an explicit empty state.
9. **Given** a friend is visible in History → Players, game participant details, or Friends, **When** the corresponding shared-history action is selected, **Then** the same destination opens and Back returns to the originating screen.
10. **Given** eligible completed online games span multiple years, **When** overall or shared statistics open, **Then** all eligible games contribute, the all-time scope is labelled, and no date filter is offered.
11. **Given** either comparison subject left a now-completed shared game early, **When** shared statistics and timeline details render, **Then** that game contributes once to totals, averages, higher-drink counts, ties, and the timeline using preserved departure drinks, and the affected participant is labelled “Left early”.

### User Story 3 - Keep shared views private as access changes (Priority: P1)

A user's social comparison access follows current authentication and friendship permissions while their own participation history remains available independently.

**Why this priority**: A comparison must not expose private games or retain another account's private data after an account switch.

**Independent Test**: Open a comparison, remove friendship or block either direction, refresh, and attempt the same read outside the interface; social access is rejected while each participant's personal history still works.

**Acceptance Scenarios**:

1. **Given** signed-out users, guests, pending requests, declined requests, or unrelated accounts, **When** they request friend shared history or comparison, **Then** access is denied without revealing private results.
2. **Given** an accepted friendship is removed or either participant blocks the other, **When** a shared view is opened, refreshed, or resumed, **Then** permission is rechecked and the social view clears unavailable data; personal participation history remains accessible.
3. **Given** an old-account request is still pending, **When** the user signs out or switches accounts, **Then** previously displayed private shared data is cleared and delayed responses cannot populate the new account's view.
4. **Given** loading, connection failure, or expired authentication, **When** a shared read cannot finish, **Then** the user sees a distinct recoverable state without a false zero-result comparison or unauthorized fallback data.
5. **Given** cached friend statistics exist, **When** opening, refreshing, returning, or foregrounding the view triggers a permission check, **Then** friend data stays hidden while the check is pending; if connectivity prevents verification, it remains hidden with a connection message and Retry, while personal history retains its existing access rules.

### Edge Cases

- Duplicate names, reused usernames, deleted accounts, and missing historical account links never authorize or merge identities by name.
- Identical guest names across games remain separate session snapshots, including when a guest later registers.
- Duplicate records or repeated refreshes do not double-count a completed session; personal departure snapshots are not additional completed games.
- Deleted or unavailable friends produce an unavailable state without disclosing new private records or rewriting historical snapshots.
- Friendship loss during a read must not allow a later read to bypass authorization; already displayed data clears at the next permission check.
- Missing completion evidence or incomplete historical results are excluded or explicitly marked unavailable rather than inferred from local history.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: History MUST retain Games, Players, and Stats tabs, including when history is empty. Players MUST automatically show recorded co-players, initially ordered by most recent game together, with registered/friend/guest context; friendship alone MUST NOT insert people with no recorded games into Players. Stats MUST show the viewer's own completed-online totals and accepted-friend aggregate summaries without requiring selection, including an explicit zero-shared-games state. Selecting a friend MUST expand an overall/shared comparison inline without replacing the personal summary. Game participant details, Players and Friends MUST provide shortcuts to that Stats row. Existing participation-based personal views remain available for non-friends; eligible registered non-friends may use the existing Add friend flow with its pending state. Individual game records and timelines MUST NOT appear in the primary Stats dashboard.
- **FR-002**: Shared history and comparison MUST use authoritative persisted completed multiplayer results keyed by stable account identity. Names, locally stored history, and client-supplied relationship claims MUST NOT grant access or establish identity.
- **FR-003**: Shared game lists, details, timelines, and head-to-head figures MUST include only completed online games both accounts participated in. Accepted friends MAY read overall aggregates across each account's completed online games, including games played separately, but MUST NOT receive separate-game records, dates, identifiers, participants, links, or timelines, or third-party private history.
- **FR-004**: Shared history MUST show completion order, game details, recorded participant names, preserved results, and early-departure information consistent with personal completed history. It MUST count each completed game once.
- **FR-005**: “Your games together” MUST show shared-game count, each account's total and average drinks per shared game, higher-drink counts, ties, and a shared per-game timeline. Labels MUST describe consumption without declaring a winner and distinguish these shared figures from “Overall stats”. Empty averages MUST be unavailable, and zero-drink games MUST contribute zero.
- **FR-006**: Registered identities MUST remain stable through rename and username reuse. Current registered usernames label comparison subjects; historical participant names remain recorded snapshots. Missing account links MUST NOT be repaired by name matching.
- **FR-007**: Guests MUST appear only as session-scoped participant snapshots in permitted game details. Guests MUST NOT become selectable permanent social comparison subjects, merge across sessions, or acquire historical account ownership upon later registration.
- **FR-008**: Friend shared reads MUST require current accepted friendship with no block in either direction. Permission MUST be enforced outside the interface for every read, including direct or forged requests. Responses MUST expose only information needed for the permitted history and comparison, excluding email, settings, and unrelated profile data.
- **FR-009**: Blocking or removing friendship MUST revoke social shared-view access without deleting history or removing access independently granted by game participation. Unblocking alone MUST NOT restore social access without an accepted friendship.
- **FR-010**: Opening, manual refresh, returning to the view, and foreground return while it is active MUST recheck permissions and read current results. Authentication changes MUST immediately isolate private displayed and cached data and prevent delayed old-account responses from updating the new view. Continuous social subscriptions or polling are not required.
- **FR-011**: Shared views MUST distinguish loading, empty, unavailable permission, expired authentication, and retryable connection errors. Retrying MUST be safe and MUST NOT modify gameplay, friendships, or recorded results.
- **FR-012**: Existing personal cloud history, local-only history and comparisons, recorded guest details, and early-departure history MUST remain supported. Their source and scope MUST remain distinguishable from friend shared comparisons.
- **FR-013**: Web and native MUST provide equivalent selection, navigation back, refresh, and error recovery with accessible labels, keyboard/focus support on web, and usable touch targets on native.

- **FR-014**: “Overall stats” MUST show each account's games participated in, total drinks, and average drinks per completed game. Count only completed online multiplayer sessions in which that registered account participated, once per session. Early leavers contribute preserved drinks at departure once the host completes the game; a departure snapshot MUST NOT create an additional contribution. Ongoing and local games MUST contribute nothing. Zero-drink games count toward the denominator; no eligible games means zero count/total and an unavailable average.
- **FR-015**: Within the viewer-versus-friend destination, the viewer MUST receive their own overall aggregates and those of the current accepted friend only when neither has blocked the other. Standalone owner statistics outside this destination are not added by this feature; existing personal Stats behavior remains supported. Removing friendship or blocking MUST revoke friend aggregate access alongside social comparison access, while preserving participation-based personal history. Aggregate permission MUST NOT grant access to underlying separate-game records.
- **FR-016**: The destination MUST show names and relationship/shared-game context, clearly labelled side-by-side overall statistics, shared comparison, and shared games newest first. Detailed shared charts MAY appear under “More statistics”. Empty shared history MUST coexist with available overall statistics. No messaging, invitations, guest attribution, or local-player attribution flow is included.
- **FR-017**: Overall statistics and shared comparisons MUST cover all eligible completed online games across all time. This version MUST NOT offer date filters or period selection; section labels MUST make the all-time scope clear.
- **FR-018**: Completed games where either comparison subject left early MUST contribute once to all shared statistics, including totals, averages, higher-drink counts, ties, and timelines. Use each early leaver's preserved drinks at departure. Shared game rows and timeline details MUST identify the affected participant with a visible “Left early” label; higher-drink counts MUST NOT imply equal participation duration.
- **FR-019**: Friend statistics and social comparison data MUST remain hidden until the current view's opening, refresh, return, or foreground permission check succeeds. While that check is pending, cached friend data MUST NOT be displayed. If the check fails because of connectivity, the view MUST hide friend data and show a connection message with Retry; an older successful check MUST NOT authorize offline fallback. Personal participation history retains its existing access rules. No continuous permission polling is required while the view remains open.

### Key Entities *(include if feature involves data)*

- **Registered Account**: Stable authenticated identity and current username; the subject of a social comparison.
- **Friendship and Block**: Current consent and restrictions governing social reads independently of participation-based history access.
- **Completed Game**: Persisted final results, completion time, and recorded participants, counted once in a shared dataset.
- **Participant Snapshot**: Recorded name, result, membership kind, departure status, and account link where supported; a guest remains scoped to one game.
- **Shared Comparison**: Two registered subjects and consumption statistics over their permitted completed games together.
- **Overall Account Statistics**: One account's completed online participation count, total drinks, and average; permitted friends see aggregates without separate-game details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On web and native, a user with an accepted friend can open shared history and comparison from History in no more than three selections, without entering names manually.
- **SC-002**: Known-result acceptance fixtures produce exact overall and shared-game counts, totals, averages, higher-drink counts, ties, and shared timeline values on both platforms and a second device with no local history.
- **SC-003**: All tested unauthorized, blocked, stale-friendship, and forged reads reveal zero private comparison records; account-switch tests expose zero old-account data in the new account's view.
- **SC-004**: Rename, reused-name, duplicate-guest-name, and guest-registration scenarios produce zero identity merges and preserve all recorded participant results.
- **SC-005**: Under a healthy connection with up to 100 shared completed games, at least 95% of 20 measured opens per platform show the requested history or comparison within two seconds; failed reads remain explicitly recoverable.

- **SC-006**: Early-departure, duplicate-result, local-game, and ongoing-game fixtures produce exactly one contribution per eligible completed online session and zero contributions from excluded records. Friend aggregate responses expose zero separate-game records or drill-down information.

## Assumptions

- Live issue inspection on 2026-10-09 found #143 open and its dependencies [#126](https://github.com/NikolajKrogh/dong/issues/126), [#138](https://github.com/NikolajKrogh/dong/issues/138), and [#145](https://github.com/NikolajKrogh/dong/issues/145) closed as completed. Planning must verify the usable contracts rather than treating issue closure as runtime proof.
- Compare the viewer with one accepted friend. Overall completed online statistics are friend-visible; individual games played separately stay private. Arbitrary third-party comparisons, public profiles, leaderboards (#146), notifications, and social-history export are excluded.
- History → Players is the main entry point, with game participant and Friends shortcuts. No Home redesign or new navigation tab is required. Existing personal comparisons may cover participants through participation-based access and are not converted into friend-only access.
- Guest consumption may remain visible in game details already permitted by participation; it does not enter registered social totals. No retrospective guest-to-account claim or name-based backfill is authorized.

## Platform, State, and Migration Impact

- **Platforms and authentication**: Equivalent web/native behavior for registered social views. Guests and signed-out users retain existing local/session capabilities but gain no social history access.
- **Shared state**: Read-only feature. Existing completed results remain authoritative and auditable; this feature must not rewrite game events or relationship state.
- **Migration/backfill**: Planning must assess existing history and permission contracts and add reviewed migration changes only where required. Preserve existing results and participant snapshots; never invent missing identity links from names. Include upgrade, clean-install, and recovery coverage for any persistence change.
- **Repository context**: Current code already distinguishes account and session identities in history utilities and supports two-player comparison selection. Reuse compatible behavior; replacing name-based aggregation alone is not evidence that friend authorization or cloud shared reads are complete.

## Required Coverage

- Unit coverage for contextual entry points, back navigation, overall-versus-shared datasets, online-only inclusion, preserved departure totals, deduplication, result mapping, zero/tie cases, identity preservation, refresh/error states, and account-change or delayed-response isolation.
- Permission and persistence tests for accepted/pending/removed friendships, bilateral blocks, aggregate access without separate-game access, revoked aggregate access, direct-read bypass attempts, unrelated sessions, deleted identities, guests, completed versus departure results, and duplicate counting. Add migration/upgrade and contract checks where persistence changes.
- User-approved exception (2026-10-09): do not author or run any E2E tests for this feature on web, Android or iOS. Unit/component, hook/repository and pgTAP tests remain required. This explicitly departs from Constitution V; do not claim full E2E compliance. No mandatory manual journey or mobile harness replaces the removed E2E gate.
- Regressions for personal cloud history, local history/comparisons, preserved departures, and historical guest details. Report unit/mock, browser, hosted two-account, and physical-device evidence separately.
