import { generateAssignments } from "../../../shared/assignments/generateAssignments";
import type { AssignmentInput, AssignmentOptimizer, AssignmentResult } from "../../../shared/assignments/types";

function input(targets: number[], sharing = 1, poolSize = 10): AssignmentInput {
  let policy: AssignmentInput["policy"] = "preference";
  if (targets.every((target) => target === 0)) {
    policy = "common_only";
  } else if (targets.every((target) => target === targets[0])) {
    policy = "exact";
  }
  return {
    participants: targets.map((target, i) => ({ id: `p${i}`, target })),
    pool: Array.from({ length: poolSize }, (_, i) => `m${i}`),
    commonMatchId: "common", sharing, policy,
  };
}

function overlap(a: string[], b: string[]): number {
  return a.filter((id) => b.includes(id)).length;
}

function generate(value: AssignmentInput, optimizer?: AssignmentOptimizer): Promise<AssignmentResult> {
  return generateAssignments(value, { random: () => 0.5, optimizer });
}

describe("generateAssignments", () => {
  it("keeps the higher-count pair sharing twice in 3/3/1, K2", async () => {
    const { assignments, quality } = await generate(input([3, 3, 1], 2, 4));
    expect(Object.values(assignments).map((a) => a.length)).toEqual([3, 3, 1]);
    expect(overlap(assignments.p0, assignments.p1)).toBe(2);
    expect(quality.totalDeviation).toBe(2);
  });
  it("uses three-way sharing for 2/2/1 K1 with three matches", async () => {
    const { assignments, quality } = await generate(input([2, 2, 1], 1, 3));
    expect(overlap(assignments.p0, assignments.p1)).toBe(1);
    expect(overlap(assignments.p0, assignments.p2)).toBe(1);
    expect(quality.exactPreferenceAchieved).toBe(true);
  });
  it.each([0, 1])("returns common-only for all-zero targets and stored K%s", async (sharing) => {
    const result = await generate(input([0, 0, 0], sharing, 0));
    expect(result.assignments).toEqual({ p0: [], p1: [], p2: [] });
    expect(result.quality.totalDeviation).toBe(0);
  });
  it("constructs exact pair blocks for positive equal targets", async () => {
    const { assignments, quality } = await generate(input([3, 3, 3], 1, 6));
    expect(Object.values(assignments).map((a) => a.length)).toEqual([3, 3, 3]);
    expect(overlap(assignments.p0, assignments.p1)).toBe(1);
    expect(quality.exactPreferenceAchieved).toBe(true);
  });
  it.each([9, 12])("keeps equal-count shared matches exclusive to each pair with a pool of %s", async (poolSize) => {
    const { assignments } = await generate(input([4, 4, 4], 1, poolSize));
    for (const matches of Object.values(assignments)) expect(matches).toHaveLength(4);
    for (const match of new Set(Object.values(assignments).flat())) {
      expect(Object.values(assignments).filter(matches => matches.includes(match)).length).toBeLessThanOrEqual(2);
    }
    expect(overlap(assignments.p0, assignments.p1)).toBe(1);
    expect(overlap(assignments.p0, assignments.p2)).toBe(1);
    expect(overlap(assignments.p1, assignments.p2)).toBe(1);
  });
  it("never raises equal targets to the positive sharing minimum", async () => {
    await expect(generate(input([1, 1, 1], 1))).rejects.toThrow("sharing_minimum");
  });
  it("requires an explicit relaxed policy when strict pool capacity is short", async () => {
    const value = input([3, 3, 3], 1, 3);
    await expect(generate(value)).rejects.toThrow("sharing_capacity");
    const result = await generate({ ...value, policy: "relaxed" });
    expect(Object.values(result.assignments).map((a) => a.length)).toEqual([3, 3, 3]);
  });
  it("prefers disjoint matches at K0 when they fit", async () => {
    const { assignments, quality } = await generate(input([3, 1, 0], 0, 4));
    expect(overlap(assignments.p0, assignments.p1)).toBe(0);
    expect(quality.totalDeviation).toBe(0);
  });
  it("distinguishes insufficient distinct matches from admission capacity", async () => {
    await expect(generate(input([3, 1], 1, 2))).rejects.toThrow("insufficient_matches");
    await expect(generate(input(Array(101).fill(100), 0, 100))).rejects.toThrow("assignment_capacity_exceeded");
  });
  it.each([-1, 1.5, 101, NaN])("rejects invalid target %s", async (target) => {
    await expect(generate(input([target]))).rejects.toThrow("invalid_target");
  });
  it("rejects duplicate identities, pool references and Common Match in the additional pool", async () => {
    const value = input([2, 1]);
    await expect(generate({ ...value, participants: [value.participants[0], value.participants[0]] })).rejects.toThrow("invalid_participants");
    await expect(generate({ ...value, pool: ["m0", "m0"] })).rejects.toThrow("invalid_pool");
    await expect(generate({ ...value, pool: ["common", "m0"] })).rejects.toThrow("invalid_pool");
  });
  it("returns valid quotas when the optimizer fails", async () => {
    const optimizer: AssignmentOptimizer = { optimize: async () => { throw new Error("offline"); } };
    const result = await generate(input([3, 3, 1], 2, 4), optimizer);
    expect(result.quality.reason).toBe("solver_unavailable");
    expect(overlap(result.assignments.p0, result.assignments.p1)).toBe(2);
  });
  it("rejects forged optimizer assignments rather than trusting its optimal flag", async () => {
    const optimizer: AssignmentOptimizer = { optimize: async () => ({ assignments: { p0: ["bad"] }, optimal: true, reason: null, solverVersion: "fake" }) };
    const result = await generate(input([3, 3, 1], 2, 4), optimizer);
    expect(result.quality.reason).toBe("invalid_solver_result");
    expect(result.assignments.p0).toHaveLength(3);
  });
  it("never replaces a better fallback with a worse incumbent", async () => {
    const optimizer: AssignmentOptimizer = { optimize: async () => ({ assignments: { p0: ["m0", "m1", "m2"], p1: ["m0", "m1", "m2"], p2: ["m0"] }, optimal: false, reason: "time_limit", solverVersion: "fake" }) };
    const result = await generate(input([3, 3, 1], 2, 4), optimizer);
    expect(overlap(result.assignments.p0, result.assignments.p1)).toBe(2);
  });
  it("bounds assessment and retains exact quotas for large rosters", async () => {
    const value = input(Array.from({ length: 5000 }, (_, i) => i % 2), 1, 1);
    const result = await generate(value);
    expect(result.quality.summaryComplete).toBe(false);
    expect(result.quality.totalDeviation).toBeNull();
    expect(Object.values(result.assignments).reduce((sum, a) => sum + a.length, 0)).toBe(2500);
  });
  it("returns the fallback within the whole-operation deadline if optimizer loading hangs", async () => {
    jest.useFakeTimers();
    try {
      const optimizer: AssignmentOptimizer = { optimize: () => new Promise(() => {}) };
      const pending = generate(input([3, 3, 1], 2, 4), optimizer);
      await jest.advanceTimersByTimeAsync(1500);
      const result = await pending;
      expect(result.quality.reason).toBe("time_limit");
      expect(result.assignments.p0).toHaveLength(3);
    } finally { jest.useRealTimers(); }
  });
  it("honors quotas and selected-pool membership across varied feasible inputs", async () => {
    for (let n = 1; n <= 8; n++) for (let k = 0; k <= 3; k++) {
      const value = input(Array.from({ length: n }, (_, i) => (i + k) % 5), k, 5);
      value.policy = "preference";
      const { assignments } = await generate(value);
      for (const player of value.participants) {
        expect(assignments[player.id]).toHaveLength(player.target);
        expect(new Set(assignments[player.id]).size).toBe(player.target);
        expect(assignments[player.id].every((id) => value.pool.includes(id))).toBe(true);
      }
    }
  });
});
