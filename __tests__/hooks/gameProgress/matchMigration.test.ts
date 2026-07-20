import { describe, expect, it } from "@jest/globals";

import { migrateLegacyMatch } from "../../../hooks/gameProgress/matchMigration";
import type { Match } from "../../../store/store";

const buildMatch = (overrides: Partial<Match> = {}): Match => ({
  id: "match-1",
  homeTeam: "Arsenal FC",
  awayTeam: "Chelsea FC",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

describe("migrateLegacyMatch", () => {
  it("splits a legacy total goals value evenly for an even total", () => {
    const match = buildMatch({
      homeGoals: undefined,
      awayGoals: undefined,
      goals: 4,
    });

    const migrated = migrateLegacyMatch(match);

    expect(migrated.homeGoals).toBe(2);
    expect(migrated.awayGoals).toBe(2);
  });

  it("floors home and ceils away for an odd legacy total", () => {
    const match = buildMatch({
      homeGoals: undefined,
      awayGoals: undefined,
      goals: 5,
    });

    const migrated = migrateLegacyMatch(match);

    expect(migrated.homeGoals).toBe(2);
    expect(migrated.awayGoals).toBe(3);
  });

  it("only migrates from goals when a per-team field is actually missing", () => {
    const match = buildMatch({ homeGoals: 3, awayGoals: 1, goals: 4 });

    const migrated = migrateLegacyMatch(match);

    expect(migrated.homeGoals).toBe(3);
    expect(migrated.awayGoals).toBe(1);
  });

  it("defaults undefined per-team goals to 0 when there is no legacy total", () => {
    const match = buildMatch({ homeGoals: undefined, awayGoals: undefined });

    const migrated = migrateLegacyMatch(match);

    expect(migrated.homeGoals).toBe(0);
    expect(migrated.awayGoals).toBe(0);
  });

  it("leaves an already-migrated match with both fields set unchanged", () => {
    const match = buildMatch({ homeGoals: 2, awayGoals: 1 });

    const migrated = migrateLegacyMatch(match);

    expect(migrated).toEqual(match);
  });
});
