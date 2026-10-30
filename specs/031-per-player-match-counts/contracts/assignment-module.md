# Contract: Assignment Module Interfaces

This defines ownership and test seams for the feature. Transport details in [room commands](room-commands.md) stay behind the module interface. No generic workflow framework is required.

## RoomAssignments: owned remote workflow

Place the client module in `features/rooms/roomAssignments.ts`. Bind one instance to the room and purpose (start or running save) inside the existing lobby/editor hooks. Inject a context reader for the latest snapshot/draft and a transport adapter implemented using the existing room client and preview ingress. These are composition dependencies, not options each UI action must assemble.

The UI-facing interface has two operations:

- `preview() -> AssignmentPreview | PreviewIssue`: prepare the current draft and return visible counts, assignments, sharing/quality information, any consent requirement, and an opaque handle.
- `commit(preview, confirmation?) -> RoomSnapshot | CommitIssue`: accept the exact reviewed result. Confirmation can explicitly accept relaxed sharing; it cannot change targets, assignments or the proposal's policy.

The existing hooks supply context and expose these operations. Screen code does not call prepare/publication operations or assemble configuration hashes, tokens, generations, expiry checks, transport selection or replay keys. Do not export helper-by-helper workflow steps for tests. Settings/pick commands remain in their existing ownership; they notify the current snapshot/draft through normal hook state.

### Owned behavior

- Resolve v1/v2 transport compatibility in one place; preserve existing v1 behavior without duplicating version branches in lobby and running editor.
- Capture an immutable draft revision and canonical room fence for each preview. Track the latest revision through the injected context reader; a later revision makes earlier responses/results stale locally.
- Coalesce identical preview requests; keep only the newest pending draft. Follow pending/busy admission delays sequentially, at most two retries per explicit preview action, then return a retryable issue. No perpetual polling or concurrent retries.
- Ignore late responses and preserve the latest draft. Server reservation compare-and-set independently prevents late publication; ignoring a response in the client alone is insufficient.
- Keep the reviewed preview's identity, settings, match references and policy immutable. Hide wire tokens/hashes in the opaque handle. Expose expiry and consent as useful UI states, not a protocol the screen must implement.
- Require explicit confirmation for `relaxed`, bound to that exact preview handle. All-zero `common_only` and unequal `preference` need no sharing override.
- Validate that the current local draft still matches before a new commit attempt. A rejected/expired/stale preview keeps the draft reviewable.
- Own commit replay identity. Once a commit's outcome is unknown, retry its frozen request/key to discover the accepted result before applying local expiry/draft checks; never silently construct a new command. Explicit pending/no-write results retain identity for bounded retries. Server authority and current-host authorization still apply.
- If host ownership changed after an unknown outcome, return the authority error and reconcile via the current canonical snapshot; do not bypass current-host authorization to retrieve an earlier result. A successor starts a new command identity rather than replaying the former host's key.
- Route automatic commit through the trusted stored proposal. Manual host allocations and player picks retain target-aware canonical filling/validation; their preview is a selection summary with pending-fill labels, not a promise of frozen future random fill. They do not require a solver or new persistent proposal.

The module returns domain issues such as `busy`, `stale`, `expired`, `confirmation_required`, or `unavailable`. Its adapter maps wire error codes and pending envelopes. Screens own presentation and explicit consent; they do not reconstruct transport error semantics.

## Assignment generation: in-process module

The portable `shared/assignments/` module presents one operation: `generateAssignments(input, dependencies) -> AssignmentResult`. Inputs are participant identities/targets, eligible pool/Common Match, and the effective sharing policy. Dependencies are randomness and, for hosted preference optimization, the injected server optimizer adapter. Keep target resolution, cheap constructions, bounded fallback, discrete validation and bounded quality assessment inside the module implementation.

The hosted optimizer adapter uses HiGHS; offline generation omits it and uses the portable fallback. Local callers and the server orchestrator do not choose fallback branches or compare individual candidates themselves. WASM/model encoding remains inside the server adapter. In-process computation needs no transport wrapper.

## Test surface and dependency categories

- **In-process**: generation is exercised through `generateAssignments`. Tiny exhaustive comparisons and quota/membership/quality invariants belong at this seam. Internal helpers remain private; do not add a separate mirrored test suite for every extraction.
- **Remote but owned**: RoomAssignments uses a production transport adapter and a deterministic in-memory adapter implementing the same interface. Exercise preview ordering, late publication responses, consent, expiry, pending states and lost-response replay through RoomAssignments. Use local database integration coverage for the real authorization/atomicity seam.
- **Local-substitutable**: database command behavior is exercised against the local Postgres stack and pgTAP, preserving room locks, replay and history invariants. An in-memory adapter is not proof of database security.
- **Solver dependency**: use HiGHS in runtime/integration checks; deterministic optimizer adapters exercise timeout/invalid-result paths through the generation interface. Do not expose LP internals to UI callers or require tests of ordinary assignment behavior to construct LP rows.

Replace redundant tests that pin the old scalar formulas or shallow transport choreography once equivalent coverage exists at these module interfaces. Retain meaningful regression, UI-journey and database tests; deeper tests do not justify removing authorization or history coverage.

## Required interface-level examples

The same observable examples apply to production and in-memory transport adapters: relaxed sharing cannot commit without consent to that preview; a late A response cannot invalidate reviewed B; identical in-flight preview requests do not multiply solves; a changed draft cannot commit an old preview; an accepted commit can be retried after a lost response using the original identity; all-zero local/hosted v2 targets remain Common-Match-only. Performance checks include the entire generation operation, not only the solver call.

## Implementation binding

V2 lifecycle ownership is implemented by roomAssignments.ts, with the production SDK adapter in roomAssignmentTransport.ts and React binding in useAssignmentPreview.ts. Manual/picked preparation is a local selection summary; automatic preparation calls authenticated Edge ingress. Legacy rooms retain their existing hook transport paths and behavior until explicit adoption. `invalid_configuration` additionally distinguishes known, rejected business input from an unknown network outcome.
