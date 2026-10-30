# Contract: Assignment Optimization

## Domain inputs and invariants

Input consists of stable active participant IDs, resolved additional-match targets, selected eligible pool references, Common Match reference, sharing preference K, policy version, and a base configuration identity. Counts are integers 0..100 for v2 input. Pool and participant references must be distinct. Common Match is outside every additional count and pair overlap.

Count feasibility for unequal automatic allocation is `M >= max(targets)`, where M is the distinct additional pool size. Overlap preferences do not change this hard condition. A zero-target player receives no additional match. Empty active roster and missing/invalid Common Match retain existing validation failures.

For v2 all-zero targets, effective policy is `common_only`, including offline local games with stored preference 1. No positive sharing minimum, consent or optimizer is applicable. Keep the stored preference unchanged for later nonzero targets. Positive equal targets keep strict sharing and preview-bound explicit relaxation; legacy v1 behavior is unchanged.

No optimizer output is accepted merely because it reports success. Decode only finite near-integer values, verify tolerance before rounding, and independently check all resulting discrete assignments, individual quotas, selected-pool references, duplicates, and overlap metrics. Postgres repeats discrete invariants at the trust boundary. Never round a materially fractional solution into an assignment.

## Hosted HiGHS model

Use server-only `highs` 1.15.4 initially, with pinned package/WASM bytes loaded from bundled assets. No dynamic CDN or native/React Native import. Re-evaluate pin only through an explicit tested dependency change. A local Edge packaging/CPU/memory spike is required before mutation integration.

Use anonymous match slots `s = 1..S`, with `S = min(M, sum(targets))`. Assign actual pool identifiers randomly after a membership solution is chosen, before storing the proposal. This removes irrelevant unused pool labels without excluding a feasible membership assignment.

Variables and constraints:

- Binary `x[i,s]`: participant i holds slot s. Enforce `sum_s x[i,s] = target[i]` exactly.
- `y[i,j,s]` is the AND of `x[i,s]` and `x[j,s]`, via `y <= x[i,s]`, `y <= x[j,s]`, `y >= x[i,s] + x[j,s] - 1`, and bounds 0..1. With binary x, y can be continuous and is forced to 0 or 1.
- Actual pair overlap `o[i,j] = sum_s y[i,j,s]`.
- Nonnegative shortfall/excess `dMinus[i,j]`, `dPlus[i,j]`, with `o + dMinus - dPlus = K`.
- Minimize `sum_pairs(dMinus + dPlus)`. Mandatory counts are constraints, never a soft penalty. Do not reward extra overlap beyond K.

The exact model size is computed before allocation: `N*S` binary variables, `choose(N,2)*S` AND variables, and two deviation variables per pair; roughly three AND rows per pair/slot plus quotas and pair equations. This is polynomial, unlike prototype subset enumeration. Drop fixed-zero player variables and account for their constant overlap deficit analytically.

Do not add preference-shifting random weights to the primary objective. Randomize actual match labels and tie ordering after/before a solve in a way that preserves objective priority. Different games may vary; an accepted stored preview never changes on start/retry.

## Bounds and result quality

Initial upper budgets: 0.75-second solve time, 20,000 binary variables, 30,000 constraint rows, and 8 MiB serialized model input. Also validate estimated total variable/sparse-matrix memory before loading. The local Edge spike must verify cold/warm total CPU below 2 seconds and peak memory below 256 MB, and reduce budgets if needed. Do not substitute a 150-second wall-clock allowance for the CPU limit. Oversized inputs use the constructive fallback; no new user-facing roster cap is introduced.

The entire assignment module, including candidate construction, validation and overlap assessment, has an initial 1.5-second computation deadline; HiGHS does not get a fresh budget after earlier work. Build the linear-work fallback first and reserve time to return it. Basic input/output admission is distinct from solver-model admission: v2 inputs are at most 8 MiB and generated additional assignment rows at most 10,000, extending the editor's existing assignment limit to generated v2 results. Reject an oversized request as `assignment_capacity_exceeded`, never as insufficient distinct matches. No fixed player-count cap is introduced.

Result shape (domain-level, not an additional public service):

- `assignments`: exact distinct participant/match sets.
- `quality`: `optimal`, `best_effort`, or `fallback`.
- `totalDeviation`: independently recomputed sum of absolute pair differences from K, or null if full assessment exceeds its budget.
- `exactPreferenceAchieved`: true only when assessed deviation is zero; null when full assessment is incomplete.
- `summaryComplete`: whether all pairs were assessed; incomplete assessment is visibly labeled, never reported as zero deviation.
- `reason`: null, `time_limit`, `model_limit`, `solver_unavailable`, or `invalid_solver_result`.
- `solverVersion`: server provenance, omitted for a purely constructive result.

`optimal` is used only for a validated optimal solver result or a construction with a proven objective lower bound. A validated incumbent at a time limit is `best_effort`. With no valid incumbent, use `fallback`. Timeout, numerical failure, or model limits are never proof of count infeasibility. A supposedly infeasible soft-sharing model with M >= max(targets) indicates a modeling/runtime problem and uses fallback plus diagnostics.

Full pair-quality assessment stops after 50,000 set-membership comparisons or 50 ms, whichever comes first, and also respects the overall computation deadline. If the candidate comparison or independent objective validation cannot complete, retain the fallback and do not claim optimality. Actual pair overlaps remain available on demand from the accepted preview sets: one pair needs at most 100 membership comparisons because v2 targets are bounded. No full pair matrix is required in an oversized-room response. Common-only has known zero applicable sharing deviation without pair enumeration.

## Portable fallback and incumbent selection

Place target resolution, overlap calculations, discrete validation and constructive fallback in `shared/assignments/`. It imports no platform APIs, SDK, WASM, or solver. Reuse the injectable randomness pattern of the current local generator.

1. Validate hard count feasibility and request-size/output admission. All-zero v2 returns empty additional sets immediately.
2. Build a count-only baseline in O(N + M + A), where A is the total additional assignments. Shuffle pool labels once. Give each participant their target number of consecutive slots in cyclic pool order and advance the cursor; because each target is at most M, a participant never receives a duplicate. This produces disjoint sets when M >= A and completes without evaluating all pairs.
3. Use cheap sharing constructions when their precomputed size fits: existing exact pair blocks, or a common core of C = min(K, max(targets)) slots, each player taking min(C, target) core slots plus distinct private extras. Core construction needs C + sum(max(0, target-C)) pool slots and linear work in input/output size. Pair-block construction is admitted only when its pair work also fits the assessment/deadline budget.
4. The core construction gives 3/3/1 K2 with four additional matches overlap 2/1/1, and 2/2/1 K1 with three additional matches exact overlap1. Retain these cheap candidates so a solver timeout cannot lose the required 3/3/1 result. There is no quota-filling pair-scoring loop or iterative improvement search in the fallback.
5. Validate quotas, membership and distinctness in O(N + M + A). Compare a solver incumbent only when full independent quality assessment fits its budget; never replace a better fallback with a worse solver result. If assessment is incomplete, return the fallback with `summaryComplete: false` and no optimality claim.

Offline local games use this fallback and show sharing as best effort. All-zero v2 games use `common_only`; single-player and no-sharing constructions avoid needless solver work. Positive equal-target exact generation remains the compatibility branch, not an incidental side effect of solver heuristics.

Local setup currently has an implicit sharing value of 1; retain that value when calling the fallback. A new local sharing-settings control is not part of this feature. The shared domain returns additional-match sets; adapters preserve each existing boundary's Common Match representation. The legacy local random generator includes the Common Match in its arrays, while room hydration excludes it. Count/validation/history helpers must always exclude it explicitly and must not rewrite legacy arrays just to normalize their shape.

## Preview identity

A reviewed proposal contains actual match references, not a recipe that is rerun later. It is bound to actor, room, purpose, base token, reserved request identity, normalized proposed configuration hash, and derived sharing/consent policy. Replacing settings, roster, eligibility, pool, picks, allocations, or mode invalidates it. A stale preview requires review of a new preview before start/save. Only the current unexpired reservation may publish; an older solve never supersedes a newer reservation.

For running drafts, assignments can refer to `new:<clientId>` before new matches are inserted. Commit maps references using the existing insertion/deduplication path and revalidates exact counts after resolution. No matches are inserted just to preview a draft. A duplicated/merged reference that breaks quotas causes a full rollback/conflict rather than a partial save.

## Required computational cases

Independent checks cover 3/3/1 K2 (larger pair overlap2), 2/2/1 K1 (three-way sharing), K0, all-zero with stored K0 or K1, one participant, insufficient distinct pool, duplicate references, zero-player exclusion, forced extra overlap, invalid/fractional solver vectors, time/model limits, bounded fallback/assessment, and solver load failure. Include late-reservation publication and proposal-bound relaxation consent. Small exhaustive oracles verify the MILP objective/model on tiny inputs; larger randomized cases verify counts/membership/termination rather than claim optimality. Legacy equal-target fixtures retain previous behavior.
