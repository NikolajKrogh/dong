import { selectGameplayMatches } from "../../../features/game-setup/selectGameplayMatches";

describe("selectGameplayMatches", () => {
  const matches = [{ id: "unused" }, { id: "common" }, { id: "assigned" }];

  it("keeps the common match and assignments from every player in their original order", () => {
    const selected = selectGameplayMatches(matches, "common", {
      first: [],
      second: ["assigned", "assigned", "missing"],
    });

    expect(selected).toEqual([matches[1], matches[2]]);
    expect(selected[0]).toBe(matches[1]);
    expect(matches).toHaveLength(3);
  });

  it("keeps only the common match when nobody has assignments", () => {
    expect(selectGameplayMatches(matches, "common", {})).toEqual([matches[1]]);
  });

  it("handles an empty pool or no common match", () => {
    expect(selectGameplayMatches([], "common", {})).toEqual([]);
    expect(selectGameplayMatches(matches, null, { player: ["assigned"] })).toEqual([matches[2]]);
  });
});
