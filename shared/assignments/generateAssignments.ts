import type {
  AssignmentInput,
  AssignmentOptimizationResult,
  AssignmentOptimizer,
  AssignmentQuality,
  AssignmentResult,
  AssignmentSets,
} from "./types.ts";

const GENERATION_TIME_LIMIT_MS = 1500;
const ASSESSMENT_TIME_LIMIT_MS = 50;
const MAX_ASSESSMENT_COMPARISONS = 50000;
const OPTIMIZER_RETURN_RESERVE_MS = 100;
const MAX_ASSIGNMENT_ROWS = 10000;
const MAX_ASSIGNMENT_INPUT_BYTES = 8 * 1024 * 1024;

interface AssignmentGenerationDependencies {
  random?: () => number;
  now?: () => number;
  optimizer?: AssignmentOptimizer;
}

function throwAssignmentError(code: string): never {
  throw new Error(code);
}

async function optimizeWithinDeadline(
  optimizer: AssignmentOptimizer,
  input: AssignmentInput,
  generationDeadlineMs: number,
  now: () => number,
): Promise<AssignmentOptimizationResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      optimizer.optimize(input, generationDeadlineMs - now()),
      new Promise<AssignmentOptimizationResult>((resolve) => {
        timeoutId = setTimeout(() => resolve({
          assignments: null,
          optimal: false,
          reason: "time_limit",
          solverVersion: "",
        }), Math.max(0, generationDeadlineMs - now()));
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/** Counts are hard constraints; sharing only chooses between valid allocations. */
export async function generateAssignments(
  input: AssignmentInput,
  dependencies: AssignmentGenerationDependencies = {},
): Promise<AssignmentResult> {
  const now = dependencies.now ?? (() => performance.now());
  const generationDeadlineMs = now() + GENERATION_TIME_LIMIT_MS;
  const random = dependencies.random ?? Math.random;
  const { participants, pool, commonMatchId, sharing, policy } = input;
  if (
    !participants.length ||
    participants.some(({ id }) => !id || id === "__proto__") ||
    new Set(participants.map(({ id }) => id)).size !== participants.length
  ) {
    throwAssignmentError("invalid_participants");
  }
  if (!commonMatchId || pool.includes(commonMatchId) || pool.some((id) => !id) || new Set(pool).size !== pool.length) {
    throwAssignmentError("invalid_pool");
  }
  if (participants.some(({ target }) => !Number.isInteger(target) || target < 0 || target > 100)) {
    throwAssignmentError("invalid_target");
  }
  if (!Number.isInteger(sharing) || sharing < 0 || sharing > 100) {
    throwAssignmentError("invalid_sharing");
  }
  const totalAssignments = participants.reduce((sum, player) => sum + player.target, 0);
  if (totalAssignments > MAX_ASSIGNMENT_ROWS || new TextEncoder().encode(JSON.stringify(input)).length > MAX_ASSIGNMENT_INPUT_BYTES) {
    throwAssignmentError("assignment_capacity_exceeded");
  }
  const maxPlayerTarget = participants.reduce((max, { target }) => Math.max(max, target), 0);
  if (pool.length < maxPlayerTarget) throwAssignmentError("insufficient_matches");
  function createEmptyAssignments(): AssignmentSets {
    return Object.fromEntries(participants.map(({ id }) => [id, []]));
  }
  if (!totalAssignments) {
    return {
      assignments: createEmptyAssignments(),
      quality: {
        quality: "optimal",
        totalDeviation: 0,
        exactPreferenceAchieved: true,
        summaryComplete: true,
        reason: null,
      },
    };
  }
  const hasEqualTargets = participants.every(({ target }) => target === maxPlayerTarget);
  const minimumExactTarget = sharing * (participants.length - 1);
  const requiredExactPoolSize = sharing * participants.length * (participants.length - 1) / 2 + (maxPlayerTarget - minimumExactTarget) * participants.length;
  if (hasEqualTargets && (policy === "exact" || policy === "relaxed")) {
    if (maxPlayerTarget < minimumExactTarget) throwAssignmentError("sharing_minimum");
    if (policy === "exact" && pool.length < requiredExactPoolSize) throwAssignmentError("sharing_capacity");
  }
  const shuffledPool = [...pool];
  for (let i = shuffledPool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
  }
  let poolCursor = 0;
  let assignments = createEmptyAssignments();
  for (const { id, target } of participants) {
    for (let i = 0; i < target; i++) {
      assignments[id].push(shuffledPool[(poolCursor + i) % pool.length]);
    }
    poolCursor += target;
  }
  function assessDeviation(candidateAssignments: AssignmentSets): number | null {
    const assessmentDeadlineMs = Math.min(generationDeadlineMs, now() + ASSESSMENT_TIME_LIMIT_MS);
    const assignedMatchSets = participants.map(({ id }) => new Set(candidateAssignments[id]));
    let comparisonCount = 0;
    let totalDeviation = 0;
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        // Count empty-pair visits too: millions of zero-count pairs are still work.
        if (++comparisonCount > MAX_ASSESSMENT_COMPARISONS || now() >= assessmentDeadlineMs) return null;
        let sharedMatchCount = 0;
        const firstPlayerMatchIds = candidateAssignments[participants[i].id];
        const secondPlayerMatchSet = assignedMatchSets[j];
        for (const id of firstPlayerMatchIds) {
          if (++comparisonCount > MAX_ASSESSMENT_COMPARISONS) return null;
          if (secondPlayerMatchSet.has(id)) sharedMatchCount++;
        }
        totalDeviation += Math.abs(sharedMatchCount - sharing);
      }
    }
    return totalDeviation;
  }
  const eligibleMatchIds = new Set(pool);
  function hasValidAssignments(candidateAssignments: AssignmentSets): boolean {
    if (!candidateAssignments || Object.keys(candidateAssignments).length !== participants.length) return false;
    return participants.every(({ id, target }) =>
      Array.isArray(candidateAssignments[id]) &&
      candidateAssignments[id].length === target &&
      new Set(candidateAssignments[id]).size === target &&
      candidateAssignments[id].every((match) => eligibleMatchIds.has(match)));
  }
  let totalDeviation = assessDeviation(assignments);
  function retainBetterAssignments(candidateAssignments: AssignmentSets): void {
    if (now() >= generationDeadlineMs || !hasValidAssignments(candidateAssignments)) return;
    const candidateDeviation = assessDeviation(candidateAssignments);
    if (candidateDeviation !== null && (totalDeviation === null || candidateDeviation < totalDeviation)) {
      assignments = candidateAssignments;
      totalDeviation = candidateDeviation;
    }
  }
  const sharedCoreSize = Math.min(sharing, maxPlayerTarget);
  const requiredCorePoolSize = sharedCoreSize + participants.reduce((sum, { target }) => sum + Math.max(0, target - sharedCoreSize), 0);
  if (!hasEqualTargets && pool.length >= requiredCorePoolSize && now() < generationDeadlineMs) {
    const candidateAssignments = createEmptyAssignments();
    poolCursor = sharedCoreSize;
    for (const { id, target } of participants) {
      candidateAssignments[id] = shuffledPool.slice(0, Math.min(sharedCoreSize, target));
      const privateMatchCount = Math.max(0, target - sharedCoreSize);
      candidateAssignments[id].push(...shuffledPool.slice(poolCursor, poolCursor + privateMatchCount));
      poolCursor += privateMatchCount;
    }
    retainBetterAssignments(candidateAssignments);
  }
  if (
    hasEqualTargets && maxPlayerTarget >= minimumExactTarget && requiredExactPoolSize <= pool.length &&
    participants.length * participants.length <= MAX_ASSESSMENT_COMPARISONS && now() < generationDeadlineMs
  ) {
    const candidateAssignments = createEmptyAssignments();
    poolCursor = 0;
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const pairSharedMatchIds = shuffledPool.slice(poolCursor, poolCursor + sharing);
        candidateAssignments[participants[i].id].push(...pairSharedMatchIds);
        candidateAssignments[participants[j].id].push(...pairSharedMatchIds);
        poolCursor += sharing;
      }
    }
    for (const { id } of participants) {
      const privateMatchCount = maxPlayerTarget - minimumExactTarget;
      candidateAssignments[id].push(...shuffledPool.slice(poolCursor, poolCursor + privateMatchCount));
      poolCursor += privateMatchCount;
    }
    // Pair overlap alone cannot distinguish exclusive pair matches from a shared core.
    assignments = candidateAssignments;
    totalDeviation = assessDeviation(assignments);
  }
  let quality: AssignmentQuality["quality"] = totalDeviation === 0 ? "optimal" : "fallback";
  let reason: AssignmentQuality["reason"] = null;
  let solverVersion: string | undefined;
  if (dependencies.optimizer && totalDeviation !== 0 && now() < generationDeadlineMs - OPTIMIZER_RETURN_RESERVE_MS) {
    try {
      const optimizationResult = await optimizeWithinDeadline(dependencies.optimizer, { ...input, pool: shuffledPool }, generationDeadlineMs, now);
      reason = optimizationResult.reason;
      solverVersion = optimizationResult.solverVersion;
      if (optimizationResult.assignments) {
        if (!hasValidAssignments(optimizationResult.assignments)) {
          reason = "invalid_solver_result";
        } else if (now() < generationDeadlineMs) {
          const candidateDeviation = assessDeviation(optimizationResult.assignments);
          if (candidateDeviation !== null && totalDeviation !== null && candidateDeviation <= totalDeviation) {
            assignments = optimizationResult.assignments;
            totalDeviation = candidateDeviation;
            quality = optimizationResult.optimal || candidateDeviation === 0 ? "optimal" : "best_effort";
          }
        }
      }
    } catch {
      reason = "solver_unavailable";
    }
  }
  if (!hasValidAssignments(assignments)) throwAssignmentError("invalid_assignment_result");
  return {
    assignments,
    quality: {
      quality,
      totalDeviation,
      exactPreferenceAchieved: totalDeviation === null ? null : totalDeviation === 0,
      summaryComplete: totalDeviation !== null,
      reason,
      ...(solverVersion ? { solverVersion } : {}),
    },
  };
}
