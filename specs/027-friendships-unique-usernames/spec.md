# Feature Specification: Friendships, Unique Usernames, and Maintainable Foundations

**Feature Branch**: `188-friendships-unique-usernames`

**Created**: 2026-09-30

**Status**: Draft

**Source**: [Issue #145](https://github.com/NikolajKrogh/dong/issues/145), within [epic #117](https://github.com/NikolajKrogh/dong/issues/117).

**Input**: Add registered-user friend search, requests, acceptance, decline, and blocking. Address identity/model problems from the beginning, with authoritative persistence enforcement rather than frontend-only validation. User decisions: rename the existing account display name to username and make it globally unique; retain a single account-name field. The app is not in production and existing database contents are test data, so production duplicate-name migration is unnecessary.

**Expanded scope (2026-09-30)**: Include architectural cleanup in this same change. Research reusable patterns and evaluate frameworks against actual maintenance problems. Major refactors are permitted when they remove duplication or establish enforceable boundaries. The current deliverable is the expanded specification and implementation plan, not runtime changes or database resets.

## Clarifications

### Session 2026-09-30

- Q: What format should usernames allow? → A: 3–30 Unicode letters, numbers, or underscores, for example `søren_7`; no internal spaces or other punctuation.

- Q: How should friend search match usernames? → A: Starts with the entered text; minimum 3 characters and maximum 20 results.
- Q: After someone declines a friend request, can the sender try again? → A: The sender can send a fresh request immediately; the recipient can block them to prevent further requests.
- Q: Should this change also include cancel-request and unfriend controls? → A: Include both canceling outgoing requests and removing accepted friends.

- Q: How should Friends update when another user takes an action? → A: Refresh on opening, returning to Friends, or manual refresh; automatic live updates and indicators elsewhere are excluded.

## User Scenarios & Testing *(mandatory)*

### Visual workflow decisions

The latest reviewed design direction is [Profile → Friends, v4](mockups/05-profile-friends-workflow-v4.png), with [interaction notes](mockups/README.md). Preserve the existing Home screen and its navigation. Enter through Settings → Profile & username → Friends; place the Friends row below username editing and above account actions. Friends has only Friends and Requests tabs, with prominent username search above them. Blocked accounts is a secondary destination in the Friends header overflow menu, not a tab. Individual Block actions remain in person-row menus.

Follow the existing DONG design language: pale backgrounds, rounded white cards, blue primary controls and icons, initial avatars, and red destructive actions. Reuse existing components and theme tokens. Earlier mockup versions are historical and do not authorize Home changes, additional social features, or alternative navigation. Images guide layout; written requirements govern behavior.

**Visual acceptance**: On web and native, the existing Home layout and controls remain unchanged; users reach Friends through Profile, search and switch between Friends/Requests, and open Blocked accounts from the header menu. Keyboard/focus behavior and touch targets remain accessible.

### User Story 1 - Choose a unique username (Priority: P1)

A registered user chooses or edits one globally unique username, used for friend search and shown as their current account name. Their account and history remain attached to the same identity when the username changes.

**Why this priority**: Friend discovery requires an unambiguous name, and competing clients must not claim the same name.

**Independent Test**: Two accounts attempt equivalent names through onboarding, profile editing, and writes that bypass the interface; exactly one owns the name.

**Acceptance Scenarios**:

1. **Given** an available valid username, **When** a registered user saves it during onboarding or profile editing, **Then** it becomes their current username on subsequent reads from either platform, and account-name fields and messages consistently call it “Username”.
2. **Given** an account named `Nikolaj`, **When** another account submits ` nikolaj ` or a case variant, **Then** the save is rejected with a name-unavailable message and the previously saved profile remains unchanged.
3. **Given** two simultaneous claims for an available name, **When** both reach authoritative persistence, **Then** exactly one succeeds, including when interface checks are bypassed.
4. **Given** a user with friends and game history, **When** they rename themselves, **Then** relationships and history ownership remain unchanged, friend lists show the current name after refresh, and recorded game-name snapshots remain intact.
5. **Given** a user saves their own name again or changes only capitalization, **When** the save completes, **Then** their own name is not reported as taken.

### User Story 2 - Find someone and request friendship (Priority: P1)

A registered user opens Settings → Profile & username → Friends, searches a username prefix, selects the intended account, and sends a request. They can see incoming requests, outgoing requests, and accepted friends.

**Why this priority**: This is the entry point to issue #145 and must work without exposing private account records.

**Independent Test**: With two registered accounts that are not friends, find the second by name and send one request visible to both parties in their respective lists.

**Acceptance Scenarios**:

1. **Given** an eligible account named `Nikolaj`, **When** another eligible user searches ` nikolaj `, **Then** that account is included among at most 20 eligible prefix matches with its current name and relationship state, without email, settings, or unrelated profile details.
2. **Given** a matching account and no relationship or block, **When** the user sends a request, **Then** the sender sees outgoing pending and the recipient sees incoming pending after refresh.
3. **Given** an outgoing pending request, **When** the sender repeats or retries after an uncertain network result, **Then** no duplicate request is created.
4. **Given** opposite-direction requests occur concurrently, **When** processed, **Then** one pending request remains and the other user is offered Accept or Decline; crossed sends never automatically create an accepted friendship.
5. **Given** a guest, signed-out user, or account without a valid unique name, **When** they attempt search or a friend action, **Then** access is denied until registration, authentication, and name setup are complete as applicable.
6. **Given** a query shorter than three normalized characters or no eligible prefix matches, **When** search runs, **Then** no actionable matching account is returned; short queries never list accounts, and results always exclude self and blocked pairs.

### User Story 3 - Manage requests and friendships (Priority: P1)

The recipient decides whether to become friends. Senders can cancel outgoing requests, and either friend can end an accepted friendship. Both users can read the resulting relationship after refreshing or reopening the app.

**Why this priority**: Friendship must express recipient consent and persist consistently.

**Independent Test**: Accept one request and decline another; verify both participants' state and reject attempts by the sender or an unrelated account to respond.

**Acceptance Scenarios**:

1. **Given** a pending incoming request, **When** the recipient accepts, **Then** both users see one accepted friendship after refresh or reopening.
2. **Given** a pending incoming request, **When** the recipient declines, **Then** it leaves both pending lists and grants neither user friend-only access.
3. **Given** a pending request, **When** the requester or an unrelated user attempts acceptance or decline, **Then** the action is rejected and the relationship is unchanged.
4. **Given** an already accepted or declined request, **When** the identical decision is retried, **Then** the existing result is returned; a conflicting stale decision cannot overwrite it or affect a later request.
5. **Given** a declined request and no block, **When** either user deliberately sends a fresh request, **Then** a new pending request generation is created immediately and requires acceptance by its recipient. Replaying the previous send operation does not create a fresh request.
6. **Given** an outgoing pending request, **When** its sender selects Cancel request, **Then** it leaves both pending lists after refresh and cannot subsequently be accepted. A fresh request remains possible if unblocked.
7. **Given** an accepted friendship, **When** either participant selects Unfriend, **Then** it leaves both friends lists after refresh and friendship-only access ends; game history and access through game participation remain intact. Neither account is blocked.
8. **Given** acceptance races with cancellation, **When** acceptance completes first, **Then** the stale Cancel request action returns a conflict and does not silently unfriend the newly accepted friend. Old cancel/unfriend operations cannot affect a later request generation.

### User Story 4 - Block unwanted friendship interaction (Priority: P1)

A registered user blocks someone from a search result, incoming/outgoing request, or accepted friend entry. Blocking prevents social interaction in both directions and ends any pending or accepted relationship. Users can manage their own blocks.

**Why this priority**: Blocking must remain enforced against stale clients and direct requests.

**Independent Test**: Block before and after acceptance, then attempt search, sends, responses, and friend-only reads from both accounts and an unrelated account.

**Acceptance Scenarios**:

1. **Given** no relationship, a pending request, or an accepted friendship, **When** either user blocks the other, **Then** neither can start or accept requests between them while the block exists, and accepted-friend access is revoked.
2. **Given** a blocked pair, **When** either user uses stale state or bypasses the interface, **Then** prohibited interaction is rejected without weakening the block.
3. **Given** blocking races with sending or acceptance, **When** the operations settle, **Then** a successfully blocked pair has no active friendship or pending request.
4. **Given** both users independently blocked each other, **When** one removes their own block, **Then** the other block continues to prevent interaction.
5. **Given** the last block is removed by its owner, **When** the relationship is viewed, **Then** no friendship or pending request is restored; a fresh request and acceptance are required.
6. **Given** a block, **When** its target searches or attempts interaction, **Then** they receive a generic unavailable result without the owner's private block details.

### User Story 5 - Maintain one consistent account and history experience (Priority: P2)

A user receives consistent account and cloud-history data across screens, refreshes, and account switches, while local gameplay remains available. The obsolete one-time import of pre-release local history is retired with its supporting machinery.

**Why this priority**: The social feature should not add another independent state-management or identity mechanism to maintain.

**Independent Test**: Switch from account A to B while reads and writes are pending, reopen History and Friends, and verify that only B's authorized server data appears, with local history still usable.

**Acceptance Scenarios**:

1. **Given** two screens need the same account-scoped cloud data, **When** they load or refresh, **Then** they share one consistent result and do not require independent synchronization implementations.
2. **Given** account A has pending reads or writes, **When** A signs out and B signs in, **Then** late results cannot appear in B's screens, mutate B's local state, or refresh B's private data as if initiated by B.
3. **Given** pre-release local history exists, **When** users open preferences after this change, **Then** the old one-time claimant/import journey is absent, local history remains readable, and normal cloud history remains available without import-ledger dependencies.
4. **Given** the existing guest, lobby, gameplay, and game-history journeys, **When** account naming and data-access internals change, **Then** their existing authorization, retry, sequence, and historical snapshot behavior remains valid.

### User Story 6 - Make future changes reproducible and reviewable (Priority: P2)

A maintainer can change a feature's data contract in one documented place, regenerate dependent contracts, and obtain automated feedback before a change reaches a shared environment.

**Why this priority**: Cleanup has lasting value only if the workflow prevents the same drift and unused code from returning.

**Independent Test**: On a disposable checkout/database, introduce a deliberate schema/client mismatch and a prohibited module import; the documented checks fail. Rebuild from empty state and upgrade from the previous version; both produce the expected supported behavior.

**Acceptance Scenarios**:

1. **Given** a database field is renamed, **When** the contract-generation and validation workflow runs, **Then** stale client references are reported before merge.
2. **Given** a clean checkout, **When** the documented setup runs, **Then** a developer obtains a reproducible database and valid registered-user test fixtures without manually editing hosted data.
3. **Given** a new feature, **When** implemented using the documented feature boundary, **Then** screens reuse shared infrastructure and domain operations without accessing another feature's private implementation.
4. **Given** an obsolete export, dependency, or temporary exception, **When** maintenance checks run, **Then** it is reported for review; platform entry points and genuine runtime dependencies are retained.
5. **Given** the previous supported schema, **When** the change is applied, **Then** its upgrade checks pass and failure recovery is documented separately from destructive test-environment resets.

### Edge Cases

- Equivalent Unicode spellings, capitalization, repeated spaces, surrounding whitespace, blank names, control characters, and overly long input follow identical rules at every entry point.
- A rename races with search or a name claim: actions target the selected stable identity; if the name changed before submission, the current name is shown for reconfirmation.
- Offline submission, validation failure, or expired authentication preserves confirmed state; a failed fetch is not presented as an empty friends list.
- Repeated submissions, crossed requests, conflicting responses, and blocking races cannot create contradictory active relationships.
- Third parties cannot read another pair's relationship or private blocks.
- Deleted accounts cannot be searched or acted on; stale requests fail safely without changing surviving users' unrelated relationships or game history.
- Guest room names may match registered names without making the guest that account or granting social access.
- Sign-out, token refresh, account deletion, and account switching occur during requests or mutations; old-account data must not repopulate current caches.
- Dependency analysis can miss Expo routes, native autolinking, dynamic imports, and configuration entry points; static reports alone do not authorize removal.
- Removing import support must not remove local gameplay/history or the immutable multiplayer event/history model.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A registered account MUST have one authoritative unique username, used for discovery and current account-name presentation. The existing account display-name concept MUST be renamed to username consistently in onboarding, profile editing, validation messages, and the account data model. There MUST NOT be a second editable display name, handle, or independent social name. Guest names and historical participant-name snapshots remain distinct concepts.
- **FR-002**: Usernames MUST contain 3–30 Unicode code points consisting only of Unicode letters, numbers, and underscores after trimming surrounding supported space separators and NFC normalization. Internal spaces, other punctuation, controls, and format characters are invalid. Name equality MUST use one authoritative locale-neutral, context-independent Unicode lowercase rule and normalize canonically equivalent spellings. Accents remain meaningful (`Soren` and `Søren` are distinct). `Nikolaj` and `NIKOLAJ` collide; `Straße` and `STRASSE` remain distinct because full case folding is not required. Display spelling and capitalization are retained after normalization. The precise comparison examples and supported-space set are defined in [data-model.md](data-model.md).
- **FR-003**: Authoritative persistence MUST enforce name validity and global uniqueness for onboarding, edits, old clients, direct writes, and concurrent claims. Frontend availability checks MUST NOT be the enforcement mechanism. Unnamed accounts may exist during setup but cannot use social features.
- **FR-004**: Name changes MUST be atomic, owner-only, and preserve stable account identity, relationships, and history ownership. Rejected changes preserve the previous name. A successful rename releases the old name; name reuse MUST NOT transfer existing relationships or historical ownership.
- **FR-005**: Authenticated registered users with completed name setup MUST be able to search by a literal normalized username prefix of at least 3 characters, returning at most 20 eligible matches in canonical username order. Results expose only the target identity needed for selection, current name, and permitted relationship state. Apply eligibility and block filters before limiting results. Underscores match literally. Shorter queries return no accounts; users refine the prefix to narrow results, with no search pagination. Substring matching, email search, and public directory access are excluded.
- **FR-006**: Friendship actions MUST use stable account identities and reject ineligible participants, self-relationships, spoofed actors, unrelated actors, and interactions blocked in either direction. A selected identity MUST NOT be silently replaced if its old name is reused.
- **FR-007**: Each unordered account pair MUST have at most one current friendship relationship, with explicit requester, recipient, and pending, accepted, declined, or canceled state. New requests begin pending; only the recipient may accept or decline.
- **FR-008**: Friends MUST be accessible from Settings → Profile & username, with no Home-screen layout or navigation changes. Users MUST see incoming requests, outgoing requests, and accepted friends, with actions matching their role and confirmed current state. Senders MUST be able to cancel their outgoing pending requests; either participant MUST be able to unfriend an accepted friend. These actions end the current relationship without blocking, preserve game history, and revoke permissions granted solely by friendship. Only the pair's participants may read their relationship. Cancel request and Unfriend MUST target the displayed request generation and expected relationship state; stale cancellation MUST NOT silently become an unfriend action.
- **FR-009**: Identical retries MUST be safe even after later actions change the relationship. Reusing an operation identity with different input MUST fail. Crossed sends resolve to one pending request without automatic acceptance. Conflicting stale responses return current state or a conflict and MUST NOT modify a later request generation or undo a newer block decision.
- **FR-010**: After decline, either participant MUST be able to initiate a fresh pending request immediately when neither has blocked the other. A fresh send uses a new operation identity and creates a new request generation requiring recipient acceptance; replaying an earlier send MUST NOT recreate a request. Blocking prevents further requests. Existing cancellation behavior remains supported; canceled relationships may be requested anew and require fresh acceptance.
- **FR-011**: A block MUST belong to its creator and target a stable account identity. Either participant may block at any relationship stage. Blocking terminates pending/accepted friendship and prevents friendship interaction in both directions until all blocks for the pair are removed.
- **FR-012**: Users MUST be able to view and remove their own blocks, but MUST NOT read or remove another user's block records. Unblocking MUST NOT restore previous friendship, pending requests, or friend-only permissions.
- **FR-013**: Blocking MUST revoke access granted solely through accepted friendship, including existing friend-visible profile reads. It MUST NOT erase history or remove access independently granted by participation in a game. Blocking does not ban users from rooms or change room membership.
- **FR-014**: Reads and writes MUST enforce identity, privacy, transition, and block rules outside the frontend. Search excludes blocked pairs without disclosing who blocked whom. Offline or cached state cannot authorize actions, and users cannot write themselves directly into an accepted relationship.
- **FR-015**: Successful actions update the initiating view after confirmation. The other participant obtains current state on opening Friends, returning to Friends (including app foreground return while Friends is active), or explicit manual refresh. Each of these triggers a server read even if cached data is still considered fresh. Automatic live updates while remaining on Friends and request indicators elsewhere are excluded. Loading, empty results, authentication expiry, unavailable targets, and retryable errors MUST have distinct recoverable presentation without leaking private information.
- **FR-016**: The non-production rollout MUST support a reproducible clean database setup with valid unique test-account names, equivalent behavior when applying the schema change to valid test fixtures, and recovery instructions. Preflight MUST report invalid or colliding old test names and stop rather than silently rename them; disposable fixtures may be explicitly corrected or recreated. Any current account/profile name duplication MUST be reconciled into one authoritative label. A production duplicate-name remediation workflow is excluded.
- **FR-017**: Account deletion MUST remove the account from discovery and social relationships, clean up associated blocks, and release its current name without transferring prior relationships to a later owner.
- **FR-018**: Account identity MUST have one authoritative current representation. Unused parallel profile storage and its access paths MUST be retired once all readers, policies, tests, and deletion behavior use the supported model.
- **FR-019**: Account-scoped social and cloud-history reads MUST share consistent loading, refresh, error, and cancellation behavior. Account switches and sign-out MUST isolate caches and prevent late old-account responses or mutation callbacks from changing the new account's state.
- **FR-020**: This change MUST retire the pre-release one-time local-history claimant/import feature end to end, including its UI and runtime import-ledger dependencies. Local-only gameplay/history, cloud gameplay records, and legitimate guest snapshots MUST remain supported.
- **FR-021**: Features MUST expose explicit supported entry points and keep data access out of their presentation components. Reusable infrastructure MUST be shared where multiple features need it; domain-specific authorization and transitions MUST remain in their owning domain.
- **FR-022**: Database contracts used by the client MUST be reproducibly generated, connected to client checks, and checked for drift. A schema-only change MUST trigger the relevant client-contract and database checks.
- **FR-023**: Database evolution MUST use versioned reviewed changes with reproducible local fixtures, clean-install tests, upgrade tests, and recovery instructions. There MUST be one documented authoritative schema-editing workflow, with no untracked hosted schema edits.
- **FR-024**: The change MUST include an evidence-backed removal ledger for unused dependencies, dead demonstration code, superseded row contracts, and obsolete temporary exceptions. Removals require caller/configuration inspection and relevant build/test verification; necessary platform adapters, security controls, and idempotency mechanisms MUST be retained.
- **FR-025**: Future-development guidance and feature templates MUST agree with required testing and module boundaries. Any introduced dependency MUST have a documented current use, the code or maintenance burden it replaces, and adoption scope.
- **FR-026**: Cleanup MUST leave lint, unused-code and compiler checks free of warnings. Existing warning baselines are in scope; grandfathering findings does not satisfy completion. Preserve deliberate runtime error reporting and explain narrow framework/tool false positives.

### Key Entities *(include if feature involves data)*

- **Registered Account**: Stable identity, one unique current username, and setup eligibility. A username is a discovery label, never proof of authorization.
- **Friendship**: One relationship between two distinct accounts with requester, recipient, current decision, and request identity sufficient to reject stale actions.
- **Block**: A directional decision owned by one account targeting another. Opposing blocks can coexist independently; either prevents friendship interaction for the pair.
- **Game Participant Snapshot**: A session-scoped identity whose recorded name and history survive account renaming. Guest snapshots are not registered accounts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every completed account has one unique valid name; all tested equivalent-name conflicts are rejected and simultaneous claims yield exactly one owner.
- **SC-002**: In acceptance checks on web and native, two users can find each other, send a request, accept it, and see one friendship after refresh and reopening.
- **SC-003**: All tested self-actions, forged actions, third-party reads, invalid transitions, and blocked interactions are rejected without changing authorized state.
- **SC-004**: Every tested retry and concurrent request/response/block scenario ends in one permitted state; no settled blocked pair retains an active request or friendship.
- **SC-005**: Rename and name-reuse checks preserve 100% of existing account identities, relationship participants, history ownership, and recorded participant-name snapshots.
- **SC-006**: Under the reproducible SC-006 protocol in [quickstart.md](quickstart.md#sc-006-performance-protocol), each web/native search and manual-refresh group MUST have p95 request-dispatch-to-results-render latency of at most two seconds. Report failures separately; slower or failed operations remain recoverable.
- **SC-007**: Account-switch and delayed-response tests expose zero records or state updates from another account in social or cloud-history screens.
- **SC-008**: The documented validation detects an intentionally stale generated contract and an intentionally forbidden module import; clean setup and upgrade validation both pass for the implemented change.
- **SC-009**: No supported runtime path invokes the retired history-import operations or reads their ledger; existing local and cloud history regression scenarios continue to pass.
- **SC-010**: Every dependency added or removed in the change appears in the reviewed decision/removal ledger with supporting usage and validation evidence.
- **SC-011**: Lint and Knip report zero findings without a baseline exemption; type checks and Java compilation pass, and unit tests finish without unexpected warning output.

## Assumptions

- The user's unique-username decision supersedes feature 013's account display-name terminology and allowance for duplicate registered names. References to current registered-account names in this specification mean usernames. Guest names remain session-scoped and non-unique.
- The user confirmed all existing database content is test data and the app is not live. A clean test-data setup is sufficient; automatic renaming, collision ownership rules, and forced legacy-account remediation are unnecessary. This specification does not itself reset any database.
- Username prefix search requires at least 3 characters and returns at most 20 results. Substring matching, social recommendations, push/email notifications, shared-history/comparison UI (#143), and leaderboards (#146) are excluded.
- Unblock, cancel outgoing request, and unfriend controls are included on both platforms. Canceling or unfriending does not block future requests; fresh requests still require acceptance.
- Unicode letters and numbers remain supported; underscore is the only permitted punctuation. Planning must show how every write/search path implements FR-002 consistently, including non-ASCII examples; simple client-only lowercase validation is insufficient.
- Authentication and policy foundations from issues #130 and #125 are dependencies, not evidence that these additional social rules already work.
- Cleanup is part of this feature's acceptance scope. The existing framework stack remains the starting point; the plan selects targeted additions from primary-source research and rejects duplicate persistence or authorization layers.
- A one-time pre-launch migration baseline reset is not required to ship this change. Retain applied migrations for the normal upgrade path; document a separately controlled disposable-environment baseline procedure if later useful.

## Platform, State, and Migration Impact

- **Web and native**: Equivalent Friends entry point, name setup/editing, search, requests, friends, and owned-block management. Actions need accessible labels, keyboard/focus support where applicable, and clear pending/error states.
- **Shared state**: Names, friendships, and blocks are authoritative shared state. Refresh on opening, returning to Friends, or manual refresh provides convergence. Do not introduce social subscriptions, background polling, or request indicators elsewhere. Confirmed local actions still update the initiating view.
- **Schema and test data**: Plan an incremental schema change plus valid fixtures and a documented clean test-data setup. Do not build a production backfill system. A dirty test database may be reset or explicitly cleaned during implementation preparation; this turn only writes specifications.
- **Model consistency**: Rename the existing account-name field and its application contracts to username, updating all readers and writers together. Reconcile the older independent social profile label into that source without treating immutable game snapshots or guest names as account usernames.
- **Recovery**: Document recovery from failed test-data/schema setup and ensure it cannot silently disable uniqueness or block enforcement.
- **Evidence boundary**: Repository findings below were inspected locally. No hosted database inspection, mutation, or device validation was performed for this specification.

## Required Coverage

- Unit tests for name normalization/validation, error mapping, role-dependent actions, retries, and stale-state reconciliation.
- Database tests for name constraints, concurrent claims, pair uniqueness, authorized transitions, restricted reads, direct-write bypass attempts, mutual blocking, account deletion, and clean/migrated test-data setup.
- End-to-end coverage for choosing usernames, searching, sending, accepting, declining, canceling outgoing requests, unfriending, blocking, and refreshing persisted relationships between two registered accounts. Cover profile rename, consistent Username labels, and unavailable-username recovery on web and native.
- Explore the actual mobile flow with ARTEMIS before authoring executable UI tests, per repository instructions. Report mock/browser, persisted two-account, and physical-device evidence separately.
- Add account-cache isolation, request cancellation, late-mutation, import-retirement, generated-contract drift, and module-boundary checks. Existing gameplay/idempotency and local-history regression coverage is a release gate for the refactor.

## Repository Findings and Planning Inputs

- `components/auth/UsernameOnboardingForm.tsx` and `components/preferences/ProfileSection.tsx` explicitly allow duplicate names. `utils/accountRepository.ts` reads and writes the account display name.
- `supabase/migrations/027_host_profile_and_settings.sql` added a username, and `028_remove_accounts_username.sql` removed it. The new requirement renames the existing account display-name field to username rather than restoring two independent fields; preserve historical migrations and express the change in a new migration.
- `011_create_social_tables.sql` defines a separate profile name and a friendship lifecycle without blocks. `012_social_constraints_and_indexes.sql` already rejects self-pairs and duplicate unordered pairs; reuse these foundations where compatible.
- `014_profiles_rls.sql` allows owner/accepted-friend profile reads; `024_host_auth_accounts.sql` restricts account reads to the owner. Pre-friend discovery therefore requires intentionally limited search, not unrestricted access to account/profile records.
- `016_friendships_rls.sql` supports request insertion, recipient responses, and cancellation, but lacks blocks and fresh requests after terminal states. Assess policies and grants together so old/direct write paths cannot bypass new transitions.
- Planning should resolve constraints, canonical name storage, secure discovery, transitions, block ownership, deletion cleanup, and test-data setup within the existing persistence platform. Runtime/schema implementation is the next workflow phase.
