import { generateAssignments } from "../../../../shared/assignments/generateAssignments.ts";
import type { AssignmentQuality } from "../../../../shared/assignments/types.ts";
import { highsOptimizer } from "./highsOptimizer.ts";

const LARGE_MODEL_MIN_PARTICIPANTS = 14;
const PROBE_GENERATION_TIME_LIMIT_MS = 1500;

interface RuntimeProbeResult {
  size: number;
  smokeMs: number;
  generationMs: number;
  elapsedMs: number;
  quality: AssignmentQuality;
  memory: ReturnType<typeof Deno.memoryUsage>;
  solverVersion: string;
}

function countSharedMatches(left: string[], right: string[]): number {
  return left.filter((id) => right.includes(id)).length;
}

/** Run through an actual user worker, with the production CPU/memory limits. */
export async function probeAssignmentRuntime(participantCount = 3): Promise<RuntimeProbeResult> {
  const startedAtMs = performance.now();
  const smokeResult = await highsOptimizer.optimize({
    participants: [{ id: "a", target: 3 }, { id: "b", target: 3 }, { id: "c", target: 1 }],
    pool: ["1", "2", "3", "4"], commonMatchId: "common", sharing: 2, policy: "preference",
  }, PROBE_GENERATION_TIME_LIMIT_MS);
  if (!smokeResult.assignments || !smokeResult.optimal) throw new Error(JSON.stringify(smokeResult));
  const { a: firstPlayerMatches, b: secondPlayerMatches, c: reducedPlayerMatches } = smokeResult.assignments;
  if (
    firstPlayerMatches.length !== 3 || secondPlayerMatches.length !== 3 || reducedPlayerMatches.length !== 1 ||
    countSharedMatches(firstPlayerMatches, secondPlayerMatches) !== 2 ||
    countSharedMatches(firstPlayerMatches, reducedPlayerMatches) + countSharedMatches(secondPlayerMatches, reducedPlayerMatches) !== 2
  ) {
    throw new Error("Unexpected 3/3/1 optimum");
  }
  const smokeMs = performance.now() - startedAtMs;
  const isLargeModel = participantCount >= LARGE_MODEL_MIN_PARTICIPANTS;
  const benchmarkInput = {
    participants: Array.from({ length: participantCount }, (_, i) => ({ id: `p${i}`, target: (isLargeModel ? 98 : 4) + i % 3 })),
    pool: Array.from({ length: isLargeModel ? 100 : 6 }, (_, i) => `m${i}`),
    commonMatchId: "common", sharing: 1, policy: "preference" as const,
  };
  const generationStartedAtMs = performance.now();
  const benchmarkResult = await generateAssignments(benchmarkInput, { optimizer: highsOptimizer, random: () => 0.5 });
  for (const { id, target } of benchmarkInput.participants) {
    const assignedMatchIds = benchmarkResult.assignments[id];
    if (assignedMatchIds.length !== target || new Set(assignedMatchIds).size !== target || assignedMatchIds.some((id) => !benchmarkInput.pool.includes(id))) {
      throw new Error("Invalid benchmark quotas");
    }
  }
  return {
    size: participantCount,
    smokeMs,
    generationMs: performance.now() - generationStartedAtMs,
    elapsedMs: performance.now() - startedAtMs,
    quality: benchmarkResult.quality,
    memory: Deno.memoryUsage(),
    solverVersion: smokeResult.solverVersion,
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(await probeAssignmentRuntime()));
}
