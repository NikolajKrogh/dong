import { describe, expect, it } from "@jest/globals";

import { migrateLegacyMatch } from "../../../features/game-progress/matchMigration";
import type { Match } from "../../../store/gameStore";

const buildMatch = (overrides: Partial<Match> = {}): Match => ({
  id: "match-1",
  homeTeam: "Arsenal FC",
  awayTeam: "Chelsea FC",
  homeGoals: 0,
  awayGoals: 0,
  ...overrides,
});

describe("migrateLegacyMatch", () => {
  it.each([
    { total: 4, home: 2, away: 2 },
    { total: 5, home: 2, away: 3 },
  ])("splits a legacy total of $total into $home home and $away away goals", ({ total, home, away }) => {
    const migrated = migrateLegacyMatch(buildMatch({ homeGoals: undefined, awayGoals: undefined, goals: total }));
    expect(migrated.homeGoals).toBe(home);
    expect(migrated.awayGoals).toBe(away);
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
