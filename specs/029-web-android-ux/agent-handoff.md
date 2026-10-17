# Agent execution and integration contract

Implementation was authorized on 2026-10-17 and worker slices are integrated on `web-navigation`. Reconciled against integration `f4c7547` and current runner source. This file records interfaces, ownership and remaining execution boundaries; it does not authorize additional workers/worktrees or mark acceptance complete. Results belong in validation.md and task progress belongs in tasks.md.

## Required reading for every worker

1. `AGENTS.md`, `CLAUDE.md`, `.specify/memory/constitution.md`.
2. `specs/029-web-android-ux/{spec,plan,research,data-model,tasks,quickstart}.md` and `contracts/navigation.md`.
3. Both `docs/*audit-2026-10-16.md` reports and relevant evidence; keep confirmed/source/unverified distinctions.
4. This file, [skills.md](skills.md) and the assigned task IDs. Follow the role-specific and conditional skill requirements; CodeGraph before indexed source exploration.

Skill names, source links, triggers, repository compatibility limits and reviewer requirements are defined in [skills.md](skills.md). Load the actual installed skill before use. This guide does not authorize backend redesign or new dependencies.

`playwright-best-practices` is required when writing/debugging/reviewing the assigned web BDD journeys. `accessibility` is required for C's affected UI work and each worker's relevant focus/control semantics; the coordinator/reviewer validates rendered outcomes. See skills.md for exact task mappings, selected references and native/web evidence boundaries.

## Common invariants

- Branch to integrate into: `web-navigation`; never reset/overwrite unrelated dirty work.
- Worktree start is the explicit approved committed integration baseline, not the remote default branch. A new worktree does not automatically contain current uncommitted plans/audit evidence. Coordinator records baseline SHA and included paths before dispatch.
- Existing permissions/game events/guest grants/private-cache fences remain canonical. No leaving, ending, scoring, friendship mutation or production test fixture creation merely to navigate/test.
- Query vocabulary, overlay lifecycle and Home behavior come from contracts/navigation.md. Change the contract centrally before divergent implementations.
- One writer per path at a time, including tests/configuration. Agent ownership is temporal; notify coordinator before crossing a boundary.
- Never label tests/runtimes passed without executing them. Tests using fixture mocks and physical device/hosted results have distinct labels.

## Roles and file ownership

| Owner | First assignment | Exclusive paths until handoff | Next assignment |
| --- | --- | --- | --- |
| Coordinator | Baseline, device runner/fixture contract, shared contract freeze, integration | `platform/index.ts`; root configs/package/lock files; planning artifacts; `scripts/android/`; shared e2e fixture/helpers; all merge operations | Lobby route-step integration and final regression/runtime acceptance |
| A: game/navigation | US1, then US2 game/lobby/overlay slice | `hooks/useGameProgressController.ts`; `components/gameProgress/{FooterButtons,GameActionsSheet}.tsx`; `app/gameProgress.tsx`; `app/lobby/[sessionId].tsx`; new `platform/navigation/` adapters; associated exact tests | Release lobby to coordinator, and adapter API to B; help controlled runtime verification |
| B: return/routes | US2 Friends child return/recovery first; US3 after adapter/wizard contract gate | `features/friends/*Screen.tsx`; later `app/{setupGame,history}.tsx`; `components/setupGame/SetupWizard.tsx`; `utils/navigation/`; History overlay integration and associated tests | Release Wizard, History and layout-facing props to C; coordinator handles lobby caller integration |
| C: presentation | US4 shared controls/forms/headings first | `components/ui/`; `components/auth/`; `components/preferences/Header.tsx`; `components/guestJoin/GuestJoinForm.tsx`; `app/_layout.tsx`; related tests | US6 `app/index.tsx`/Home display and US5 compact/scroll work after B handoff |

Exceptions to broad folders: A retains `__tests__/components/gameProgress/*`; B retains Wizard, History and Friends semantics until handoff. C must not edit Wizard/History screens concurrently for heading/layout polish; submit requirements to B or wait. C's PlayerList icon naming waits for B's solo caller changes to merge if their interfaces overlap. Shared `styles/setupGameStyles.ts` is owned by B for step connectors until its Wizard handoff, then C for schedule/other compact layout. Coordinator performs `platform/index.ts` export wiring from A's requested exports.

A also owns `components/preferences/SelectDefaultLeaguesModal.tsx` and `app/userPreferences/leagues.tsx` for dismissal integration; C owns the separate preferences Header file. T017 is a coordinator integration task combining A's default-league changes with B's History changes after adapter handoff; it is not assigned as one parallel cross-owner edit.

## Concrete task allocation

| Owner | Assigned task IDs | Dependencies/handoffs |
| --- | --- | --- |
| Coordinator | T001–T005, T017, T025, T046–T049; native-runner edits within T010/T019/T027/T035/T041/T045 | Record approved baseline, own shared fixtures/exports, serialize integration/device access |
| A | T006–T009, T013–T016; default-league contribution to T017; game portion of T018 | US1 before game/lobby US2; release adapter API and lobby before T025 |
| B | T011–T012, T020–T024, T026; History contribution to T017; Friends/route portion of T018 | Friends first; adapter before overlay integration; release Wizard/History/styles before C integration |
| C | T028–T034, T036–T040, T042–T044 | Shared controls/forms first; wait for B before Wizard/History/layout changes |

T010/T019/T027/T035/T041/T045 pair the respective story owner with the coordinator: worker supplies verified scenario/evidence and coordinator edits/runs the single native runner. T018 has one coordinator-designated writer for `ux-back-return.feature`/steps, collecting A/B scenarios; workers do not both edit it concurrently. All other BDD source files belong to their story worker.

Each worker owns uniquely named BDD feature/steps files listed in tasks.md. Coordinator alone updates shared step helpers/fixtures or root Playwright config. Do not duplicate existing step regex phrases. Generated `.features-gen/` output is not a hand-edited source.

## Implemented handoffs and scheduling

The approved worker baseline was `2604e1a`, on isolated `ux/game-navigation`, `ux/return-routes` and `ux/accessibility-layout` branches. A released the overlay API and lobby; B released Wizard/History/styles; C completed shared presentation/Home/compact work after those handoffs. The coordinator now owns Wizard Back behavior and solo/lobby callers, final History focus integration, shared runner/configuration and acceptance. A new edit needs an explicit current path owner; the allocation below is the original execution sequence, not permission to restart parallel edits.

1. Coordinator records baseline/fixtures and contract before dispatch. Implementation authorization was granted; preserve the recorded baseline and serial integration history.
2. Batch 1: A US1; B Friends-only US2 work; C shared US4 work. These paths are disjoint. Each runs relevant tests and returns commit IDs.
3. Coordinator integrates these serially and runs focused combined tests. A continues game/lobby Back/overlay work; B waits for adapter API before History overlays, but can prepare pure parsers/route tests. C can prepare Home work without editing active B/A paths.
4. A hands off lobby and finalized overlay API. B completes US3 solo/History/Wizard. Coordinator alone wires the lobby controlled-step caller after A and B merge. Do not merge a future interface call before its provider exists.
5. B hands off Wizard/History/styles. C completes remaining US4 screen integration and US5 geometry/scroll work; retain the controlled Wizard API and tests.
6. Coordinator integrates, runs full gates and serial physical journeys. At most three workers plus coordinator; use fewer when dependencies leave no independent work.

The five delivery changes can be committed/reviewed as slices on one integration branch and eventually one PR. A story is not accepted simply because a worker committed it; the coordinator verifies it after integration.

## Per-worker handoff format

- Assigned story/task IDs and completed IDs; actual baseline SHA and worktree path.
- Commit IDs, changed paths and any new exported interfaces.
- Tests/commands with results; fixture/mock versus live evidence; screenshots/log paths where relevant.
- Skills actually read/applied, associated task IDs, adaptations for installed tooling and incomplete checks (see skills.md).
- Remaining limitations, contract changes needed, shared-path handoff state.
- No automatic push, PR, merge into `web-navigation`, or worktree deletion by workers. Coordinator integrates one worker at a time and retains recoverable work until verification.

Workers report task completion to the coordinator; coordinator alone updates the shared tasks.md checkboxes to avoid merges over progress metadata.

## Implemented interfaces and preservation rules

- `TaskOverlay` is exported through `platform/index.ts`. Its props are `open`, `onClose`, `fallbackHref`, optional `returnFocusId`, and render-function children receiving `open`, `dismiss`, `runAfterDismiss`. Web uses the actual transparent `/taskOverlay` route with bounded owner registration; native renders the existing modal content in place. Destination actions wait for dismissal. Do not introduce raw browser history sentinels or global Back interception. Missing/stale owner recovery and focus restoration require rendered browser checks; the coordinator's new History focus gate remains in progress.
- `SetupWizard` supports optional `activeStepKey`/`onStepChange(key)` and `onStepBack(key)`. The first pair enables controlled stable-key state; absent props preserve local behavior. Task Back must not push a new duplicate previous-step entry. Preserve canEnter, hydration/readiness handling and at-most-once deferred pending-player advance. Coordinator owns current Wizard/caller changes.
- Route parsers remain in `utils/navigation/`; the public vocabulary/defaults are in contracts/navigation.md. Meaningful state transitions push, sort/normalization replace owned keys, and data remains in the existing stores/services. Preserve legacy links and account/target remount/privacy fences. Known authorized local History details may resolve despite an unrelated cloud error; incomplete fetch failure must not prove a missing target unavailable.
- `ShellActionButton` accepts destination `href` while retaining action/native props, caller roles and disabled suppression. Installed Tamagui 2 uses `render` to select actual web button/anchor elements; an old `tag` prop did not establish semantics. Shared main structure uses system typography and avoids nested main landmarks. Do not replace real rendered DOM assertions with renderer-only mock assertions.
- Compact Wizard page scrolling applies only to web height below 480 CSS pixels. Keep other content scrolling and native virtualization. Home uses labeled Friends/History shortcuts within the existing design, not persistent navigation. Default-league/game/History actions retain their explicit destructive-action boundaries.

## Skills and validation handoff

The actual skill requirements and source links remain in skills.md. Workers applied scoped Spec Kit implementation, Ponytail, systematic debugging, relevant Tamagui/web-design guidance, Playwright and accessibility skills; C additionally used UI Taste polish/craft for the existing design. React Doctor review supplements tests. Conditional Supabase guidance applies to auth/guest/private-cache work; no service redesign or new dependency was authorized.

Read actual installed skills before use. When an installed skill is absent in an older managed checkout, the current canonical `C:/src/dong/.agents/skills` directory was used read-only. The user removed the incompatible project RNTL skill: keep the installed Jest/renderer harness and do not add RNTL. Tamagui CLI prompt generation was unavailable; actual project configuration and installed package source established the supported API, without installation or committed generated config artifacts.

Run the exact commands in quickstart.md. `npm run test:ci -- --runInBand --cacheDirectory ./test-results/jest-cache` includes platform suites and the repository's Node/Expo preload. `npm run test:e2e -- ux- --workers=2` runs BDD generation and the feature's generated browser files; retain full existing regression checks too. The route-state feature does not require a shared tag to be selected by filename. Record the review base for React Doctor, and do not combine its current `--scope changed` option with the deprecated `--diff` alias. Results, reviewed findings and limitations belong in validation.md; command examples are not pass records.

Workers return only their own scoped commits, not imported dependency or integration merge commits. The coordinator serially integrates, verifies current source and updates task/validation metadata. No worker pushes, opens a PR, deletes a worktree or drives the shared phone without assignment. Documentation-only reconciliation does not invoke the speckit-converge task-appending workflow; convergence findings/tasks remain coordinator-owned.

## Android runner contract: implemented scope

`scripts/android/run-ux-journeys.ps1` exists and is coordinator-owned. Required parameters: `-DeviceSerial`, `-Package`, `-Scenario`, `-FixtureManifest`; optional `-OutputDirectory` defaults to `test-results/android-ux` relative to the script's repository. Package accepts only `com.krogh.dong` or `com.krogh.dong.dev`. Scenario accepts `game-context`, `back-return`, `route-state`, `accessibility`, `layout-scroll`, `home-shortcuts`, `all`.

Prepare an approved, already-authenticated fixture and open DONG on populated Home with Continue Game before invoking the runner. It does not launch/install the app, authenticate, seed a room or establish permissions. Example local manifest shape (replace placeholders and list only approved scenarios):

```json
{
  "deviceSerial": "<approved-serial>",
  "package": "com.krogh.dong.dev",
  "approvedForReadOnlyNavigation": true,
  "gameMode": "solo",
  "accountState": "signedIn",
  "scenarios": ["game-context", "back-return", "route-state", "accessibility", "layout-scroll", "home-shortcuts"],
  "homePlayerCountText": "<exact observed optional count label>",
  "homeMatchCountText": "<exact observed optional count label>"
}
```

The two count fields are optional; omit them unless they contain exact observed UI labels. The manifest records expectations/approval, never credentials. Top-level names matching password/secret/token are rejected. Preserve any separate local fixture identity/build notes without publishing private account data.

| Scenario | Current assertions and prerequisites |
| --- | --- |
| game-context | Requires existing solo fixture. Home -> Continue Game -> Game actions -> Setup; named Players step/input; safe Home and re-entry without scoring/ending. It does not exercise registered host/member or guest configuration. |
| back-return | Home -> gameplay -> actions -> hardware Back stays in gameplay; actions -> Home; two further resume/Home cycles. Requires populated Continue Game fixture. |
| route-state | Home -> History -> Players -> hardware Back restores Games sort control -> header Back Home. Does not exercise the full setup/lobby/detail/account-boundary matrix. |
| accessibility | Requires solo fixture. Names Player name/Add Player/Players step, opens IME, hardware Back dismisses IME while setup stays open, returns Home. Does not automate TalkBack, autofill or submission. |
| layout-scroll | Populated Home scrolls to Friends/History/Settings and back to Continue Game; saves top/bottom screenshots. Does not establish other list, enlarged-font, landscape or physical browser-bar acceptance. |
| home-shortcuts | Requires approved signedIn fixture. Home Friends -> Requests -> search -> header Back returns Received; hardware Back Home; History -> header Back Home. No friend/request mutation. |
| all | Runs the six checks above in order and requires every listed prerequisite. It is not shorthand for all roles or release acceptance. |

Invocation is shown in quickstart.md. Run `adb devices -l` first, obtain user device choice if ambiguous, and follow AGENTS.md ARTEMIS diagnosis/exploration rules. The runner checks that the selected serial is attached/authorized, DONG is foreground, manifest package/device/read-only approval matches, and each scenario is allowed. UIAutomator observations are fresh; labels/resource IDs/content descriptions are exact and package-scoped. Control readiness polls every 250 ms, up to 30 seconds by default/10 seconds before a press; IME/disappearance waits are bounded. Scroll discovery uses the observed scrollable control bounds and a maximum of eight attempts.

Only the Open game actions control has a calibrated absolute fallback, limited to the explored Huawei 1080x2240/default-font gameplay layout with no size override and expected Players/Matches controls. Do not generalize those coordinates to other devices/font sizes or new scenarios without fresh exploration. No fixed delay substitutes for a readiness assertion.

On success the runner writes scenario results to `results.json` and exits 0; each scenario's scope is the table above. Missing prerequisites, unsupported screen state and failed assertions exit 1, retain completed results plus failure, and attempt a foreground-only `failure.png`. Selected scenarios also save reviewed-context screenshots. Hierarchies are read on device and the temporary XML is removed; do not commit raw private dumps or credentials. Use a distinct local output folder per build/scenario to avoid confusing stale artifacts with current evidence.

## Pending acceptance and current ownership

The coordinator still owns final integrated History shared-comparison/detail presentation and focus checks, full gates and physical acceptance. The new focused regression must pass on the final source; docs do not mark a work-in-progress gate green. Read validation.md for exact results, not worker claims alone.

Android registered host/member/guest journeys remain pending unless explicitly recorded for the corresponding approved fixture/build. Current solo and signed-in read-only runner checks do not prove role permissions, guest recovery or server state invariants. Physical TalkBack/autofill, enlarged system font/IME, other populated list gesture handoff and real Chrome bar/landscape checks remain separate acceptance items. Packaged Android and production web build/runtime acceptance are also pending; dev-client and mocked browser results cannot substitute.

Keep unavailable checks not-run/blocked with the reason and next required fixture/build. No production mutation, new account credential request or role fabrication is permitted merely to complete a matrix. Changes to tasks.md, validation.md, plan.md, the navigation contract and runner remain coordinator-only unless reassigned.
