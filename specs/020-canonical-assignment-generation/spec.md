# Feature Specification: Canonical Player Assignments on Game Start

**Feature Branch**: `135-us54-generate-and-persist-canonical-player-assignments-on-game-start`

**Created**: 2026-07-25

**Status**: Draft

**Input**: GitHub issue #135 — `[US5.4] Generate and persist canonical player assignments on game start` (epic #116, depends on #134 / `specs/018-configure-start-game`)

---

## Overview

When a multiplayer game starts, every participant must see exactly the same set of
match assignments. Today the multiplayer lobby computes assignments on the host's
device and uploads the result, which means the outcome depends on which device
pressed the button and can drift from what other clients believe. This feature
makes the server the sole author of a room's assignments: whatever route the
assignments arrive by, the server settles them at the moment the game starts,
persists them together with the room's start transition, and publishes one
canonical result that every client reads back.

How a room's assignments get decided is the host's choice between three modes:

- **Automatic** — the server generates them, honouring the room's per-player match
  count and its shared-matches-per-pair rule.
- **Host-assigned** — the host allocates matches to each player by hand.
- **Player-picked** — each player chooses their own matches from the pool the host
  curated. Players never browse the match catalogue; they only pick from what the
  host already selected for the room.

Whichever mode is used, the started game runs on one server-settled set. After the
game is underway the host — and only the host — can change a player's matches,
without disturbing anything already recorded.

---

## Delivery Slices

This specification is the shared reference for **four** GitHub issues. It is
written whole because the behaviours only make sense against each other — the
settlement path is the same regardless of which mode fed it — but they ship
separately.

| Issue | Slice | User Stories | Functional Requirements |
|---|---|---|---|
| **#135** (this branch) | Automatic generation, shortfall warning and host override, retry safety | US1, US2, US4, US8 | FR-001 to FR-010, FR-012 to FR-025, FR-027 to FR-033 (excluding the mode clause of FR-029), FR-050 to FR-052 |
| **#184** | Assignment mode setting + host-assigned allocation | US3, US5 | FR-011, FR-026 to FR-027, FR-029 to FR-030, FR-034 to FR-037 |
| **#185** | Player-picked selection | US6 | FR-038 to FR-042 |
| **#186** | Host reassignment during an active game | US7 | FR-043 to FR-049, incl. FR-047a to FR-047c |

**Planning and implementation on this branch cover the #135 row only.** The other
three rows are specified here so their seams are designed for rather than
retrofitted; each has its own issue carrying the codebase notes needed to pick it
up cold.

Where this table and an inline *(deferred to #NNN)* tag disagree, **the inline tag
wins** — it sits next to the requirement it governs.

Two requirements are deliberately in #135's row despite belonging to the wider
picture: **FR-027** (a room with no mode set behaves as automatic) is what lets
#135 ship before the mode setting exists, and **FR-011** is listed under #184
because it only becomes observable once a non-automatic mode exists — until then
every room is automatic and the exact-overlap rule always applies.

---

## Clarifications

### Session 2026-07-25

- Q: Should the shared-matches setting be an exact overlap, a maximum, or a minimum? → A: **Exact overlap.** The host sets K, and any two players share exactly K additional matches. K=0 makes every player's set disjoint and the pool requirement linear; K≥1 makes it quadratic. K is therefore the dial that decides whether the room is expensive in matches.
- Q: Do all three assignment modes ship in this feature, or is automatic generation the story with the others as follow-ons? → A: **All three.** Clarified that player-picked means players choose from the host-curated room pool, not from the wider match catalogue.
- Q: Do the per-player count and the shared-per-pair rule apply outside automatic mode? → A: **Per-player count applies in every mode; the exact-overlap rule applies only to automatic generation.** Enforcing exact overlap against free choice creates dead-ends where a player has no legal pick.
- Q: In player-picked mode, what happens when a player has not finished picking by the time the host starts? → A: **The server fills the shortfall at start**, keeping what the player already chose. Additionally: when the room's match pool cannot satisfy the configured constraints, the host is warned and offered an explicit option to start anyway with the constraints relaxed, assigning at random and permitting overlap.
- Q: When the host changes a player's matches mid-game, what happens to scoring already recorded against a removed match? → A: **History stands and the change applies going forward.** Past goals and drinks on the removed match remain on the player's record; a reassignment is appended to the room's event history and nothing is rewritten.
- Q: How should a completed game's history describe a game whose assignments changed mid-play, given the existing history view reads the assignment table's end state? → A: **Snapshot the assignment map at completion**, and have history read that snapshot rather than the live table. Because a snapshot still records the end state, the per-moment timeline is reconstructed from the snapshot plus the retained reassignment records, and history must additionally convey that a game's assignments changed (FR-047a to FR-047c).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Everyone gets the same assignments when the game starts (Priority: P1)

A host with a full lobby — participants joined, matches selected, a Common Match
designated — presses "Start Game". The server settles one assignment set for the
room, saves it alongside the room's transition into active play, and every
participant's device shows that identical set when their screen switches to the
game dashboard. Nobody's device computes its own version.

**Why this priority**: This is the core of the feature and of the issue's first
acceptance scenario. Without it, multiplayer rooms can disagree about who is
watching which match, which silently corrupts scoring and history for the whole
session.

**Independent Test**: Start a room from the host device with two or more
participants connected on separate devices, and compare the assignment list each
device displays after the transition. All lists must be identical and must match
what is stored for the room.

**Acceptance Scenarios**:

1. **Given** a room in the lobby state with at least one active participant, a
   sufficient selected match pool, and a designated Common Match,
   **When** the host starts the game,
   **Then** the room holds exactly one stored assignment set,
   **And** every connected participant's device shows that same set,
   **And** no device shows an assignment that is absent from the stored set.

2. **Given** a room in automatic mode,
   **When** the game starts,
   **Then** every active participant is assigned the Common Match,
   **And** every active participant holds exactly the room's per-player match
   count of additional matches,
   **And** every pair of participants shares exactly the room's shared-per-pair
   count of additional matches, in addition to the Common Match.

3. **Given** a room whose lobby previously showed a draft arrangement that does
   not match what the server settles on,
   **When** the host starts the game,
   **Then** the stored assignment set is the one the server settled,
   **And** the earlier draft has no effect on the outcome.

4. **Given** a participant who joins the lobby after the host presses "Start Game"
   but before the start completes,
   **When** the start completes,
   **Then** the roster used to settle assignments is the roster locked in at the
   start of the transition,
   **And** no participant appears in the room's active roster without a
   corresponding assignment.

---

### User Story 2 - A room short on matches warns rather than blocks (Priority: P1)

A host tries to start a room whose selected match pool cannot satisfy the
configured rules — for example, six players wanting three matches each with no
overlap, but only twelve matches selected. Instead of a bare refusal, the host is
told what the pool cannot deliver and offered a choice: go back and add matches,
or start anyway with the constraints relaxed and matches handed out at random,
overlap permitted. Nothing is written until they decide, and a genuinely
impossible room is still refused.

**Why this priority**: This is the issue's second acceptance scenario, reframed by
clarification. It is what makes User Story 1 safe: a half-written assignment set
would be worse than none, because clients would read it as canonical.

**Independent Test**: Configure a room deliberately short of matches, attempt to
start, confirm the warning names the shortfall and offers the override, confirm
the room is untouched if the host backs out, and confirm the override produces a
complete set.

**Acceptance Scenarios**:

1. **Given** a room whose match pool is too small to satisfy its configured
   per-player count and shared-per-pair count,
   **When** the host starts the game,
   **Then** the start pauses rather than completing,
   **And** the host is told how many matches the room needs to satisfy the rules
   as configured,
   **And** the host is offered the choice to start anyway with the constraints
   relaxed,
   **And** the room is unchanged while the choice is outstanding.

2. **Given** that warning,
   **When** the host declines and returns to the lobby,
   **Then** the room remains in the lobby state,
   **And** the room holds no assignments from the attempt,
   **And** no start is recorded.

3. **Given** that warning,
   **When** the host explicitly chooses to start with constraints relaxed,
   **Then** every active participant still receives the Common Match and the
   configured per-player count of additional matches,
   **And** matches are drawn at random with overlap between players permitted,
   **And** the game starts normally,
   **And** the relaxation is recorded as part of the room's history so it is
   visible afterwards that the game was started this way.

4. **Given** a room whose pool holds fewer distinct matches than the per-player
   count itself requires — the one shortfall no relaxation can rescue —
   **When** the host starts the game,
   **Then** the start is rejected outright with no override offered,
   **And** the host is told the minimum pool size.

5. **Given** a room that fails any existing start validation rule (no
   participants, no matches, no Common Match, a Common Match no longer in the
   pool, or a room not in the lobby state),
   **When** the host starts the game,
   **Then** the start is rejected with that rule's existing message,
   **And** no assignments are settled or stored,
   **And** no override is offered — these are configuration errors, not
   shortfalls.

---

### User Story 3 - The host chooses how matches get decided (Priority: P2) — deferred to #184

Before starting, the host picks how the room's assignments will be decided:
generated automatically, allocated by the host, or picked by the players
themselves. The choice belongs to the room, so every participant sees which mode
is in effect and the lobby shows them the right thing to do.

**Why this priority**: The mode determines what the lobby shows every participant
and how the start behaves, so it gates User Stories 5 and 6. It is separable from
P1 because automatic mode is a workable default on its own.

**Independent Test**: Change the mode on the host device, confirm a second
participant's device reflects the new mode, reload both, confirm it persisted.

**Acceptance Scenarios**:

1. **Given** a room in the lobby,
   **When** the host selects an assignment mode,
   **Then** the mode is stored on the room,
   **And** every participant's lobby view reflects that mode.

2. **Given** a room whose mode has never been set,
   **When** any client views the room,
   **Then** the mode reads as automatic.

3. **Given** a room that is no longer in the lobby state,
   **When** anyone attempts to change the assignment mode,
   **Then** the change is rejected and the stored mode is unchanged.

4. **Given** a room where participants have already made picks or the host has
   already made manual allocations,
   **When** the host switches to a different mode,
   **Then** the change is accepted,
   **And** the host is told that the existing draft arrangement will not carry
   over.

---

### User Story 4 - The host tunes how many matches and how much overlap (Priority: P2)

The host sets how many matches each player gets beyond the Common Match, and — in
automatic mode — how many matches each pair of players should have in common. The
second setting is what decides whether the room is cheap or expensive in matches:
zero overlap means everyone's matches are their own and the pool requirement grows
gently with the roster; one or more means shared stakes and a pool requirement
that grows quadratically.

**Why this priority**: These are the generator's inputs, and the overlap setting is
the host's control over the pool cost. Automatic mode works on defaults without
them, so this is a deepening rather than a prerequisite.

**Independent Test**: Change both settings in the lobby, confirm a second device
sees them, reload, confirm they persisted, then start in automatic mode and verify
the resulting set matches both numbers exactly.

**Acceptance Scenarios**:

1. **Given** a room in the lobby,
   **When** the host sets the per-player match count or the shared-per-pair count,
   **Then** the values are stored on the room,
   **And** every participant's lobby view shows them.

2. **Given** a room with a shared-per-pair count of zero and a per-player count of
   N,
   **When** the game starts in automatic mode,
   **Then** no two participants share any additional match,
   **And** each participant holds exactly N additional matches.

3. **Given** a room with a shared-per-pair count of K greater than zero,
   **When** the host attempts to set the per-player count below what K requires
   for the current roster,
   **Then** the host is told the minimum the current roster and overlap setting
   allow,
   **And** the setting is not stored below that minimum.

4. **Given** a room whose stored per-player count has fallen below what the
   current roster and overlap setting require because more people joined,
   **When** the game starts in automatic mode,
   **Then** the required minimum is used instead,
   **And** the start is not rejected on account of the stale value.

5. **Given** a room that is no longer in the lobby state,
   **When** anyone attempts to change either setting,
   **Then** the change is rejected.

---

### User Story 5 - The host allocates matches by hand (Priority: P2) — deferred to #184

In host-assigned mode the host works through the roster in the lobby, giving each
player their matches from the room's pool. The lobby shows who is complete and who
is still short, and the host cannot start with anyone unallocated unless they let
the server fill the gap.

**Why this priority**: This promotes `specs/018`'s draft assignment editing into a
real mode with meaning, and it is the mode a host reaches for when they want full
control over who watches what.

**Independent Test**: Set the mode to host-assigned, allocate matches to some but
not all players, confirm the lobby shows the outstanding ones, then start and
confirm the stored set matches what was allocated.

**Acceptance Scenarios**:

1. **Given** a room in host-assigned mode,
   **When** the host allocates matches to a player,
   **Then** the allocation is stored on the room,
   **And** every participant's lobby view reflects it.

2. **Given** a room in host-assigned mode where every player has their full
   per-player count,
   **When** the host starts the game,
   **Then** the stored assignment set is exactly what the host allocated, plus the
   Common Match for everyone.

3. **Given** a room in host-assigned mode where some players are short of their
   per-player count,
   **When** the host starts the game,
   **Then** the server keeps what was allocated and fills each shortfall from the
   pool,
   **And** the host is told which players were filled in.

4. **Given** a room in host-assigned mode,
   **When** anyone other than the host attempts to allocate matches,
   **Then** the attempt is rejected.

---

### User Story 6 - Players pick their own matches (Priority: P2) — deferred to #185

In player-picked mode each participant opens the room on their own device and
chooses which of the host's selected matches they want, up to the room's
per-player count. The lobby shows everyone's progress so the host can see who is
ready. A player who never finishes picking does not hold the room hostage — the
server completes their set when the game starts.

**Why this priority**: This is the mode that makes the lobby feel like a shared
room rather than a host's console, but automatic mode already delivers a working
game, so it does not gate the P1 stories.

**Independent Test**: Set the mode to player-picked, have two devices each pick a
different number of matches, confirm each device sees the other's progress, start,
and confirm each player's stored set contains their own picks.

**Acceptance Scenarios**:

1. **Given** a room in player-picked mode,
   **When** a participant picks a match from the room's pool,
   **Then** the pick is stored against that participant,
   **And** every participant's lobby view shows the updated progress.

2. **Given** a participant who has already picked their full per-player count,
   **When** they attempt to pick another match,
   **Then** the pick is refused until they release one of their existing picks.

3. **Given** a room in player-picked mode where some participants have picked
   fewer than the per-player count,
   **When** the host starts the game,
   **Then** each participant keeps every match they picked,
   **And** the server fills each remaining slot from the pool,
   **And** the resulting set still gives every participant the full per-player
   count.

4. **Given** a room in player-picked mode,
   **When** a participant attempts to pick a match that is not in the room's
   selected pool,
   **Then** the pick is refused.

5. **Given** a room in player-picked mode,
   **When** a participant attempts to change another participant's picks,
   **Then** the attempt is rejected.

---

### User Story 7 - The host fixes assignments during an active game (Priority: P2) — deferred to #186

Half an hour into a game the host realises someone was given a match that has been
postponed, or a late arrival needs swapping in. The host changes that player's
matches from the active game screen. Everyone's device picks up the change on the
next refresh. Nothing that already happened is undone: goals and drinks already
recorded against the removed match stay exactly where they are, and the new match
counts from the change onward.

**Why this priority**: Called out as important, and it is the only part of this
feature that touches a live game rather than the lobby, which makes it the most
sensitive to get right on the history side.

**Independent Test**: Start a game, record scoring against a player's match,
reassign that match to something else, and confirm the player's earlier totals are
unchanged while subsequent scoring follows the new match.

**Acceptance Scenarios**:

1. **Given** an active game,
   **When** the host changes a participant's assigned matches,
   **Then** the change is stored as the room's canonical assignment set,
   **And** every connected device reflects it on its next refresh.

2. **Given** a participant with goals and drinks already recorded against a match,
   **When** the host removes that match from the participant,
   **Then** the participant's already-recorded goals and drinks are unchanged,
   **And** the room's event history retains every one of those records.

3. **Given** a participant who has just been given a new match,
   **When** scoring occurs on that match afterwards,
   **Then** it counts for that participant,
   **And** scoring that occurred on it before the change does not.

4. **Given** an active game,
   **When** a participant other than the host attempts to change any assignment,
   **Then** the attempt is rejected.

5. **Given** an active game,
   **When** the host changes assignments,
   **Then** the change is appended to the room's event history as a distinct
   record, so the game's assignment timeline is reconstructible afterwards.

---

### User Story 8 - A retried start does not reshuffle the game (Priority: P3)

A host on a flaky connection presses "Start Game", the response is lost, and the
app retries. The retry returns the same outcome as the original attempt rather
than settling on a second, different assignment set.

**Why this priority**: Automatic generation is random, so an unguarded retry would
not merely duplicate work — it would silently hand players a different game than
the one already on their screens. It is P3 only because `specs/018` already
supplies the retry-identity machinery this reuses.

**Independent Test**: Submit two start requests carrying the same retry identity
and confirm the room's assignment set is identical before and after the second,
with only one recorded start.

**Acceptance Scenarios**:

1. **Given** a start request that already succeeded,
   **When** the same request is submitted again as a retry,
   **Then** the response is equivalent to the first,
   **And** the room's assignment set is exactly the one settled by the first
   attempt,
   **And** the room records only one start.

2. **Given** a start that paused on a shortfall warning,
   **When** the host chooses to start with constraints relaxed,
   **Then** that is treated as the continuation of the same attempt, not a second
   one,
   **And** the room starts once, with one assignment set.

3. **Given** a start that paused on a shortfall warning,
   **When** the host abandons it and later starts afresh,
   **Then** the new attempt is evaluated from scratch against the room's current
   configuration,
   **And** the abandoned attempt leaves nothing behind that blocks it.

---

### Edge Cases

**Roster and constraint boundaries**

- **Solo room (one participant)**: there are no pairs, so the overlap rule is
  vacuous at any K. The participant receives the Common Match plus the per-player
  count. This must not be rejected — `specs/018` deliberately allows a
  one-participant start.
- **Two participants with K ≥ 1**: the minimum pairing case; the pair must share
  exactly K additional matches on top of the Common Match.
- **Per-player count of zero**: every participant holds the Common Match alone.
  Valid, and the only sensible configuration when the pool is minimal.
- **Stored per-player count below the roster's minimum, in automatic mode**: a
  host sets two for a three-person room at K=1, then two more people join, raising
  the minimum to four. The minimum wins; the stale value must not cause a
  rejection. In the other two modes there is no such minimum and the stored count
  stands unchanged.
- **A count valid in one mode but not another**: a host sets one match each in
  player-picked mode with six participants, then switches to automatic with an
  overlap of one, where the minimum is five. The switch must surface the new
  minimum rather than silently changing the number participants were shown.
- **Pool exactly the required size**: generation must succeed, not fail on an
  off-by-one.
- **Pool larger than required**: surplus matches go unassigned; the room keeps
  them in its selected pool.

**Mode interactions**

- **Mode switched after picks or allocations exist**: the draft does not carry
  over, and the host is told so before it is discarded.
- **Player-picked room where nobody picks anything**: every set is filled by the
  server at start; the game is indistinguishable from an automatic one.
- **Player-picked room where a participant leaves after picking**: their picks
  leave with them and free up nothing else — remaining players are unaffected.
- **Host-assigned room where the host allocates the Common Match explicitly**:
  treated as a no-op, since everyone holds the Common Match by definition.
- **Overlap setting in a non-automatic mode**: stored but not enforced, and the
  lobby must not imply it is being honoured.

**Start-time races**

- **Participant leaves during the start attempt**: the locked roster decides; a
  participant who leaves after the lock still receives assignments, and session
  history stays consistent.
- **Common Match removed from the pool between the host's last look and the
  start**: rejected by the existing Common Match validation before any assignment
  work happens.
- **Room already in progress**: the start is rejected on room state; assignments
  are never re-settled for a running game by the start path.
- **Host presses "Start Game" twice quickly as two distinct attempts**: the second
  finds the room no longer in the lobby state and is rejected — it must not
  produce a second assignment set.
- **Host abandons the shortfall warning without answering**: the room is left in
  the lobby exactly as it was, and a later start attempt re-evaluates from
  scratch.

**Mid-game reassignment**

- **Reassigning a match that is the Common Match**: refused; the Common Match
  belongs to everyone and is not a per-player assignment.
- **Reassigning to a match not in the room's pool**: refused.
- **Reassignment leaving a participant below the per-player count**: permitted —
  mid-game correction is the host's judgement, and the lobby-time count is not
  re-imposed on a running game.
- **Two devices where the host has the room open twice**: the later change wins
  and both devices converge on the stored set at their next refresh.
- **Reassignment after the game has completed or the room has closed**: refused.

---

## Requirements *(mandatory)*

### Functional Requirements

**Canonical settlement**

- **FR-001**: The system MUST settle the room's player-to-match assignments
  server-side at the moment the game starts. Clients MUST NOT be the source of the
  assignments a started game runs on, in any mode.
- **FR-002**: Settled assignments MUST give every active participant the room's
  Common Match.
- **FR-003**: Settled assignments MUST give every active participant exactly the
  room's per-player match count of additional matches, in every mode.
- **FR-004**: Settlement MUST draw additional matches only from the room's
  selected match pool, excluding the Common Match.
- **FR-005**: Settlement MUST use the room's active participant roster as locked
  at the start of the transition, so a concurrent join or leave cannot produce a
  participant without assignments or an assignment without a participant.
- **FR-006**: Wherever the system chooses matches itself, it MUST produce a varied
  arrangement across separate games rather than a fixed ordering.

**Automatic generation**

- **FR-007**: In automatic mode, generated assignments MUST give every pair of
  active participants exactly the room's shared-per-pair count of additional
  matches in common, in addition to the Common Match.
- **FR-008**: A shared-per-pair count of zero MUST produce assignments in which no
  two participants share any additional match.
- **FR-009**: **In automatic mode**, because FR-007 requires each participant to
  share matches with every other participant, the per-player match count MUST
  never be lower than the shared-per-pair count multiplied by one less than the
  active participant count. FR-003 and FR-007 are jointly satisfiable only at or
  above that minimum.
- **FR-010**: The **effective per-player count** used at start MUST be the room's
  stored per-player count in host-assigned and player-picked modes, and in
  automatic mode the greater of that stored count and the FR-009 minimum evaluated
  against the roster locked at start.
- **FR-011**: The exact-overlap rule of FR-007, and the derived minimum of FR-009,
  MUST apply only to automatic generation. Host-assigned and player-picked modes
  are constrained by the per-player count alone, and in those modes the count the
  host set is the count participants get — it MUST NOT be silently raised.

**Shortfall, warning, and relaxation**

- **FR-012**: Before settling, the system MUST determine whether the room's match
  pool can satisfy the effective per-player count and, in automatic mode, the
  shared-per-pair count. This determination MUST be readable without mutating the
  room, so the lobby can surface it continuously (FR-033) and the host can resolve
  a shortfall before any write occurs (FR-014).
- **FR-013**: When the pool cannot satisfy those rules, the system MUST NOT start
  the game silently and MUST NOT reject it outright. It MUST report the shortfall
  to the host, including the number of matches the room needs as configured, and
  offer an explicit choice to start with the constraints relaxed.
- **FR-014**: While a shortfall choice is outstanding, the room MUST remain
  untouched — still in the lobby state, with no assignments written and no start
  recorded.
- **FR-015**: When the host explicitly chooses to start with constraints relaxed,
  the system MUST still honour FR-002 and FR-003, drawing matches at random and
  permitting overlap between participants beyond the shared-per-pair count.
- **FR-016**: A start made under relaxed constraints MUST be recorded as such in
  the room's history, so it is afterwards evident that the game did not honour its
  configured overlap rule.
- **FR-017**: The system MUST reject the start outright, with no relaxation
  offered, when the pool holds fewer distinct matches than the effective
  per-player count requires — the one shortfall no relaxation can resolve.
- **FR-018**: The existing start validation rules (active participants present,
  matches selected, Common Match designated, Common Match present in the pool,
  room in the lobby state) MUST continue to apply, MUST be evaluated before any
  assignment work, and MUST be rejected outright rather than offered a relaxation.
- **FR-019**: The existing start rule that required every participant to already
  hold an assignment MUST be replaced: assignments are no longer a precondition of
  starting, they are settled by starting. A room with no pre-existing assignments
  MUST be startable.
- **FR-020**: When a start is rejected or declined for any reason, the room MUST be
  left exactly as it was before the attempt.

**Persistence and publication**

- **FR-021**: Settling the assignments, persisting them, and transitioning the room
  from lobby to active MUST take effect as a single all-or-nothing outcome. No
  observer may see a started room without its assignments, or assignments for a
  room that did not start.
- **FR-022**: Any draft assignments held for the room MUST be superseded by the
  settled set, so the started game has exactly one assignment set.
- **FR-023**: The system MUST record the assignment settlement as part of the
  room's auditable event history, so the started game's assignments are
  reconstructible from persisted records.
- **FR-024**: Every connected client MUST be able to read the canonical assignment
  set for the room through the same room snapshot it already polls, without a
  separate fetch or a client-side computation step.
- **FR-025**: A retried start carrying the same retry identity as an already
  successful start MUST return the original outcome and MUST NOT settle a second
  assignment set or record a second start.

**Room configuration**

- **FR-026** *(deferred to #184)*: The room MUST carry a persisted assignment
  mode — automatic, host-assigned, or player-picked — visible to every
  participant.
- **FR-027**: A room with no explicitly set assignment mode MUST behave as though
  it were automatic. This is what allows #135 to ship before FR-026 exists.
- **FR-028**: The room MUST carry a persisted per-player match count and a
  persisted shared-per-pair count, both visible to every participant.
- **FR-028a**: A room the host never configures MUST default to a shared-per-pair
  count of **zero** and a per-player count of **one** — every participant receives
  the Common Match plus one match nobody else holds. This keeps the default pool
  requirement linear (`1 + P`) and matches what multiplayer rooms do today. A
  default shared-per-pair count of one would instead impose the quadratic
  requirement (`1 + P(P−1)/2`, or 29 matches for eight players) on hosts who never
  asked for shared stakes.
- **FR-028b**: The effective per-player count MUST therefore be
  `max(stored per-player count, FR-009 minimum)`, which at the default
  shared-per-pair count of zero evaluates to the stored count unchanged.
- **FR-029**: The host MUST be able to change the per-player match count and the
  shared-per-pair count while the room is in the lobby state — and, once FR-026
  exists, the assignment mode too *(that part deferred to #184)*.
- **FR-030**: Changing any of those settings MUST be rejected when the room is no
  longer in the lobby state, and MUST be rejected for anyone other than the host.
- **FR-031**: **While the room is in automatic mode**, the system MUST refuse to
  store a per-player count below the FR-009 minimum for the room's current roster
  and overlap setting, telling the host what the minimum is. In host-assigned and
  player-picked modes any non-negative count MUST be accepted. Until FR-026 lands,
  every room is automatic by FR-027, so this applies unconditionally.
- **FR-032**: **In automatic mode**, a stored per-player count that has fallen
  below the FR-009 minimum because the roster grew MUST be raised at start rather
  than causing a rejection.
- **FR-033**: The lobby MUST show participants the number of matches each player
  will receive and the number of selected matches the room requires to start, both
  reflecting the current roster and settings, so a host is not surprised by a
  shortfall only at the moment they press "Start Game".

**Host-assigned mode** *(deferred to #184)*

- **FR-034**: In host-assigned mode the host MUST be able to allocate matches from
  the room's pool to any participant while the room is in the lobby state.
- **FR-035**: Allocation MUST be rejected for anyone other than the host.
- **FR-036**: At start, the system MUST keep every match the host allocated and
  fill any participant's shortfall from the pool.
- **FR-037**: The lobby MUST show the host which participants are still short of
  the per-player count.

**Player-picked mode** *(deferred to #185)*

- **FR-038**: In player-picked mode every participant MUST be able to pick their
  own matches from the room's selected pool while the room is in the lobby state.
- **FR-039**: Participants MUST NOT be able to pick a match outside the room's
  selected pool, and MUST NOT be able to change another participant's picks.
- **FR-040**: A participant MUST NOT be able to hold more picks than the room's
  per-player count, and MUST be able to release a pick to make room for another.
- **FR-041**: At start, the system MUST keep every match each participant picked
  and fill any remaining slots from the pool.
- **FR-042**: The lobby MUST show every participant how far each participant has
  progressed through their picks.

**Mid-game reassignment** *(deferred to #186)*

- **FR-043**: While a game is active, the host MUST be able to change any
  participant's assigned matches.
- **FR-044**: Mid-game reassignment MUST be rejected for anyone other than the
  host, and MUST be rejected once the room has completed or closed.
- **FR-045**: Mid-game reassignment MUST NOT alter, remove, or recompute any goal
  or drink already recorded, including those recorded against a match being
  removed from a participant.
- **FR-046**: After a reassignment, subsequent scoring MUST follow the new
  assignment, and scoring recorded before the change MUST continue to follow the
  assignment that was in force when it happened.
- **FR-047**: Each mid-game reassignment MUST be appended to the room's event
  history as a distinct record, so the assignment timeline of a game is
  reconstructible.
- **FR-047a**: A completed game's assignment record MUST be captured as a snapshot
  at the moment the game completes, rather than read live from the room's current
  assignments. The snapshot is immutable once taken.
- **FR-047b**: Because a snapshot records the map as of completion rather than as
  of kickoff, a completed game's history MUST also convey that its assignments
  changed during play, so the snapshot is not read as describing the whole game.
- **FR-047c**: The completion snapshot together with the reassignment records of
  FR-047 MUST be sufficient to reconstruct which matches a participant held at any
  point in a completed game — the snapshot supplying the end state and the
  reassignment records the deltas.
- **FR-048**: Mid-game reassignment MUST NOT be able to remove the Common Match
  from a participant or assign a match outside the room's pool.
- **FR-049**: Every connected client MUST pick up a mid-game reassignment through
  the room snapshot it already polls.

**Client behaviour**

- **FR-050**: The multiplayer lobby MUST NOT compute the assignments the started
  game runs on. Any lobby-side arrangement is a draft, and any lobby control that
  produces one MUST be labelled as a draft or preview rather than as the game's
  assignments.
- **FR-051**: On the transition into active play, clients MUST hydrate their
  gameplay view from the room's stored assignments rather than from any locally
  held arrangement.
- **FR-052**: The solo/local single-device game flow MUST keep its existing
  on-device assignment behaviour; this feature changes multiplayer rooms only.

### Key Entities

- **Room / Session**: The container for a multiplayer game. Gains an assignment
  mode, a per-player match count, and a shared-per-pair count alongside its
  existing state, selected match pool, and Common Match designation.
- **Participant**: An active member of the room's roster. Every active participant
  receives assignments at start, and may hold draft picks beforehand in
  player-picked mode.
- **Assignment Mode**: How the room's assignments are decided — automatic,
  host-assigned, or player-picked.
- **Match Assignment**: A link between one participant and one selected match in
  the room. A participant holds several; the full set for a room is the canonical
  assignment set.
- **Draft Pick / Allocation**: A pre-start intention — a participant's own pick or
  the host's allocation — that informs settlement but is not itself canonical.
- **Common Match**: The single selected match every participant is assigned,
  designated by the host before start.
- **Per-Player Match Count**: How many matches beyond the Common Match each
  participant receives. Distinguish the host's **stored** setting from the
  **effective** count used at start, which is the stored value raised to the
  FR-009 minimum.
- **Shared-Per-Pair Count**: How many additional matches any two participants have
  in common in automatic mode. Zero means fully disjoint.
- **Start Event**: The auditable record of the room's transition into active play,
  which the assignment settlement is bound to.
- **Reassignment Event**: The auditable record of a host changing a participant's
  matches during an active game.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a room of any size from 1 to 8 participants, in any mode, 100% of
  connected devices display an identical assignment list after the game starts,
  verified against the room's stored set.
- **SC-002**: In 100% of successful automatic starts, every participant holds the
  Common Match, holds exactly the effective per-player count of additional
  matches, and shares exactly the shared-per-pair count with every other
  participant.
- **SC-003**: In 100% of successful starts in any mode, every participant holds
  exactly the effective per-player count of additional matches.
- **SC-004**: A room whose host never touches the per-player or overlap settings
  starts successfully at every participant count from 1 to 8, given a sufficient
  pool — the derived minimum requires no host input.
- **SC-005**: With the shared-per-pair count at zero, a room of 8 participants each
  receiving 3 matches starts successfully with a pool of 25 matches, confirming the
  requirement is linear rather than quadratic at that setting.
- **SC-006**: In 100% of declined or rejected starts, the room afterwards holds no
  assignments from the attempt and remains startable once the host acts.
- **SC-007**: A host whose room has too few matches learns the required number from
  the warning alone, and can complete the start without leaving the flow, in 100%
  of shortfall cases that relaxation can resolve.
- **SC-008**: In 100% of player-picked starts, every match a participant picked
  appears in that participant's settled set.
- **SC-009**: In 100% of mid-game reassignments, the affected participant's goal
  and drink totals as of the moment before the change are identical to their
  totals immediately after it.
- **SC-010**: Repeating a start request with the same retry identity leaves the
  assignment set unchanged in 100% of attempts.
- **SC-011**: Across 100 automatic starts with the same roster, pool, and settings,
  at least two distinct assignment arrangements occur, confirming the outcome is
  not fixed.
- **SC-012**: Participants see their assignments, and any mid-game reassignment,
  within the room's normal synchronisation interval — no additional wait beyond
  the existing polling cadence.

---

## Assumptions

- **The overlap rule is exact, and it is the pool-cost dial.** Confirmed with the
  requester. With P participants, a per-player count of N and a shared-per-pair
  count of K, the pool must hold at least
  `1 + K×P(P−1)/2 + P×(N − K(P−1))` matches. At K=0 that reduces to `1 + P×N`
  (linear); at K=1 it reproduces today's `1 + P(P−1)/2` behaviour (quadratic). The
  host chooses which by setting K.
- **Each additional match used to satisfy the overlap rule belongs to exactly two
  participants**, and each private match to exactly one. Without this, a match held
  by three participants would silently contribute to three pairs' overlap and make
  "exactly K" ambiguous. This matches how the existing solo algorithm behaves.
- **The pairing invariants come from the existing solo game.** The rules in FR-002,
  FR-003 and FR-007 generalise what the single-device flow already enforces
  (`utils/setupGameAssignments.ts`), with the fixed overlap of one becoming the
  configurable K. Confirmed with the requester.
- **The assignment mode, per-player count, and shared-per-pair count are new
  persisted room settings.** None has an existing home in the room's data.
  Confirmed with the requester.
- **Player-picked mode does not give players access to the match catalogue.**
  Players choose only from the pool the host already selected for the room.
  Confirmed with the requester.
- **The server always settles at start.** Draft picks and host allocations inform
  settlement but are never themselves the canonical set. Confirmed with the
  requester.
- **A one-participant room is valid**, per `specs/018`'s stated assumption that the
  minimum participant count to start is one.
- **Clients keep the existing ~4-second room snapshot poll** as their
  synchronisation mechanism; no realtime subscription is introduced here.
- **Existing start-request retry handling from `specs/018` is reused** rather than
  replaced, but a start that pauses on a shortfall warning is neither completed nor
  abandoned, which is a third state that handling does not currently express. The
  warning-and-resume exchange needs its own agreement between client and server so
  that a resumed start is one attempt and an abandoned one leaves no residue
  (US8 scenarios 2 and 3).
- **Recorded scoring does not depend on the assignment table.** Verified against
  the existing schema: drink totals accumulate on the participant record, goals on
  the match record, and each gameplay event carries its own participant
  attribution. Nothing recomputes totals by joining assignments, which is what
  makes FR-045 achievable without versioning the assignment data.
- **Completed-game history currently reads the assignment table live** to report
  which matches each participant held, so a game reassigned mid-play would be
  described as though its final map applied from kickoff. Resolved by snapshotting
  the map at completion (FR-047a) and reconstructing the timeline from that
  snapshot plus the reassignment records (FR-047c). Confirmed with the requester.
- **A completion snapshot is an end-state record, not a timeline.** It makes
  history immutable and independent of the live assignment table, but on its own it
  would still present the final map as the whole game — which is why FR-047b
  requires history to convey that assignments changed.

---

## Dependencies

- **#134 / `specs/018-configure-start-game`** (closed): supplies the room
  configuration surface, the start-game command path, the room snapshot clients
  poll, and the retry-identity handling this feature builds on. Its start
  validation rule requiring pre-existing assignments is superseded here (FR-019),
  and its host-side assignment editing is promoted into host-assigned mode (FR-034).
- **`specs/017-lobby-presence-host-handover`**: supplies the lobby roster, the
  terminal `closed` room state that start and mid-game reassignment must reject,
  and the room-level activity tracking that the start and reassignment events feed.

---

## Out of Scope

- **Automatic reassignment when the roster changes mid-game.** If a participant
  leaves or joins after the game has started, the system does not redistribute
  matches on its own; the host may do so by hand under User Story 7. The
  history-preserving leave semantics remain tracked in #165.
- **Retroactive recalculation of any kind.** Settled scoring is never rewritten,
  by reassignment or otherwise.
- **Player-initiated changes during an active game.** Only the host may reassign
  once the game is underway.
- **Enforcing the overlap rule outside automatic mode.** Host-assigned and
  player-picked modes are bound by the per-player count alone.
- **A readiness or "lock in" gate in player-picked mode.** Participants pick, and
  the server completes whatever is unfinished at start; there is no explicit
  ready-check protocol.
- **Unifying the solo and multiplayer assignment code paths.** The solo flow keeps
  its on-device behaviour (FR-052); sharing one implementation between the two is a
  refactor, not a requirement of this story.
- **Abandonment policy for started rooms**, still deferred to #138/#165 as noted in
  `specs/018`.

---

## Platform, Auth, Shared-State, and Migration Impact

*(required by the constitution's delivery workflow)*

- **Platform impact**: The lobby gains a mode selector, two numeric settings, a
  per-participant pick interface, and a shortfall warning with an override choice;
  the active game screen gains host-only reassignment. All must behave identically
  on native and web. Settlement itself is server-side and platform-neutral.
- **Auth / guest impact**: Only the host may set the mode or counts, allocate in
  host-assigned mode, resolve a shortfall warning, or reassign mid-game. In
  player-picked mode every participant — including session-scoped guests — acts on
  their own picks and no one else's, which is the first time a guest writes
  room-scoped state beyond their own presence. That boundary needs explicit
  enforcement rather than UI-level restraint.
- **Shared-state impact**: This feature moves assignment authorship from the client
  to the server, which is the point of the story and directly serves the
  constitution's server-authoritative principle. The settled set becomes the single
  source of truth for a started room, and mid-game reassignment is a further
  server-authoritative mutation on a live game.
- **Migration / backfill impact**: The room's new mode, per-player count, and
  shared-per-pair count require a schema change whose unset values mean "automatic,
  derived minimum, overlap of one" so existing rooms keep today's behaviour without
  backfill. Draft picks in player-picked mode need somewhere to live that is
  distinct from settled assignments. Mid-game reassignment needs a new event kind,
  and FR-047a needs somewhere to hold a completed game's assignment snapshot plus
  a rework of the completed-game history read model, which today reads the live
  assignment table. Games completed before that snapshot exists have no mid-game
  reassignment to misrepresent, so their live-table reading remains accurate and
  they can be backfilled from it — or left to the existing path — rather than
  needing reconstruction. No backfill of historical assignments is otherwise
  needed: rooms already started keep the assignments they were started with.
- **Test strategy**: Unit coverage for the generator across the constraint space
  (overlap of zero and above, solo and two-participant boundaries, exact-size pool,
  stored count below the minimum, relaxed-constraint fallback, and the
  unresolvable-shortfall rejection); database-level tests for the all-or-nothing
  start, supersession of drafts, retry behaviour, the host-only and lobby-only
  guards on every setting, the participant-owns-their-own-picks boundary, and the
  immutability of recorded scoring across a reassignment; and end-to-end tests for
  the primary journey in each mode — including a second participant's device
  showing the same assignments, and a host reassigning mid-game.
