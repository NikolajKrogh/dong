export type SharingPolicy = "exact" | "preference" | "relaxed" | "common_only";
export type AssignmentSets = Record<string, string[]>;

export interface AssignmentInput {
  participants: { id: string; target: number }[];
  pool: string[];
  commonMatchId: string;
  sharing: number;
  policy: SharingPolicy;
}

export interface AssignmentQuality {
  quality: "optimal" | "best_effort" | "fallback";
  totalDeviation: number | null;
  exactPreferenceAchieved: boolean | null;
  summaryComplete: boolean;
  reason: null | "time_limit" | "model_limit" | "solver_unavailable" | "invalid_solver_result";
  solverVersion?: string;
}

export interface AssignmentResult {
  assignments: AssignmentSets;
  quality: AssignmentQuality;
}

export interface AssignmentOptimizationResult {
  assignments: AssignmentSets | null;
  optimal: boolean;
  reason: AssignmentQuality["reason"];
  solverVersion: string;
}

export interface AssignmentOptimizer {
  optimize(input: AssignmentInput, millisecondsRemaining: number): Promise<AssignmentOptimizationResult>;
}
