# Skill guide for implementation and review

**Feature**: 029 — Predictable navigation and usable mobile web
**Updated**: 2026-10-17
**Scope**: Instructions for future execution. Reading this guide does not authorize implementation, worktree creation, dependency installation or deployment.

## How every agent uses this guide

1. Read this file with agent-handoff.md before starting assigned task IDs. Resolve skills from the active session catalog; repository links below are relative to this document and work in each worktree.
2. Load the actual SKILL.md before applying it. Load additional skill references only for the work at hand. Announce first use concisely; record skill name, task IDs and relevant findings/checks in the handoff.
3. Apply the common skills below and the role-specific matrix. Conditional skills become required when their trigger occurs; they are not reasons to expand scope.
4. User decisions, repository instructions, constitution, feature contract and task ownership govern the work. Generic skill examples must be adapted to the installed packages and available tools. Report a material conflict or missing capability; do not invent APIs or silently skip acceptance gates.

For indexed source exploration, follow AGENTS.md directly: use the available `codegraph_explore` MCP tool or `codegraph explore` CLI before raw indexed-code searches. This is a repository instruction, not an additional skill requirement. Do not reindex or upgrade the repository as part of this feature.

## Common implementation skills

| Skill | When / purpose | Feature-specific application |
| --- | --- | --- |
| [speckit-implement](../../.agents/skills/speckit-implement/SKILL.md) | Coordinator starts execution; each worker follows its assigned task filter | Read full context but implement only assigned IDs. Coordinator owns shared task checkboxes, hooks, root configuration and integration; a worker must not run the whole backlog or auto-commit unrelated changes |
| `ponytail:ponytail` | All implementation workers and coordinator; resolve through the installed plugin catalog | Smallest complete fix, reuse current router/components/adapters, no speculative framework or dependency. No reduction of required accessibility, authorization, tests or runtime acceptance. Read its actual installed SKILL.md; do not pin another machine's cache/version path |
| [systematic-debugging](../../.agents/skills/systematic-debugging/SKILL.md) | Before fixing an audited or newly encountered defect/test failure | Reproduce/trace root cause and callers first; distinguish source risk, product defect and tooling failure. Preserve existing guards rather than patching symptoms |
| [react-doctor](../../.agents/skills/react-doctor/SKILL.md) | After a worker's React changes and after combined integration | Run the skill's changed-scope scan, inspect diagnostics and fix relevant regressions. A score is supplementary evidence, not a replacement for tests or device checks; report baseline/tool false positives with reasoning |
| [playwright-best-practices](../../.agents/skills/playwright-best-practices/SKILL.md) | Every worker writing/debugging web BDD tests; coordinator and reviewer assessing those tests | Use relevant locator/wait/assertion/fixture/isolation/debugging guidance inside the existing TypeScript Playwright BDD suite. Preserve feature/step conventions and current web-server configuration; no Python suite or new test architecture |
| [accessibility](../../.agents/skills/accessibility/SKILL.md) | C for US4/US5/US6; A/B for affected focus, overlay, step and navigation semantics; coordinator/reviewer for corresponding acceptance | Inspect rendered names/roles/states, keyboard/focus, forms/errors, zoom/motion and relevant audit failures. This is web guidance; native behavior still requires Android/TalkBack evidence |

## Role-specific skill matrix

| Owner / tasks | Required when doing that assignment | What the skills must help establish |
| --- | --- | --- |
| A — US1 and game/lobby/overlay US2: T006–T009, T013–T016, contributions to T017–T018 | Common skills; [tamagui](../../.agents/skills/tamagui/SKILL.md) for sheets/UI; repository Jest/component-test conventions; [web-design-guidelines](../../.agents/skills/web-design-guidelines/SKILL.md) for affected web controls/overlays | Preserve game context and permissions; verify top-overlay dismissal, focus, safe Home and listener cleanup on both platforms |
| B — Friends return and route position: T011–T012, T020–T024, T026, contributions to T017–T018 | Common skills; repository Jest/component-test conventions; web-design-guidelines for web navigation/semantics; tamagui when editing shared Wizard/History UI | Restore caller/tab and valid URL state without duplicates; preserve hydration, pending input, account fences and legacy links |
| C — US4/US5/US6: T028–T034, T036–T040, T042–T044 | Common skills; tamagui; web-design-guidelines; repository Jest/component-test conventions; [ui-taste](../../.agents/skills/ui-taste/SKILL.md) for compact layout/visual refinement | Correct actual roles/names/focus/autofill/errors; preserve established design while fixing overlap, scroll reachability and labeled Home shortcuts |
| Coordinator — T001–T005, T017, T025, T046–T049 and serialized Android contributions | speckit-implement/common skills; [code-reviewer](../../.agents/skills/code-reviewer/SKILL.md) for integration review; relevant testing/web/UI skills; ARTEMIS rules in AGENTS.md for device work | Verify worker outputs independently, integrate serially, keep shared contracts stable, and distinguish fixture/browser/native/release evidence |
| Fresh independent reviewer after a worker slot is free | code-reviewer; common CodeGraph guidance; web-design-guidelines for web changes; repository Jest/component-test conventions; tamagui for affected components; conditional Supabase skill below | Read spec/contracts and actual diff plus surrounding code, reproduce material findings, check negative cases and requirement coverage. Review only; no edits/merges without a separate assignment |

The matrix does not change agent file ownership or dependencies. For example, C waits for B's Wizard/History handoff even though C also applies UI skills. T003 freezes the skill/task selection alongside the shared contract before dispatch.

### Newly installed skills: task assignments

| Skill | Worker tasks | Coordinator/reviewer use |
| --- | --- | --- |
| playwright-best-practices | A T009 and game contribution to T018; B Friends contribution to T018 and T026; C T034/T037/T044 | T002 fixtures and T047 web validation; review all new BDD steps, isolation, assertions and failure diagnostics |
| accessibility | A T013–T017 overlay/focus behavior; B T011–T012/T022/T024 caller/step/History semantics; C T028–T034/T036–T040/T042–T044 | T047–T049 rendered web checks and separate Android acceptance. Apply only relevant checks within each assigned file boundary |

Neither skill changes ownership, task IDs or the shared navigation contract. C leads accessibility implementation; all workers remain responsible for accessibility in their own controls. These skills supplement web-design-guidelines (broad interface review) and UI Taste (visual refinement) rather than replacing either.

## Conditional domain skills

- [supabase](../../.agents/skills/supabase/SKILL.md): load before touching auth return/onboarding, account-private query/cache boundaries, guest authorization or Supabase calls. Likely relevant to A's role/guest handling, B's Friends/History recovery, and integration review. Retain existing helpers/permissions; consult current official documentation before changing service behavior. Form labeling alone does not justify rewriting auth. Database/schema expansion requires a revised plan, not merely this skill.
- [expo-dev-client](../../.agents/skills/expo-dev-client/SKILL.md): coordinator only when installed Android client/runtime compatibility or native rebuild is actually involved. Reuse DONG's existing dev client/USB-tunnel setup; do not switch to Expo Go or rebuild merely because generic examples suggest it. No iOS/TestFlight or publishing work is in scope.
- [speckit-analyze](../../.agents/skills/speckit-analyze/SKILL.md): coordinator or planning reviewer when contracts/requirements/tasks materially change; run its read-only consistency review and follow its remediation rules. Do not mark implementation accepted solely because artifacts are consistent.
- [speckit-converge](../../.agents/skills/speckit-converge/SKILL.md): coordinator when reconciling remaining implementation gaps against the approved spec/tasks. Update tasks centrally; this is not permission to invent new requirements or reopen completed slices without evidence.

## Important compatibility and scope rules

### Tests

Component testing follows the repository's installed Jest/renderer harness and existing suites. Inspect the actual test before choosing APIs. Prefer behavior-focused assertions and explicit waits supported by that harness. Do not import an absent library or add/migrate a testing dependency to follow generic skill examples. Propose a dependency change separately only if the current harness demonstrably cannot meet a required outcome. The incompatible RNTL-specific skill was removed from the project at the user's request.

Use the installed playwright-best-practices skill with the existing Playwright BDD features/steps/fixtures for web journeys. Read its relevant `core/locators.md`, `core/assertions-waiting.md`, `core/fixtures-hooks.md` and `core/test-suite-structure.md` when authoring tests; consult mobile, multi-user, authentication and debugging references only when that scenario needs them. Prefer meaningful role/name locators, observable state assertions and isolated fixtures. Preserve the BDD entry commands in quickstart.md rather than replacing them with generic examples that omit generation/configuration.

For critical race/history journeys, use the skill's targeted repeat/trace validation as appropriate; this does not require repeatedly rerunning the entire suite. Store useful traces/screenshots for failures and distinguish real data from mocks. Browser/mobile emulation does not establish physical Android acceptance. `npm run test:ci -- --runInBand` includes platform component suites; `test:unit` alone does not.

### UI and browser review

Before Tamagui implementation, follow its configuration-discovery instruction and use actual project tokens/media rules. Keep generated guidance local unless it is an intentional deliverable. Before each web-design-guidelines review, fetch its current source rules; examine actual rendered semantics and affected screen states.

The installed accessibility skill supplies deeper checks for keyboard/focus, labels/error announcements, document structure, enlarged text and reduced motion. Use its references for affected cases. Use an available rendered audit/AX tool when supported; choose a non-reloading snapshot when navigation reload would destroy authenticated or created state. Its Chrome DevTools/Lighthouse examples do not prove those tools exist in this session. Do not add global tools, new project dependencies or backend/auth changes solely because an example suggests them; identify a needed capability through the coordinator. A clean automated audit is supplementary evidence, not WCAG certification or a substitute for keyboard/screen-reader/device checks. Translate web semantics through existing cross-platform components rather than inserting browser-only elements into native rendering.

For UI Taste, use refinement/polish and craft guidance as needed, and audit guidance for final visual review. Preserve the existing DONG design. Native iOS/Overdrive/new-interface playbooks, paid reference services and a visual rebrand are not required. Skills do not override the chosen Home-shortcut design or turn reachable below-fold content into a clipping defect.

### Physical Android

ARTEMIS is a tool workflow governed by AGENTS.md, not an installed SKILL.md to invent. The coordinator controls device access. Explore actual interactions before authoring Android tests; use dynamic locators and verified coordinate fallback, explicit waits, diagnosis on errors and separate runtime evidence. Workers can contribute scenarios without independently driving the shared phone.

### Avoid unrelated workflows

Do not load deployment/upgrading/Java/database/Figma/image generation/GitHub publishing workflows merely because they are available. No Expo upgrade, new database schema, cloud deployment or PR publication is part of this feature's implementation authorization by default. Resolve any scope change with the coordinator first.

## What each worker reports

In addition to the commit/test handoff, list skills actually read and applied, their task IDs, any unsupported advice/tooling and how it was adapted, and the checks still incomplete. A list of skill names is not evidence that their checks ran. The coordinator records these summaries in validation.md and verifies relevant gates after integration.
