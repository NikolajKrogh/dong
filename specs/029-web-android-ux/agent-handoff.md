# Agent execution and integration contract

Planning artifact only. Do not spawn implementation workers or create worktrees merely because this file exists.

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

## Scheduling

1. Coordinator records baseline/fixtures and contract; no implementation dispatch until this planning package is reviewed and implementation is requested.
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

## Android runner contract (to implement, not current executable code)

Planned path: `scripts/android/run-ux-journeys.ps1`. Parameters: explicit `-DeviceSerial`, `-Package`, `-Scenario` (game-context, back-return, route-state, accessibility, layout-scroll, home-shortcuts, all), `-FixtureManifest` (local approved non-secret identities/state), `-OutputDirectory`. Reject missing/ambiguous device, wrong foreground/package, absent fixture prerequisites or unsupported screen state with nonzero exit and diagnostics. Do not accept credentials through chat/logs or silently skip unavailable scenarios as passed.

Use UIAutomator resource IDs/content descriptions/text dynamically. Coordinate fallback is allowed only for a locator verified through ARTEMIS in the same supported layout, documented relative to screen size. Wait on explicit state predicates, with bounded polling (e.g. 500 ms interval, 10-second control/30-second hydration timeout); no fixed sleep substituted for a readiness assertion. Screenshots/XML/log summaries go to ignored/local evidence paths and are reviewed before committing selected non-sensitive evidence. Serialize all phone interaction; `adb devices -l` first and ARTEMIS diagnosis rules on tool failures. No native test code is authored before ARTEMIS exploration.
