# Research and decisions

Date: 2026-10-17. Baseline: `web-navigation`, source `3750010`; verify again before implementation.

## Decisions

| Decision | Evidence and rationale | Alternatives considered |
| --- | --- | --- |
| Retain existing router/store/UI foundations | Expo 57/Router 57, RN Web, Zustand and Tamagui already support the affected routes | Separate web app or new navigation framework adds unnecessary migration |
| Freeze a shared navigation contract before worker edits | Audits and CodeGraph show inconsistent push/replace/local overlay semantics | One global push→replace substitution would break valid Back journeys |
| Scope overlay handling behind platform adapters | `FooterButtons` has local sheet state; HistoryModalFrame already handles native Modal close; terminal `useRoomEndedExit` is specialized | Reusing terminal auto-exit for ordinary screens would conflate task exit with session termination |
| Preserve actual game context | Setup handler clears context; lobby goHome is used after destructive exits | Reusing that helper for safe Home would recreate the defect |
| Guest room status can be a read-only gameplay overlay | Registered lobby has auth gate; guest grant/re-entry follows separate existing flow | Routing guests blindly into registered lobby is invalid; new guest backend not required |
| Meaningful route state must be bidirectional | History reducer is local; SetupWizard owns local index; only friendId currently initializes History | Writing query params alone fixes refresh but not necessarily Back history |
| Add optional controlled Wizard behavior | Existing canEnter/deferred pending-player behavior supports both solo/lobby | Fully replacing Wizard or constantly clamping on polling would regress editing |
| Preserve private-data fencing | History keys content by account/target and uses existing permission checks | Treating an ID in a URL as authorization is invalid |
| One writer per shared file | Wizard, lobby, History and Home span proposed workstreams | Worktree isolation alone does not remove semantic merge conflicts |
| Home shortcuts, no persistent nav | User clarification 2026-10-17 | A new persistent navigation shell is outside chosen scope |
| W07 deferred | User clarification: no terms document/link in this effort | Inventing terms content/destination is not part of UI remediation |
| ADB host runner for executable Android journeys | Existing repository has Playwright BDD and ADB/ARTEMIS, but no demonstrated native journey runner | Adding a full native testing framework now is unnecessary; manual-only Android acceptance does not fulfill automated journey coverage |

## Source anchors and regressions to preserve

- `hooks/useGameProgressController.ts`: Setup clears multiplayer context; active controller already exposes identity/role/status.
- `components/gameProgress/FooterButtons.tsx`, `GameActionsSheet.tsx`: local sheet visibility, unconditional Setup; no general Back lifecycle.
- `app/lobby/[sessionId].tsx`: destructive-exit goHome clears context; Return to game pushes; observed-start hydration replaces. Preserve start/re-entry discriminator.
- `hooks/useHomeRoomActions.ts`: registered room and guest re-entry already exist; guest grants are separate.
- `features/friends/*Screen.tsx`: replace-to-parent headers and local Friends/Requests tab. Add screen navigation tests without changing social repository commands.
- `app/history.tsx`: local reducer, initial friendId, account/target remount fence, existing sort fields date/players/drinks/goals/matches.
- `components/setupGame/SetupWizard.tsx`: keys supplied by callers; solo players/matches/common/assign; lobby room/matches/common/assign. canEnter gates entry but deliberately does not force the editing user backward. onBeforeNext defers pending-player advance.
- `components/history/HistoryModalFrame.tsx`: native onRequestClose and safe-area/body scrolling already implemented.
- `components/ui/ShellActionButton.tsx`, `ShellScreen.tsx`, `components/auth/AuthForm.tsx`, `styles/setupGameStyles.ts`: targeted shared semantics/geometry work, not framework replacement.

Existing suites to preserve: `__tests__/hooks/useGameProgressController{,.multiplayer}.test.ts`, `__tests__/components/gameProgress/{FooterButtons,GameActionsSheet}.platform.test.tsx`, `__tests__/app/lobby/{lobbyInProgress,lobbyWizard}.platform.test.tsx`, `__tests__/components/setupGame/SetupWizard.platform.test.tsx`, `__tests__/app/{setupGame,history}.platform.test.tsx`, `__tests__/components/history/{HistoryModalWeb.test.tsx,SharedHistoryNavigation.platform.test.tsx}` and guest-start hook tests. CodeGraph's missing-covering-tests heuristic is not proof these tests are absent.

## Official documentation checked

- [Expo Router URL parameters](https://docs.expo.dev/router/reference/url-parameters/): local params scope route updates; updating setParams alone does not push a new history entry. Therefore explicit transition/history tests are required.
- [React Native BackHandler](https://reactnative.dev/docs/backhandler): modal handling and Android subscription lifecycle require care. Native Modal should use its request-close path rather than competing listeners.
- [React Native Web accessibility](https://necolas.github.io/react-native-web/docs/accessibility/): validate actual rendered roles/names/focus; generic styled containers do not guarantee correct controls.

These sources support the design; verify exact APIs against installed dependencies before coding. No dependency upgrade is planned.

## Spec Kit execution record

- Read CLAUDE.md, constitution 1.1.0 and local specify/clarify/plan/tasks/analyze/context skills. Loaded Tamagui and Supabase guidance to retain platform/auth boundaries; no backend implementation undertaken.
- Mandatory before-specify hook: `EXECUTE_COMMAND: speckit.git.feature`; executed installed PowerShell script once with explicit existing `web-navigation` override and AllowExistingBranch. No new branch created.
- Resolved core spec template through Resolve-Template; selected sequential directory 029 independently of branch name; persisted `.specify/feature.json`.
- Clarification: two questions answered; requirements checklist 16/16. Context/prerequisite and setup-plan scripts resolve this feature.
- Optional Git auto-commit hooks before/after clarify/plan/tasks/analyze are recorded but not executed. `/speckit-git-commit` remains optional; intentional dirty files are preserved.
- Agent-context extension was invoked, but its Python probe selected the WindowsApps python3 alias and failed before parsing YAML. Applied the equivalent managed-plan-reference update directly to CLAUDE.md and AGENTS.md, verified by diff. No script/runtime installation or unrelated feature 028 edits were made.

## Open implementation verification, not unanswered product questions

Skill follow-up, 2026-10-17: the user installed project-local playwright-best-practices and accessibility. Their installed SKILL.md files were inspected and the worker/task/validation requirements added to skills.md, plan, handoff, tasks and quickstart. This supersedes the earlier absence of dedicated Playwright guidance. No runtime test, UI audit, dependency change or implementation was performed by this documentation update.

Prove router/overlay history synchronization with integration tests; establish native dynamic locators on the current client through ARTEMIS; reproduce exact competing-scroll cases with controlled populated fixtures; check packaged release behavior separately. These are assigned work in tasks.md, not assumptions of successful acceptance.
