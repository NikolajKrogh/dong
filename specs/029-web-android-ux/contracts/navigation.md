# Shared navigation and presentation contract

This is the behavioral source of truth for all workers. Update spec/plan/tasks together before changing a public decision. Exact helper implementation names may change with coordinator review; parameter meanings may not drift between worktrees.

## Route vocabulary

| Route | Query vocabulary | Default/normalization |
| --- | --- | --- |
| `/setupGame` | `step=players|matches|common|assign` | players; after hydration use earliest unmet prerequisite for invalid/inaccessible requested later step |
| `/gameProgress` | `gameTab=players` | matches when absent/invalid; incidental tab choice replaces owned state so scoped overlay Back can reconstruct selection after Expo remount |
| `/lobby/[sessionId]` | `step=room|matches|common|assign` | room for pre-start; in-progress status ignores step; no membership granted by URL |
| `/history` | `tab=games|players|stats`; `friendId=<account ID>`; `gameId=<existing GameSession ID>`; `sort=date|players|drinks|goals|matches`; `direction=asc|desc` | games/date/desc. Legacy friendId without tab opens stats. Explicit valid tab takes precedence. friendId only applies to stats; self selection removes it. gameId applies to games details; incompatible parameters are removed with replacement |
| `/friends` | `tab=friends|requests` | friends. Child return restores prior tab rather than replacing caller |
| `/friends/search`, `/friends/blocked` | `tab=friends|requests` describes the caller's tab | friends when absent/invalid/ambiguous. Parse to a safe default without rewriting a direct child URL. Header Back uses the existing caller entry, or replaces to `/friends?tab=<resolved tab>` when no caller exists. Sign-in recovery preserves this validated child path and tab. |

Reject array/duplicate ambiguous values and malformed IDs to safe defaults; trim/bound strings and reuse existing ID validation. Do not assume local GameSession IDs are account UUIDs. Unknown view keys are ignored by parsing; canonicalization changes owned keys only and preserves unrelated validated return parameters. Defaults may be omitted from canonical URLs. Preserve legacy bare paths and legacy friendId links.

## Transitions and history

| Intent | Web | Android |
| --- | --- | --- |
| Meaningful setup step/History tab/comparison/detail change | Create a router history entry when state actually changes; Back/Forward reconstructs it | Screen/step Back follows task sequence; no duplicate equivalent page for repeated same selection |
| Sort choice; malformed-state normalization | Replace owned view state; no entry per incidental adjustment | Update current task; native sort modal still closes correctly |
| Game detail Close | Go back only when the prior owned entry is the underlying list; otherwise replace to list preserving tab/sort | Dismiss detail, retain list |
| Transient actions/sort/default-league panel open | Register router-coherent scoped dismissal so first Back closes; do not trap normal exit after close | Consume Back while panel owns dismissal, or use Modal.onRequestClose |
| Child header Back | Restore actual caller; safe parent fallback only if needed | Same caller semantics |
| Header Back on direct page | Explicit parent fallback if no usable in-app caller; external browser Back remains browser behavior | Existing stack if appropriate, otherwise safe parent |
| Home from game/lobby | Non-destructive, avoid repeated duplicate game/Home cycles | Same; do not reuse leave/end cleanup |

Do not mix raw pushState/popstate with router state independently. If the chosen router API cannot express a required overlay entry, the adapter must synchronize and test both histories as one lifecycle before integration. `setParams` is not proof that Back works. No global always-on Back handler. Focused topmost overlay owns dismissal; handlers unmount on blur/unmount.

## Safe destinations and roles

- History fallback: `/`; Friends fallback: `/`; search/blocked fallback: `/friends` with caller tab if known. Existing profile links remain supported.
- Missing active gameplay after hydration: explanation, Start/Resume when applicable, Home; no empty End Game action.
- Registered active configuration/status: `/lobby/[sessionId]`, keeping current room context and permissions. Do not enable new in-progress editing.
- Guest configuration/status: read-only guest status within gameplay using existing active snapshot/grant, with explanation/recovery for absent status; never enter the auth-only registered lobby or switch solo.
- Safe Home preserves context/membership. Leave/End retain distinct explicit controls and existing confirmation/error flows. Terminal-only context cleanup remains terminal-only.
- Signed-out Friends: direct Sign in plus Home; reuse validated account return/onboarding builders, not arbitrary external return URLs.

## Controlled Wizard handoff

Optional `activeStepKey` and `onStepChange(key)` props make step choice caller-controlled when provided; both absent preserve current local behavior. Use stable caller keys, not numeric URL indexes. Validate prerequisites after hydration/restoration and explicit transition. Preserve onBeforeNext pending-input/deferred advance exactly once. Do not continuously clamp a user on each polled snapshot. Route-state owner also owns Wizard compact labels/current-step semantics and connector fit.

## Home and accessibility

Affected screen inventory for semantic heading/title checks: Home, solo setup, gameplay, History, Friends/list/search/blocked, Settings/Profile/Leagues, sign-in/registration and lobby status/setup. Shared primitives must remain compatible with other callers; this feature does not require redesigning every unrelated screen. Account fields/error work targets sign-in/registration/verification and guest join, preserving existing recovery flows.

Home uses labeled Friends and History shortcuts within its existing layout. Reconcile Game Stats click destination/label rather than adding two competing History links. Preserve current-game and room re-entry. Signed-out Friends uses recovery; History keeps local support.

Web destinations are real links; commands are buttons, with no nested interactive targets. Native gets roles/names/current/disabled states and full touch targets. One main landmark per screen; visible/accessible headings and descriptive titles. Account autofill purpose differs between sign-in and registration. Errors announce on relevant change; hidden goal UI must not enter unrelated accessible output.

## Visibility/scroll matrix

Check web widths 320/360/390, landscape 640×360, desktop, 200% text enlargement, physical Chrome expanded/collapsed bars and IME. Check Android portrait/system font enlargement/IME/TalkBack. Populate lists at 1/20/100 rows where meaningful. Record viewport and scroll owner, top/middle/bottom behavior and final-action reachability. Allow vertical scrolling and intentional bounded modal lists; no primary overlap, unreachable action or horizontal page overflow. Do not remove native virtualization to make a web test pass.
