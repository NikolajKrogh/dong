# Implementation progress — 2026-10-30

Requirements review is complete: feature-quality39/39 and requirements16/16. See checklists/review-evidence.md. These checked questions certify document clarity, not finished feature behavior.

The user-authorized unit-only/no-Android exception remains in force. The user subsequently authorized hosted migrations: the staged foundation was deployed on2026-10-30; see [deployment.md](deployment.md).

Completed independent work: the shared kickoff formatter and its shared-row assertions now use HH:mm, with timezone preservation, narrow clock parsing and unknown handling. The domain generator, local persistence fields, additive target schema/settings/snapshot projections and constrained HiGHS adapter have initial executable coverage. Existing v1 scalar writers are guarded from mutating adopted v2 rooms. These are foundations; new per-player controls and full room/editor flows are not wired yet.

Validation so far:

- Formatter/list:40 unit assertions; generation20; store9. Focused suites pass.
- Isolated fresh local migration plus seeded database units:72files/1190assertions pass, including20 new target tests. The initial harness omitted the required repository seed actors; supplying that seed and extending two exact column-list expectations resolved those failures. Deployment staging additionally verifies disabled capabilities and adoption grants.
- Targeted ESLint, client TypeScript and Deno adapter/probe checks pass at this checkpoint.
- Actual constrained Edge cold/warm model probes pass. The maximum row guard was lowered to30000 for memory headroom. Raw measurements are in test-results/per-player-match-counts/runtime*.json and runtime.md; these artifacts do not establish integrated preview/commit readiness.

Remaining implementation includes proposal admission/publication/consumption, RoomAssignments lifecycle, local and multiplayer UI wiring, target-aware picks/fill, running edits/history and broader client/release validation. Generated types match the tested foundation schema. Capability activation and full feature rollout are not ready: both capabilities and client access to v2 adoption remain disabled. Further SQL changes must use a new migration because the deployed foundation is immutable. Unchecked tasks in tasks.md retain ownership; E2E and Android tasks are explicitly deferred, not passed.
