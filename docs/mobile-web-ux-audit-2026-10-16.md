# DONG mobile web UX audit

Date: 2026-10-16. Local source: commit `3750010`.

Implementation follow-up: [feature 029 validation and remaining acceptance](../specs/029-web-android-ux/validation.md). This audit remains a historical baseline.

Follow-up: [navigation audit across gameplay, lobbies, Friends, and History](navigation-audit-2026-10-16.md), including physical Android evidence and remaining checks.

## Scope and evidence

Goal: identify native-app assumptions that make DONG awkward in a mobile browser, while continuing to ship the Expo Android app. Native iOS release work is out of scope. Website behavior on mobile browsers remains in scope regardless of the phone operating system.

Used the repository's `web-design-guidelines` skill and the current [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), with the installed UI Taste audit checklist as supporting guidance.

This is an audit, not an implementation. No application code was changed.

Evidence labels:

- **Live + source:** reproduced on `https://dongthegame.com` and traced to local code. The deployed commit was not independently established; local locations identify the corresponding implementation.
- **Source:** implementation gap visible in code; its runtime impact still needs targeted verification.
- **Follow-up:** not established as a defect by this pass.

Browser inspection covered home, solo setup Players and Matches, guest join, signed-out Settings, Leagues, default league selection, sign-in, and registration. It included screenshots, DOM/accessibility snapshots, element geometry, browser Back, and refresh.

Responsive checks used phone portrait and landscape viewport overrides. Browser scaling sometimes made the effective CSS viewport differ from the requested override; measurements below use `innerWidth`/`innerHeight` read from the page, not screenshot pixel dimensions. Observed effective sizes included 288×576, 320×640, 355×711, 360×640, 400×711, 433×937, and 711×400. These are browser checks, not physical-device acceptance.

Only one local setup player, `Audit Player`, was added to exercise step navigation, then removed; the final UI showed 0 players. No account was created, room joined/started, league preferences saved, or game completed.

Not verified: physical Android app, physical phone browser touch/IME/browser bars, signed-in hosting, real multiplayer, populated history/comparisons, populated friends, actual goal notifications, offline/reconnect behavior, or large datasets. No executable tests were authored or run for this documentation-only audit.

## Priority overview

| ID | Priority | Finding | Evidence |
| --- | --- | --- | --- |
| W01 | P1 | Shared primary actions are non-focusable generic web containers | Live + source |
| W02 | P1 | Match Schedule title is obscured by its date/time badges | Live + source |
| W03 | P2 | Setup progress row extends outside narrow screens | Live + source |
| W04 | P2 | Browser Back and refresh do not preserve the current setup step | Live + source |
| W05 | P2 | Mobile step icons and several icon actions have no accessible names | Live + source |
| W06 | P2 | Account fields lack associated labels and explicit autofill purpose | Live + source |
| W07 | P2 | Registration refers to terms without a way to open them | Live + source |
| W08 | P2 | Screen content lacks web headings/main landmark | Live + source |
| W09 | P2 | Form errors have no explicit announcement or field association | Source |

P1 means address early because a primary action or important information is inaccessible. P2 means meaningful usability/accessibility work. These are audit priorities, not evidence that every release flow is broken.

## Findings by file

### `components/ui/ShellActionButton.tsx`

**W01 — P1 — `components/ui/ShellActionButton.tsx:5`, `components/ui/ShellActionButton.tsx:122`: shared action frame renders without button semantics or keyboard focus.**

- Home's Start New Game and profile/settings action both rendered as `DIV`, with no `role`, `tabindex`, or `aria-label`. The accessibility snapshot exposed generic containers/text. This differs from setup's TouchableOpacity controls, which do receive a tab stop; do not assume every control has the same failure.
- Impact: keyboard users cannot reach these shared home actions through normal Tab navigation. Assistive technology cannot identify their action role. This also affects mobile users with external keyboards and switch access.
- Correction: give the shared action a semantic web button, explicit disabled behavior, keyboard activation, and a visible focus state. Use actual links for destinations (see W04), rather than making every destination a button.
- Android: preserve native press behavior and accessibility props through the shared component/platform boundary. This is not a reason to replace the Expo application.

### `styles/setupGameStyles.ts` and `components/setupGame/MatchFilter.tsx`

**W02 — P1 — `styles/setupGameStyles.ts:1213`, `components/setupGame/MatchFilter.tsx:398`: schedule heading and summary badges collide.**

- Reproduce: Start New Game → add a player → Next → inspect the Matches panel with its active date/time summary.
- Visible evidence: on narrow portrait screenshots, the badges draw across the Match Schedule text, leaving fragments of the title visible behind them. At 360×640, expanding the filter did not resolve its header overlap. At the 288-pixel stress width, the compact team selectors also reduced to ambiguous `H...` / `A...` fragments.
- This is actual overlapping/clipped information, not ordinary content below the fold. The title and badges are siblings in one horizontal row; the title has a minimum width while the summary claims remaining flex space.
- Correction: put the title and expand control on their own row, with date/time summary below on compact layouts. Stack or otherwise clearly label team selectors when their available width becomes too small. Keep a compact single row only where it actually fits.
- Android: apply the same width-based layout improvement; long text and accessibility font sizes can cause the same conflict in native UI.

**W03 — P2 — `styles/setupGameStyles.ts:500`, `styles/setupGameStyles.ts:534`: progress indicators require more width than a narrow phone provides.**

- The four icon buttons measure about 56 pixels each; three connectors consume about 46 each including margins, for roughly 362 pixels total.
- Live geometry at 288×576: first step `x=-37..19`; last step `x=269..325`. Both end controls extend beyond the viewport. At 360×640 the row still extended approximately one pixel past either side; another effective 355-pixel sample also clipped both ends slightly.
- Correction: let connector spacing shrink and size the row to available width, or replace it with a compact labeled current-step indicator. Verify at 320 CSS pixels and larger text rather than relying on one phone width.
- Android: retain complete touch targets and readable step names; do not solve overflow by making controls tiny.

### `components/setupGame/SetupWizard.tsx`

**W04 — P2 — `components/setupGame/SetupWizard.tsx:85`: step navigation is local component state, independent of browser history.**

- Reproduced: Players → Matches leaves the URL at `/setupGame`; browser Back goes home, whereas the in-screen Back goes to Players. Refresh on Matches returns to Players while the added player remains persisted.
- This preserves some data but loses the user's place. A link cannot describe the current step. Similar tab/filter state in History should be reviewed separately; it was not tested with populated account data here.
- Correction: represent meaningful web steps in route/query state, validate prerequisites on direct entry, and deliberately define Back/refresh behavior. Use Expo Router links for navigational destinations so open-in-new-tab and link previews work. `app/index.tsx:86`–`98` currently navigate through imperative press callbacks; the observed home has no destination links.
- Android: retain a coherent hardware Back sequence and the existing game state; web URL support should share validation with native navigation, not duplicate game logic.

**W05 — P2 — `components/setupGame/SetupWizard.tsx:169`: compact steps are unlabeled icon controls.**

- Step names render only in wide layout. On mobile, the accessibility tree contains icon glyphs with no step names; inspected step elements have no `aria-label`. Users cannot readily learn what the controller, display, and branching icons mean or which step is current.
- Related locations: `app/index.tsx:197` has an icon-only profile/settings shortcut without a label; `components/preferences/Header.tsx:33` has an unnamed back icon; `components/setupGame/PlayerList.tsx:216` has an unnamed remove-player icon.
- Correction: give each control a role and specific name, expose the current/selected step, and show at least a current-step name and position on compact screens. Use player-specific remove labels. Decorative icon glyphs should not become control names.
- Android: the same names and selected state benefit TalkBack. Preserve the full hit area.

### `components/auth/AuthForm.tsx`

**W06 — P2 — `components/auth/AuthForm.tsx:284`, `components/auth/AuthForm.tsx:348`: visible captions are not associated with account inputs.**

- Live sign-in DOM: email and password inputs have no `aria-label`; their names fall back to placeholders. Both expose `autocomplete="on"` rather than a purpose such as email/username/current-password/new-password. There is no semantic form element.
- The password visibility control at `components/auth/AuthForm.tsx:367` is also an unlabeled eye icon.
- Correction: associate visible captions with fields or provide consistent accessible labels; configure explicit autofill purposes for sign-in versus registration, with native equivalents. Name the eye action Show password / Hide password. Keep the existing submit-on-keyboard behavior rather than assuming it is absent; the source already handles it.
- Android: use React Native-supported autofill/accessibility properties. Verify with Android autofill and TalkBack as well as browser password managers.

**W07 — P2 — `components/auth/AuthForm.tsx:457`: terms text has no navigable destination.**

- Registration visibly says “By creating an account, you agree to the terms of service.” It renders plain text; the observed account page has no `a[href]` elements.
- Correction: make the actual terms document available through a descriptive link, with a reachable native counterpart. Choose the document destination before implementation; this audit does not invent policy content.

**W09 — P2 — `components/auth/AuthForm.tsx:451`: error feedback is plain text without explicit announcement/association.**

- Source finding: shared error text has no alert/live-region semantics or field association. `components/guestJoin/GuestJoinForm.tsx:100` uses the same plain-text pattern. No invalid authentication requests were submitted during the audit.
- Correction: announce submission errors, associate field-specific errors with the relevant input, and move focus only when needed. Avoid moving focus for background updates. Keep error text visible and actionable on both platforms.

### `app/_layout.tsx` / screen wrappers

**W08 — P2 — `app/_layout.tsx:35`, `components/ui/ShellScreen.tsx:4`: custom screen chrome does not supply web document structure.**

- Live setup inspection found zero `h1`/`h2`/`[role=heading]` elements and zero `main`/`[role=main]` landmarks. Players is visually a section title but remains generic text. Browser title remained DONG across the inspected routes.
- Correction: supply a main landmark and meaningful screen heading on web, with ordered section headings, and descriptive route titles. Native headers can share text while using native accessibility roles. Audit actual rendered HTML rather than assuming React Native Text supplies heading semantics.

## Screen visibility ledger

| Screen/state | What was visible | Cut off, overlapping, or below fold? | Assessment |
| --- | --- | --- | --- |
| Home, signed out | Logo, Start New Game, Join Room as Guest, circular profile shortcut | Primary actions visible in inspected portrait view; profile has no visible text | W01/W05; no observed button clipping |
| Players, narrow portrait | Progress icons, player input/Add, empty state or one player, Home/Next | End progress icons extend outside narrow viewport; footer visible | W03; empty space alone is not a defect |
| Matches, portrait | Progress row, league filter, schedule summary, team selectors, Back/Next | Schedule title overlapped by badges; content panel scrolls; narrower team captions truncate | W02/W03; scrolling itself is not proof of a scroll trap |
| Matches, filter expanded | Date and time controls; result summary lower in panel | Lower controls may fall below the panel fold; fixed navigation remains visible | Reachability needs scrolling; distinguish from header overlap |
| Matches, landscape sample 711×400 | Header and Back/Next remain visible; league/schedule cards fill most content area | Only about 222 CSS pixels remain in the scrolling body; team selection/empty state below fold | Usability pressure; not proven unreachable |
| Guest join, portrait | Title, close icon, labeled room/name fields, Join Room, session-lifetime explanation | All visible in sampled view without a software keyboard | No demonstrated keyboard clearance pass |
| Settings / Leagues, portrait | Back, title and menu rows | Inspected rows fit; no observed clipping | Settings menu rows already expose button roles |
| Default leagues, 320×640 sample | Header/help, selection count, upper league rows, Save Defaults | Lower rows clipped by the list viewport and scrollable; Save stays visible; list 399px high for 538px content | Appropriate bounded modal list, not automatically a defect |
| Sign-in / registration | Captions, fields, submit and terms text | Registration fit in the sampled 320×640 view without IME | Does not establish fit after keyboard opens; W06/W07 |

## Additional investigation, not confirmed defects

1. **Reported nested scrolling:** the visited Matches state exposed one overflowing vertical panel, not competing nested vertical scrollers. Player and selectable-match lists explicitly use `scrollEnabled={false}` (`components/setupGame/PlayerList.tsx:461`, `components/matchSelection/SelectableMatchList.tsx:272`). Do not remove every list/modal scroll indiscriminately. Reproduce with populated matches, assignments, history, and a physical browser; identify the exact scroll owner under each swipe and test boundary handoff. Prefer one main scroll owner for ordinary web content; preserve intentional bounded dialogs and native list virtualization.
2. **Keyboard, browser bars, zoom and landscape:** the native config locks portrait (`app.config.ts:7`), but a website must handle landscape and reduced visual viewport height. `components/setupGame/TeamSelectionRow.tsx:173` autofocuses team search; `components/auth/AuthForm.tsx:143` autofocuses OTP input. Verify whether opening them brings up the IME unnecessarily and whether focused input, errors, Close and Submit remain reachable. Test browser zoom/text enlargement; narrow width alone is not a zoom test. Android app IME resizing must be verified independently.
3. **Dialogs and browser Back:** opening default leagues leaves the underlying route unchanged. Browser Back from that dialog returned to Settings, skipping the underlying Leagues screen; it did not act like the dialog's own close action. Define which task-level overlays should participate in web history. Escape did not visibly dismiss the guest modal in the sampled interaction, but timing/focus was not isolated enough to call it a confirmed Escape defect. React Native Web Modal already supplies some dialog/focus behavior; test it before adding a replacement.
4. **Hidden feedback:** screenshots did not show a goal toast, but AX snapshots repeatedly included `0-0` / `DRINK!` on unrelated screens. Inspect the mounted toast's visibility and assistive-technology exposure (`app/_layout.tsx:45`, `components/gameProgress/GoalToast.tsx:58`). Do not infer actual screen-reader announcements solely from snapshot text.
5. **Reduced motion:** setup filter and player-removal animations need a focused reduced-motion review. No app-level reduced-motion handling was found in the surveyed source, but dependency behavior was not exhaustively established.
6. **Authenticated and populated flows:** verify room sharing/copy/open-link behavior, direct lobby/comparison entry, reload/rejoin, stale/offline states, long player/team names, large history, and text wrapping. The audit cannot certify these from signed-out screens or source review alone.

## Existing behavior worth keeping

- The platform abstraction already distinguishes web from native gesture enhancements; web tab swiping is disabled while visible tab controls remain (`platform/gestures/fallbacks.ts`). Avoid adding competing touch gestures to solve layout problems.
- Guest join has explicit Room Code/Guest Name accessible labels and explains browser-session lifetime. The account flow already has keyboard submit handlers.
- Default-league Save remains available while its list scrolls. HistoryModalFrame already has safe-area-aware size limits and a named 48-pixel close control; it is a useful implementation reference, although populated history was not exercised live.
- The code already contains responsive layout support. Improve the failing compact cases rather than forcing one identical presentation on web and Android.

## Suggested implementation order and acceptance

1. Repair shared web action semantics/focus and icon names (W01/W05), account field labels/autofill (W06), and feedback semantics (W09). Verify real rendered controls and keyboard activation; run TalkBack on Android.
2. Fix compact setup geometry (W02/W03). At 320/360/390 CSS pixels, all progress controls and meaningful labels must fit without overlap. At landscape/reduced height, every action must be visible or reachable by the intended scroll owner. Verify larger text too.
3. Define navigation behavior (W04), headings/titles (W08), and the terms destination (W07). Browser Back/Forward/refresh should restore a valid task position; native hardware Back should remain predictable.
4. Run a populated, authenticated mobile-web walkthrough alongside an Android-app walkthrough. Reproduce the reported scroll friction before choosing a scroll architecture change. Keep web and Android results separate.

For substantial interaction/navigation fixes, add the repository-required primary-journey coverage after exploring actual device interactions with ARTEMIS as instructed by AGENTS.md. This audit is not a replacement for that runtime acceptance.
