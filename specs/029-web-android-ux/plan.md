# Implementation Plan: Predictable navigation and usable mobile web

**Branch**: `web-navigation` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)
**Input**: `specs/029-web-android-ux/spec.md`
**State**: Implementation authorized 2026-10-17; see validation.md and task status for current progress.

## Summary

Deliver six user stories in five bounded delivery changes: preserve game context; correct Back/return/recovery; restore task position; improve shared semantics/compact geometry; expose Home shortcuts and resolve evidenced scroll friction. Keep Expo Router, Zustand, existing auth/query boundaries and Tamagui. Add small platform navigation adapters and pure route-state parsing rather than a second navigation framework or new game-state store.

The public behavior is fixed in [navigation contract](contracts/navigation.md). The execution/ownership contract is [agent handoff](agent-handoff.md), with required per-role skill use and compatibility constraints in [skills.md](skills.md). Subagents read all three; task IDs in [tasks.md](tasks.md) are the work allocation unit. No agent owns an entire conceptual area if its files overlap another active worker.

## Technical Context

**Language/Version**: TypeScript ~5.9.3; React 19.2.3; React Native 0.86.3.
**Primary Dependencies**: Expo ~57.0.19, Expo Router ~57.0.18, React Native Web ^0.21.2, Tamagui ^2.7.7, Zustand ^5.0.15, existing TanStack Query 5.104.0 account-scoped server reads.
**Storage**: Existing Zustand/AsyncStorage local game state and server-authoritative multiplayer/history. Route state is a view projection, not a new persistent game store.
**Testing**: Jest/Jest Expo, existing component/platform suites, Playwright BDD. Add a host PowerShell ADB/UIAutomator Android journey runner using ARTEMIS-verified actions; serial device access and explicit waits. TalkBack/autofill/enlarged text remain runtime checks.
**Supporting skills**: Installed `playwright-best-practices` for web journey authoring/debugging/review and `accessibility` for rendered web focus/semantics/forms/layout checks; task-specific application and compatibility limits are in skills.md. Neither replaces native Android acceptance or changes the existing BDD/test harness.
**Target Platform**: Responsive web including phone landscape; Expo Android portrait. No native iOS release.
**Project Type**: Shared mobile/web client in existing polyglot monorepo; no Java/database implementation changes planned.
**Performance Goals**: No network request solely to update a local tab/step; no history/list copying into route payloads; preserve native virtualization. One navigation commit per intentional transition; normalization converges in one replace after hydration.
**Constraints**: Do not clear active context on ordinary navigation; preserve account remount/query fencing, guest grants, deferred pending-player add and permission checks. Do not introduce router internals or a parallel browser history manager without an explicit integration test proving synchronization.
**Scale/Scope**: Six stories, 20 requirements, 17 in-scope audit findings; W07 explicitly deferred. Test populated lists with 1/20/100 rows as applicable using controlled fixtures, not production mutations.

## Constitution Check

| Principle/gate | Pre-research | Post-design |
| --- | --- | --- |
| I Cross-platform first | PASS: web/Android specified separately | PASS: URL/overlay/IME contracts plus separate runtime gates |
| II Server-authoritative state | PASS: no new shared mutations | PASS: safe navigation observes existing room context; no backend write on navigation |
| III Event-backed history | PASS: no scoring/session history changes | PASS: view identifiers only; no event/schema/backfill work |
| IV Supabase first | PASS: existing auth/data services retained | PASS: no new Java/CRUD/persistence layer |
| V Story-first coverage | PASS: six Gherkin stories with edge cases | PASS: unit/component and web/Android journey tasks per story; runtime gates may remain incomplete |
| VI Skill-first | PASS: specify/clarify/plan/tasks/analyze/context skills read; Tamagui and Supabase constraints reviewed | PASS: applicable implementation skills named in handoff |
| Security/recovery | PASS: preserve account/guest isolation | PASS: invalid/expired targets have explicit fallback; rollback below |

These passes establish design compliance, not completed test evidence. No constitution exception requested. Do not mark Android accepted when the device/runner is unavailable.

## Phase 0: Research

Completed source/coverage research with CodeGraph and a read-only research subagent. Decisions, alternatives, official documentation and pitfalls are in [research.md](research.md). Questions resolved: Home shortcuts, no persistent navigation bar; defer terms content/link. No unresolved architectural clarification remains.

The installed Spec Kit branch hook was invoked with the explicit `GIT_BRANCH_NAME=web-navigation` override and `-AllowExistingBranch`. It reused the existing branch. The feature number is independently selected as 029 from existing spec directories. Optional auto-commit hooks are not executed: pre-existing dirty skill files/audit evidence must not be swept into an automatic commit. Hook record is in research.md.

## Phase 1: Design

### A. Safe navigation and overlays

Add focused platform adapters under `platform/navigation/`, exported via `platform/index.ts`, with a single navigation owner. Provide explicit safe-parent return and a scoped top-overlay dismissal lifecycle. Web dismissal participates in router-coherent Back history; Android consumes hardware Back only while relevant/focused, using `Modal.onRequestClose` for native Modal surfaces. Restore focus to the opener on web. Close and browser Back converge without double-popping. Do not intercept normal browser exit when no overlay is open.

Existing History Modal close handling is useful; the game actions sheet is a different presentation and needs explicit integration. Preserve quick-action behavior. Default-league selection belongs to the same dismissal contract. For direct-open detail routes, close removes detail state with replacement rather than leaving DONG when no known underlying list entry exists. A focused keyboard dismisses before any competing screen Back handler.

Implementation decision: scoped browser-history sentinels were rejected for stale-entry cleanup risk. A may add `app/taskOverlay.tsx` and a minimal owner-registration adapter; coordinator wires its transparent-modal Stack entry and platform export. Router owns Back/Forward. Direct/dead overlay entries fall back safely; native renders existing modal presentation in place. No second history manager is introduced.

### B. Preserve solo/registered/guest game context

Change `useGameProgressController` Setup destination and visible action naming by existing active context. Registered games use their actual room route; guest status remains inside guest-authorized flow (a read-only status overlay in gameplay is the minimal fallback). No registered lobby access is assumed for guests. Existing room phase/edit permissions remain unchanged.

Add distinct safe-Home navigation in lobby; do not reuse its destructive-context `goHome` helper used after successful Leave/End. Preserve the existing observed-start-versus-already-running hydration discriminator and its tests. Coordinator later wires lobby step state after these changes merge.

### C. View state owned by routes, data owned by existing stores

Use the exact query vocabulary in contracts/navigation.md with pure parsers under `utils/navigation/`. Meaningful web step/tab/target/detail changes create history; normalization/sort updates replace. `setParams` alone does not establish a Back entry. Route state drives the UI after hydration; subscriptions must also respond to Back/Forward, not just write URLs.

Extend SetupWizard with optional controlled `activeStepKey`/`onStepChange` while keeping its default uncontrolled behavior. Its caller validates steps at entry/restoration and explicit transitions. Retain `canEnter` semantics, deferred pending-player behavior and no polling-driven forced step jumps. The route-state worker owns ALL SetupWizard behavior, compact-step names/layout and reduced-motion integration needed there; no concurrent accessibility/layout edits to that file.

History resolves `gameId` against currently available authorized history, never trusts a serialized game. Preserve account/target fences and permission freshness. Existing `friendId` links remain supported. Friend selection updates route state in both directions and clears stale target on self selection.

### D. Semantics, responsive layout and discovery

Keep shared UI API compatibility while ensuring actual DOM semantics and native accessibility props. Primary destinations use links, actions use buttons; avoid nested interactive elements or double activation. Shell supplies main structure and screen-specific headings/titles without multiple nested main landmarks. Account labeling/autofill/error changes stay presentational and retain auth logic.

Keep the current Home layout and reconcile Game Stats with the labeled History entry. Friends is a direct Home destination with existing sign-in/onboarding recovery. After navigation/route ownership handoffs, implement schedule badge stacking, shrinking connector space, long-name wrapping and targeted scrolling changes. A bounded modal list is not automatically a defect; preserve native virtualization and evidence for unchanged cases.

## Project Structure

### Documentation

```text
specs/029-web-android-ux/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/navigation.md
  agent-handoff.md
  skills.md
  tasks.md
  quickstart.md
  checklists/requirements.md
```

### Source and tests (existing paths or planned additions)

```text
app/{index,setupGame,gameProgress,history,_layout}.tsx
app/lobby/[sessionId].tsx
components/{ui,setupGame,gameProgress,history,auth,preferences,guestJoin}/
features/friends/{FriendsScreen,FindFriendsScreen,BlockedAccountsScreen}.tsx
platform/navigation/                 # scoped adapters; existing terminal-room hook retained
utils/navigation/                    # planned pure parameter/transition helpers
__tests__/{app,components,hooks,platform,utils,features}/
e2e/features/                        # existing BDD features + story-specific features
e2e/steps/                           # unique step namespaces, reuse fixtures
scripts/android/                     # planned host runner, not created during planning
```

**Structure Decision**: Extend existing layers. New paths are explicitly prospective; tasks do not imply they already exist.

## Phase 2: Delivery and integration

See tasks.md for six story phases and exact dependencies. First freeze shared contracts and record verified test paths. Then run at most three workers plus coordinator. A safe first batch is multiplayer context (A), Friends-only return/recovery (B), and shared accessibility/forms (C). Route-state work and common Back integration follow the relevant handoffs. Layout never edits SetupWizard or History concurrently with route-state work.

Only the coordinator merges/cherry-picks completed worker commits into `web-navigation`, one at a time, and runs combined checks after merge points. Workers do not independently merge into the integration branch. Worker worktrees must explicitly start from the approved committed `web-navigation` planning/integration baseline, never the managed-worktree remote-default fallback. Planning artifacts and needed audit evidence must be included in that baseline before workers start. Implementation was authorized after planning; committed slices, actual worktree ownership and validation results are recorded in validation.md.

## Validation and release acceptance

- Unit/component: `npm run test:ci -- --runInBand`; `test:unit` alone excludes platform component tests and is insufficient.
- Static: `npm run typecheck`, `npm run lint`, `npm run check:unused`; relevant React Doctor review after React changes.
- Web: `npm run bdd:gen`, `npm run test:e2e` with unique story tags and all affected existing journeys. Record real base URL/build and effective viewport; fixtures/mocks are labeled.
- Android: ARTEMIS exploration followed by `scripts/android/run-ux-journeys.ps1` with explicit serial/package/fixture manifest, dynamic IDs/text then verified coordinate fallback, explicit state waits and nonzero failure. Do not invent fixture credentials or depend silently on live production data.
- Runtime: mobile Chrome and native Android checks in quickstart.md, including TalkBack/autofill, IME, enlarged text, populated scrolls and owner/member/guest re-entry. Shared phone access is serialized.
- Completion: every FR has tests/evidence, each story accepted independently, no unverified path silently passed. See validation.md for implemented coverage and remaining runtime/release acceptance.

## Rollback and recovery

No data migration/backfill. Revert a failing delivery slice and rerun cross-story navigation coverage. During parameter rollout, old bare paths and `friendId` links remain supported; malformed/unknown new view values fall back safely. View-only route state may be discarded; never clear authoritative room membership/history or account caches indiscriminately as a navigation rollback. Revoke no guest grant merely because the user opens Home.

## Complexity Tracking

No constitution violations. A navigation framework replacement, new persistence service, backend schema work, global history shim, persistent tab bar and indiscriminate removal of ScrollViews are deliberately excluded.
