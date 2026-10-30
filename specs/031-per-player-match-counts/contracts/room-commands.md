# Contract: Room Commands and Proposals

The interfaces below are implemented. See [implementation evidence](../implementation.md) for deployment and validation limits. Existing v1 RPC signatures and Java compatibility routes remain available for v1 games. V2 target mutation and automatic commit use explicit new contracts, preventing old payloads from discarding overrides.

These are internal transport contracts. The lobby and running editor use the [RoomAssignments module interface](assignment-module.md), rather than coordinating these operations themselves. The module owns tokens, preview reservations, expiry, transport selection, replay keys and stale responses.

## Snapshot additions

Add to host/member and guest snapshot schemas:

- `assignmentPolicyVersion: 1 | 2` (missing means legacy 1).
- `capabilities.perPlayerMatchCounts: boolean` and `capabilities.assignmentPreview: boolean`; absence means unsupported, not permission to fall back to unsafe scalar writes.
- Participant fields `additionalMatchCount: number | null` and `resolvedAdditionalMatchCount: number`; project them on both full and active rosters.
- `assignmentPlan.targetsByParticipantId`, derived `sharingPolicy: exact | preference | common_only`, and authoritative count feasibility. A particular preview may be `relaxed` with explicit consent required. Existing scalar fields remain for compatibility/default metadata.
- A `configurationToken` in lobby as well as running snapshots, computed from the canonical assignment inputs. It includes policy, active eligibility, roster, pool/Common Match, mode, defaults/overrides, and draft selections; volatile presence timestamps that do not alter eligibility must not invalidate previews.

Client schemas accept missing additive fields for v1. In v2 they must not invent per-player targets from a scalar if the server projection is incomplete; refresh and show an actionable compatibility error.

## Atomic lobby target settings

`set_room_assignment_configuration_v2(session_id, configuration, expected_token, idempotency_key)`

Configuration contains policy2, group `matchesPerPlayer`, `sharedMatchesPerPair`, and full `playerMatchCounts` override map (participant UUID keys; absent key follows default). Adopt v2 only through this explicit host command or upgraded room creation. An empty map explicitly clears all overrides; omitted map is invalid for this full-replacement v2 contract.

Validate host identity, joinable state, supported counts, active participant ownership of every override key, current fence, and existing picks/allocations against all new resolved targets. Updating the default may reduce multiple targets, so validate all before writing anything. Changes do not auto-trim or regenerate selections. Return the canonical snapshot. Reject lower positive strict equal automatic counts or surface invalid strict feasibility after a roster change; never raise a target silently. For v2 all-zero targets, use `common_only`: sharing is inapplicable, the sharing minimum is bypassed, and the stored sharing preference is retained for later nonzero configurations.

Use existing room lock/event/replay mechanisms. Replay key binds actor, command and canonical request fingerprint including expected token; a changed body with the same key fails. A successful replay returns its stored response before checking the now-old token.

## Hosted preview

`POST /functions/v1/room-assignment-preview`

Headers: registered host's user bearer token and normal project public API key. Verify actual user JWT/claims using existing trusted authentication, not a caller-supplied account ID or editable user metadata. Reject guests/nonhosts before model building. Configure gateway verification consistently with the project's signing-key setup and verify auth inside the handler; never treat a publishable API key as host authorization.

Body:

- `sessionId`
- `purpose: start | running_save`
- `expectedToken`
- `configuration`: complete proposed v2 configuration. For start, saved canonical settings must match; for running_save, includes mode, counts, overrides, existing assignment draft and new-match descriptors/client IDs.

SQL derives the proposal's immutable `sharingPolicy`: `common_only` for all-zero v2 targets; `preference` for unequal targets; `exact` for satisfiable positive equal targets; or `relaxed` when positive equal targets meet the count minimum and distinct-count requirement but the pool cannot satisfy strict sharing. A `relaxed` preview explicitly shows the departure from the configured sharing rule and `requiresSharingConsent: true`. Preparing it changes no game configuration and does not constitute consent. A below-minimum positive equal target remains a settings error, not a reason to raise counts or silently relax them.

No arbitrary LP text, executable expressions, solver options, runtime limits, quality flags, or actor identity are accepted from the client. Runtime/model budgets are server-owned constants.

Process:

1. Call host-scoped `prepare_room_assignment_preview` with the caller JWT. SQL validates purpose/state/draft and, under a short room lock, reserves a private proposal ID before any solve. It returns canonical inputs, verified actor, base token, normalized configuration hash, derived sharing policy and reservation identity. It changes only private preview metadata, never game configuration, matches or assignments.
2. Generate the candidate outside a database transaction and validate it independently; apply the bounded failure policy in the optimization contract.
3. Call `store_room_assignment_proposal` through a service-role-only wrapper. Authenticated/anon roles have no execute grant. The wrapper validates the verified actor remains owner, the room is current, draft/configuration hash is valid, and every discrete assignment meets quotas. Publish with a compare-and-set against that reservation ID: it must still be current, preparing, and within its lease. A superseded or expired solve cannot publish or invalidate a newer preview. Server credentials never reach clients.
4. Return `proposalId`, `expectedToken`, `configurationHash`, `expiresAt`, actual assignment preview, resolved targets, immutable sharing policy/consent requirement and bounded overlap summary. The client module wraps transport identity in an opaque preview handle. Do not return internal model or credentials.

For each `(session_id, actor_account_id, purpose)`, only one unexpired preparing reservation is admitted. Its solve lease is 10 seconds. Identical ready input reuses the same proposal; identical preparing input returns `preview_pending` and does not solve twice. Different input while the lease is active returns `preview_busy`. The module retains only the latest pending draft and retries after the supplied delay; it never starts parallel retries. New reservations are admitted at most once per 2 seconds for that key; a short lock serializes admission, with no lock held while solving. Once a lease expires, or the prior result is ready, a newly admitted reservation supersedes the old identity before solving. Late completion of the old request cannot replace the new result. Commit and reservation admission take the same room lock, so either commit wins first or supersession wins first.

Preview on explicit action/step entry after pending settings writes settle, never on polling or every +/- tap. The module discards responses for an earlier local draft revision even if they were valid when requested. Errors retain the draft and never change canonical assignments. Admission/pending responses include `retryAfterSeconds`; the module retries at most twice per explicit preview action, then returns a retryable busy state without background polling.

Start-time or running-save preview is needed only for automatic v2 generation. Host-assigned and player-picked starts use count-aware canonical SQL filling and do not invoke HiGHS.

## Start and running commit

`start_game_session_v2(session_id, proposal_id, expected_token, idempotency_key, accept_relaxed_sharing)`

- Host JWT required. For automatic v2, a trusted current `start` proposal is mandatory; client assignment arrays cannot substitute for it.
- For host-assigned/player-picked starts, `proposal_id` is null and canonical target-aware validation/filling applies. Their module preview is a selection summary with pending-fill labels, not a frozen automatic proposal.
- A `relaxed` proposal requires explicit `accept_relaxed_sharing = true` for that exact reviewed proposal. The confirmation is included in the commit fingerprint and recorded in history. Missing consent rejects the commit without mutation. Other proposal policies require no consent; the flag cannot turn an exact/preference proposal into a different policy. The stored policy, assignments and consent requirement are covered by proposal identity/configuration hash and cannot change at commit. V1's existing relaxation flag remains internal to its compatibility adapter.
- Lock session, authorize current host, find matching replay, check state/current token/proposal actor/purpose/configuration/expiry, then drain provider cutoff and preserve existing validation/capacity safeguards.
- Commit the reviewed proposal's actual assignments, start event, history metadata and replay response atomically. Do not rerun the optimizer or relabel matches during commit.
- If host/member/guest picks changed after preview, reject conflict before accepting anything.
- Keep the current pending envelope for unfinished catalog processing. A retry uses the same proposal/replay key; a pending attempt must not consume the proposal or write a successful replay result.

`save_running_game_configuration_v2(session_id, configuration, proposal_id, expected_token, idempotency_key, accept_relaxed_sharing)`

- Retain existing running-editor mode support (automatic or host_assigned), fixed existing matches/Common Match, provider validation and new-match client-ID mapping, 100-new-match and 10,000-assignment caps.
- Automatic mode consumes a matching `running_save` proposal. Host-assigned mode validates exact per-player draft counts directly and needs no solver proposal.
- Automatic equal-count relaxation uses the same preview-bound explicit confirmation rule as start; running save cannot silently approve a relaxed proposal. For direct host-assigned saves the consent flag is false.
- Validate new-match descriptors in prepare and again in commit. Resolve insertion/deduplication under lock, map proposal references, then recheck exact quotas/membership before writing. Failure rolls back inserts and assignments together.
- Persist policy/defaults/overrides plus assignments and old/new settings in the existing replacement event. Historical scores, drinks and departed-player records remain unchanged.

The upgraded client calls these Supabase RPCs directly for v2; Java's existing start-game forwarding remains a v1 compatibility path. Guard old scalar start/save paths from mutating v2 games (`assignment_policy_upgrade_required`). Do not create a duplicate Java optimization endpoint. Existing member/guest own-pick routes remain safe after their caps become target-aware.

## Error semantics

| Code / category | Meaning and recovery |
| --- | --- |
| Existing authentication/not_host/forbidden errors | No mutation; normal sign-in/host authority recovery |
| `invalid_assignment_settings` | Invalid type/bounds or unsupported participant override; keep draft |
| `target_below_existing_selections` | Identify affected player(s); release excess picks/allocations first |
| `configuration_conflict` | Room inputs changed; retain draft and request a fresh reviewed preview |
| `preview_pending`, `preview_busy` | Reservation is already preparing or admission cooldown applies; module follows bounded retry delay without another concurrent solve |
| `assignment_proposal_superseded` | An old reservation/result is no longer current; ignore the old result and keep the newest draft |
| `sharing_confirmation_required` | This particular relaxed preview needs explicit host acceptance; no write or rerandomization |
| `assignment_capacity_exceeded` | Input/output size exceeds the supported request budget; distinct-count feasibility is not being denied |
| `assignment_proposal_expired` | Re-preview; no automatic regeneration during commit |
| `invalid_assignment_proposal` | Missing/wrong actor/purpose/hash or invalid memberships; never accept client substitution |
| `assignment_policy_upgrade_required` | Old writer cannot safely change this game; update client |
| Existing `insufficient_match_pool` | Hard target cannot fit distinct additional pool; adjust pool/counts |
| Existing strict-overlap shortfall | Equal-target policy retains explicit relaxation; counts remain exact |
| Existing idempotency conflict | Same key reused with changed request; new user action requires a new key |
| Existing `room_processing_pending` | No partial acceptance; retain request identity and follow bounded existing retry behavior |

A solver timeout/model limit is a preview quality reason, not `insufficient_match_pool`. An unavailable whole Edge endpoint is a retryable transport error; the client must not bypass authority by submitting its own shared assignments.

## Deployment and security invariants

Server-side capability added before UI activation. Private proposal table and service wrapper grants must be explicitly tested as anon, authenticated nonhost, host, service-role and guest ingress. Existing participant RLS and guest revocation/active-roster behavior stay intact. Expired/current proposal storage is not durable replay history. A host handover invalidates old actor proposals. Accepted command replay must continue after proposal expiry/pruning.

Replay remains subject to current-host authorization and its original actor identity. If ownership has changed, the prior host receives `not_host` even for an old accepted key; the successor cannot replay another actor's command and instead reads the canonical snapshot, using a fresh key for any new change. Preserving accepted replay after expiry never grants former hosts continuing write/result access. This ordering is shared by start and running-save commands.
