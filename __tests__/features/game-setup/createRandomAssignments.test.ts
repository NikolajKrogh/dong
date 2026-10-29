import { createRandomAssignments } from "../../../features/game-setup/createRandomAssignments";
import { shuffle } from "../../../features/game-setup/shuffle";

it("Fisher–Yates reaches each three-item permutation once for the six equal draw intervals", () => {
  const permutations = new Set<string>();
  const input = [1, 2, 3];
  for (const first of [0.1, 0.4, 0.8]) for (const second of [0.1, 0.8]) {
    const draws = [first, second];
    permutations.add(shuffle(input, () => draws.shift()!).join());
  }
  expect(permutations.size).toBe(6);
  expect(input).toEqual([1, 2, 3]);
  expect(shuffle([], () => 0)).toEqual([]);
});

function fixture(count: number, additional = count - 1) {
  return {
    players: Array.from({ length: count }, (_, id) => ({ id: String(id), name: `Player ${id}` })),
    matches: Array.from({ length: 1 + count * (count - 1) / 2 + Math.max(0, additional - count + 1) * count },
      (_, id) => ({ id: String(id), homeTeam: "Home", awayTeam: "Away", homeGoals: 0, awayGoals: 0 })),
  };
}

it("preserves configured counts, exactly one shared pair match and immutable inputs across random draws", () => {
  for (let count = 1; count <= 5; count++) for (const extra of [0, 2]) for (let seed = 1; seed <= 10; seed++) {
    let state = seed;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
    const { players, matches } = fixture(count, count - 1 + extra);
    const before = JSON.stringify({ players, matches });
    const result = createRandomAssignments(players, matches, "0", count - 1 + extra, random);
    for (const player of players) {
      expect(result[player.id]).toHaveLength(count + extra);
      expect(result[player.id]).toContain("0");
      expect(new Set(result[player.id]).size).toBe(result[player.id].length);
      for (const other of players) if (other.id !== player.id) {
        expect(result[player.id].filter(id => result[other.id].includes(id))).toHaveLength(2);
      }
    }
    expect(JSON.stringify({ players, matches })).toBe(before);
  }
});

it("rejects impossible counts, missing common matches, duplicate IDs and insufficient pools", () => {
  const { players, matches } = fixture(3);
  expect(() => createRandomAssignments(players, matches, "missing", 2)).toThrow(/common match/);
  expect(() => createRandomAssignments(players, matches, "0", 1)).toThrow(/at least 2/);
  expect(() => createRandomAssignments(players, matches.slice(0, 2), "0", 2)).toThrow(/Need/);
  expect(() => createRandomAssignments([players[0], players[0]], matches, "0", 2)).toThrow(/distinct player/);
  expect(() => createRandomAssignments(players, [...matches, matches[0]], "0", 2)).toThrow(/distinct matches/);
});
