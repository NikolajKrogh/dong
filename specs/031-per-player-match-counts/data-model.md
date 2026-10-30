# Data Model: Per-Player Match Counts

## 1. Versioned game configuration

Extend `public.game_sessions` with `assignment_policy_version smallint NOT NULL DEFAULT 1`, constrained to supported values 1 and 2. Existing `matches_per_player` and `shared_matches_per_pair` remain the group defaults. New clients explicitly create/adopt policy 2; default 1 keeps old callers and existing sessions compatible. Policy adoption is an authorized, auditable configuration mutation, not a schema backfill.

- Policy 1: no overrides; preserve existing scalar behavior and already-settled assignments.
- Policy 2: each player's resolved count is exact. Automatic unequal targets use a sharing preference; equal targets use exact sharing with existing explicit relaxation. Do not silently raise resolved counts.
- Policy 2 all-zero targets are an explicit `common_only` exception, on web and Android including offline local games. Sharing minimum/consent is inapplicable; stored sharing preference is not reset. Positive equal targets resume strict sharing rules when counts change.
- Policy 2 cannot be downgraded by an old payload. Recovery keeps its readers/writers available until games complete.
- New/edited v2 default and sharing values: integer 0..100. Legacy out-of-range settings remain readable; adoption requires the host to choose supported values.

## 2. Participant target

Add nullable `public.participants.additional_match_count integer`, with null or 0..100 constraint. It is session-scoped and belongs to the participant's stable UUID, never display name or account preference.

`resolvedAdditionalMatchCount = additional_match_count ?? game_sessions.matches_per_player`.

Zero is a real override. Null follows the default. Clearing an override changes it to null; changing a default does not overwrite nonnull overrides. Departures keep their historical participant/snapshot record. New participants start null. Existing participant FK/session index and RLS ownership remain sufficient; no new index is needed for a scalar column read with the room roster.

Only host-authorized validated commands write targets. Member/guest identity and own-pick authorization remain unchanged. A target or default decrease below a current lobby selection fails atomically with the affected participant identified; it does not trim picks.

## 3. Local persisted state

Extend `store/gameStore.ts` active state and `GameSession` snapshots with:

| Field | Meaning |
| --- | --- |
| `assignmentPolicyVersion` | 1 for hydrated legacy state; 2 for newly configured/adopted games |
| `playerMatchCounts: Record<string, number>` | Sparse explicit overrides; absent key follows `matchesPerPlayer` |
| Existing `matchesPerPlayer` | Group default, retained for compatibility |

Hydrate missing maps as `{}` and missing policy as 1 without touching assignments. Reset creates a clean v2 game and empty overrides; removing a player prunes their active override, never historical records. Save-to-history copies the settings and actual assignments. Shared snapshots hydrate target fields through `roomSnapshotAdapter.ts`, with legacy fallback only when fields are absent. Canonical shared settings must not leak into a separate solo game during context transitions.

Use the existing Zustand persistence mechanism and a narrow merge/migration if necessary; do not clear `dong-storage` or rewrite the entire history. Running editing in this feature extends the existing multiplayer editor; it does not add a new local running-edit flow or sync system.

## 4. Trusted assignment proposal

New table `private.assignment_proposals`:

| Field | Type / invariant |
| --- | --- |
| `id` | UUID primary key, unguessable reference |
| `session_id` | FK to game session, cascade on session deletion |
| `actor_account_id` | Verified current host account that requested the proposal |
| `purpose` | `start` or `running_save` |
| `state`, `is_current` | Preparing, ready, consumed or invalidated; at most one current row per actor/room/purpose |
| `lease_expires_at` | Preparing reservation may publish for 10 seconds; never a lock held during solve |
| `base_configuration_token` | Canonical room fence captured before solving |
| `configuration_hash` | Hash of normalized settings/targets/mode/pool references/new-match draft, policy version, derived sharing policy and consent requirement |
| `configuration` | Validated normalized draft JSON; no executable code or credentials |
| `sharing_policy`, `requires_sharing_consent` | Immutable exact/preference/relaxed/common_only policy; only relaxed requires explicit host consent |
| `assignments` | Actual proposed participant/match references, each pair distinct; Common Match represented consistently with canonical storage |
| `quality` | Server-derived optimal/best_effort/fallback and actual deviation summary, with solver version |
| `created_at`, `ready_at`, `expires_at` | Server times; ready proposal expires 5 minutes after publication; unfinished reservation expires with its lease |
| `consumed_at` | Nullable; successful commit also stores replay result in the existing command-results mechanism |

Preparing rows have no assignment result or quality yet. Only current ready rows with complete validated assignments can commit; consumed/invalidated rows cannot publish. Effective policy and consent requirement are fixed during preparation, and results become immutable on publication. State/field consistency is enforced by constraints and command validation.

Index `(session_id, actor_account_id, created_at)` supports reusing/limiting current host previews; index `expires_at` supports bounded cleanup. A partial unique index on `(session_id, actor_account_id, purpose)` where `is_current` enforces one current reservation/result. Table stays outside exposed schemas, RLS enabled as defense in depth, no anon/authenticated direct grants. Host-authorized prepare reserves preview metadata; only the service-role-only publication wrapper may write assignment results/quality after validating actor/current token. Clients cannot supply trusted rows or quality flags.

Reserve the proposal UUID under a short room lock before solving. Identical ready input reuses it; identical preparing input returns pending; different input during its unexpired lease returns busy. Admit new reservations at most once per 2 seconds for the same key. Keep only the latest queued local draft in the client module, with at most two delayed retries per explicit preview action. After lease expiry or ready completion, a newly admitted reservation atomically invalidates the prior current identity. Publication updates only its own current/preparing/unexpired reserved UUID; late A cannot replace B. Commit and admission serialize through the same room lock. No network call or solve runs under that lock.

Expired proposals never commit. Cleanup runs opportunistically on reservation admission and existing session deletion, avoiding new Cron infrastructure. Retain enough recent admission metadata for the 2-second cooldown and exclude live leases from cleanup. No reservation is created on room polling. A ready result contains the immutable effective sharing policy; consent is recorded with the accepted command/event, not assumed during preview preparation.

A successful replay uses existing persisted command results, not the continued existence/expiry of this row. Do not delete replay evidence when pruning proposals.

## 5. Snapshot projections

Add a capability/`assignmentPolicyVersion` field and nullable override/resolved target to participant projections for host/member and guest snapshots, including active roster. Extend `AssignmentPlan` with a per-participant target map, derived `sharingPolicy` (`exact`, `preference` or `common_only`), and count-feasibility/preview availability. A particular proposal may additionally be `relaxed` and require consent. Retain scalar fields as legacy/default metadata, never use them as v2 individual caps.

Do not attach a full solver model or proposal body to every snapshot poll. A preview response carries actual assignments and overlap summary; accepted assignments remain in the canonical snapshot. If preview summaries are projected, expose only current authorized metadata, never private actor tokens or internal debug data.

## 6. Events and history

Extend existing assignment-replacement/configuration event payloads with policy version, group defaults, before/after override and resolved-target maps, proposal ID, actual assignments, and result quality when applicable. Reuse current immutable gameplay/event sequence allocation and command replay infrastructure.

History and departure snapshots preserve actual assignments and the settings known at that time. Existing history without target metadata stays valid; show actual per-player additional counts derived from distinct assignments excluding Common Match. Never backfill a target from a rollup's average `matches_per_player`. Keep existing security-invoker completed-history views and frozen catalog team/kickoff metadata.

## 7. Lifecycle and concurrency

1. Create/adopt v2 configuration: validate host, state, token, counts and existing selections; commit atomically.
2. Prepare preview: validate/admit and reserve the current private request identity, read canonical inputs/fence, derive sharing/consent policy; no game settings/assignments changed.
3. Solve: outside database lock; bounded execution and independent integer validation.
4. Publish proposal: trusted server path rechecks actor/current fence and compares the reserved current identity/lease; stale or superseded work cannot publish.
5. Commit: host JWT, room lock, replay lookup, current state/fence/configuration/proposal validation including exact relaxed-proposal consent, catalog drain/capacity, optional new-match insertion and reference resolution, exact quotas and assignments revalidation, settings/assignment/event/replay write in one transaction. Consent participates in request fingerprint and accepted history.
6. Retry: return accepted replay before stale/expiry validation; reused key with different payload fails.
7. Handover/roster/pool/picks/mode/default/override changes: fence changes; old preview cannot commit. Old owner is forbidden even if their old proposal remains.
8. Complete/depart: existing immutable history capture includes targets; no retroactive drink/score changes.

The fence must cover all assignment-relevant fields, including active guest eligibility and picks. Drain provider updates using the latest protected SQL paths; a pending drain returns the existing pending result without partially accepting a configuration.

## 8. Migration and recovery

Create a new CLI-generated migration; do not edit historical migration files. Add nullable/defaulted columns and private proposal objects, update latest function bodies/wrappers and projections, and regenerate database types. Existing rows stay v1/null; there is no assignment/event backfill. Exercise fresh reset and upgrade paths with populated legacy fixtures.

Server-first additive deployment, then Edge, then capability-gated clients. On rollback, stop adoption/new previews but retain schema, target-aware v2 commit/read support, accepted assignments and replay/events. Do not drop columns or route adopted games through the old equal-count writer.
