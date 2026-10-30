import highsImport, { type LegacyHighs } from "npm:highs@1.15.4";
import type {
  AssignmentInput,
  AssignmentOptimizationResult,
  AssignmentOptimizer,
  AssignmentSets,
} from "../../../../shared/assignments/types.ts";

const SOLVER_VERSION = "highs@1.15.4";
const MAX_BINARY_VARIABLES = 20000;
const MAX_CONSTRAINTS = 30000;
const MAX_ESTIMATED_MODEL_BYTES = 48 * 1024 * 1024;
const ESTIMATED_BYTES_PER_VARIABLE = 512;
const ESTIMATED_BYTES_PER_CONSTRAINT = 256;
const MAX_MODEL_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_SOLVE_TIME_SECONDS = 0.75;
const RESULT_VALIDATION_RESERVE_MS = 100;
const SOLUTION_INTEGRALITY_TOLERANCE = 1e-6;

// The package ships CommonJS type metadata for its ESM default export.
const loadHighs = highsImport as unknown as (options: {
  instantiateWasm: (imports: WebAssembly.Imports, receive: (wasmInstance: WebAssembly.Instance) => void) => WebAssembly.Exports;
}) => Promise<LegacyHighs>;
let highsRuntimePromise: Promise<LegacyHighs> | undefined;
function getOrLoadRuntime(): Promise<LegacyHighs> {
  highsRuntimePromise ??= initializeRuntime().catch((error) => {
    highsRuntimePromise = undefined;
    throw error;
  });
  return highsRuntimePromise;
}

async function initializeRuntime(): Promise<LegacyHighs> {
  const wasmBinary = await Deno.readFile(new URL("./highs.wasm", import.meta.url));
  const compiledWasmModule = await WebAssembly.compile(wasmBinary);
  // This package build ignores wasmBinary; the hook avoids Node's blocked sync file reads.
  return loadHighs({
    instantiateWasm(imports, receive) {
      const wasmInstance = new WebAssembly.Instance(compiledWasmModule, imports);
      receive(wasmInstance);
      return wasmInstance.exports;
    },
  });
}

function createOptimizationFailure(reason: NonNullable<AssignmentOptimizationResult["reason"]>): AssignmentOptimizationResult {
  return { assignments: null, optimal: false, reason, solverVersion: SOLVER_VERSION };
}

/** Anonymous slots preserve the objective while avoiding unused pool-label symmetry. */
export const highsOptimizer: AssignmentOptimizer = {
  async optimize(input: AssignmentInput, millisecondsRemaining: number): Promise<AssignmentOptimizationResult> {
    const positiveTargetPlayers = input.participants.filter((player) => player.target > 0);
    const slotCount = Math.min(input.pool.length, positiveTargetPlayers.reduce((sum, player) => sum + player.target, 0));
    const pairCount = positiveTargetPlayers.length * (positiveTargetPlayers.length - 1) / 2;
    const constraintCount = positiveTargetPlayers.length + pairCount * (slotCount * 3 + 1);
    const variableCount = positiveTargetPlayers.length * slotCount + pairCount * (slotCount + 2);
    // Sparse rows plus the LP text and native solver must fit alongside the WASM heap.
    if (
      positiveTargetPlayers.length * slotCount > MAX_BINARY_VARIABLES ||
      constraintCount > MAX_CONSTRAINTS ||
      variableCount * ESTIMATED_BYTES_PER_VARIABLE + constraintCount * ESTIMATED_BYTES_PER_CONSTRAINT > MAX_ESTIMATED_MODEL_BYTES
    ) {
      return createOptimizationFailure("model_limit");
    }
    const startedAtMs = performance.now();
    function getMembershipVariableName(playerIndex: number, slotIndex: number): string {
      return `x${playerIndex}_${slotIndex}`;
    }
    const deviationVariables: string[] = [];
    const constraints: string[] = [];
    const bounds: string[] = [];
    const binaryVariables: string[] = [];
    for (let i = 0; i < positiveTargetPlayers.length; i++) {
      const membershipVariables = Array.from({ length: slotCount }, (_, s) => getMembershipVariableName(i, s));
      binaryVariables.push(...membershipVariables);
      constraints.push(`q${i}: ${membershipVariables.join(" + ")} = ${positiveTargetPlayers[i].target}`);
      for (let j = i + 1; j < positiveTargetPlayers.length; j++) {
        const overlapVariables: string[] = [];
        for (let s = 0; s < slotCount; s++) {
          const overlapVariable = `y${i}_${j}_${s}`;
          overlapVariables.push(overlapVariable);
          constraints.push(
            `${overlapVariable} - ${getMembershipVariableName(i, s)} <= 0`,
            `${overlapVariable} - ${getMembershipVariableName(j, s)} <= 0`,
            `${overlapVariable} - ${getMembershipVariableName(i, s)} - ${getMembershipVariableName(j, s)} >= -1`,
          );
          bounds.push(`0 <= ${overlapVariable} <= 1`);
        }
        const shortfallVariable = `m${i}_${j}`;
        const excessVariable = `p${i}_${j}`;
        deviationVariables.push(shortfallVariable, excessVariable);
        constraints.push(`${overlapVariables.join(" + ")} + ${shortfallVariable} - ${excessVariable} = ${input.sharing}`);
      }
    }
    const linearProgram = `Minimize\n obj: ${deviationVariables.join(" + ") || "0"}\nSubject To\n${constraints.join("\n")}\nBounds\n${bounds.join("\n")}\nBinary\n${binaryVariables.join(" ")}\nEnd`;
    if (new TextEncoder().encode(linearProgram).byteLength > MAX_MODEL_INPUT_BYTES) return createOptimizationFailure("model_limit");
    try {
      const highs = await getOrLoadRuntime();
      const solveTimeSeconds = Math.min(MAX_SOLVE_TIME_SECONDS, (millisecondsRemaining - (performance.now() - startedAtMs) - RESULT_VALIDATION_RESERVE_MS) / 1000);
      if (solveTimeSeconds <= 0) return createOptimizationFailure("time_limit");
      const solution = highs.solve(linearProgram, { time_limit: solveTimeSeconds, output_flag: false, threads: 1, parallel: "off" });
      const assignments: AssignmentSets = Object.fromEntries(input.participants.map(({ id }) => [id, []]));
      for (let i = 0; i < positiveTargetPlayers.length; i++) {
        for (let s = 0; s < slotCount; s++) {
          const membershipColumn = solution.Columns?.[getMembershipVariableName(i, s)];
          const membershipValue = membershipColumn && "Primal" in membershipColumn ? membershipColumn.Primal : NaN;
          if (
            typeof membershipValue !== "number" || !Number.isFinite(membershipValue) ||
            Math.abs(membershipValue - Math.round(membershipValue)) > SOLUTION_INTEGRALITY_TOLERANCE ||
            membershipValue < -SOLUTION_INTEGRALITY_TOLERANCE || membershipValue > 1 + SOLUTION_INTEGRALITY_TOLERANCE
          ) {
            return createOptimizationFailure(solution.Status === "Time limit reached" ? "time_limit" : "invalid_solver_result");
          }
          if (Math.round(membershipValue) === 1) assignments[positiveTargetPlayers[i].id].push(input.pool[s]);
        }
      }
      if (positiveTargetPlayers.some(({ id, target }) => assignments[id].length !== target)) return createOptimizationFailure("invalid_solver_result");
      const isOptimal = solution.Status === "Optimal";
      return { assignments, optimal: isOptimal, reason: isOptimal ? null : "time_limit", solverVersion: SOLVER_VERSION };
    } catch (error) {
      console.warn("Assignment optimizer unavailable", error instanceof Error ? error.message : String(error));
      return createOptimizationFailure("solver_unavailable");
    }
  },
};
