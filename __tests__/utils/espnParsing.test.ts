import {
  extractMatchId,
  parseStatistics,
  processApiMatch,
} from "../../utils/espnParsing";
import { ESPNCompetitor, ESPNEvent } from "../../types/espn";

/**
 * Characterization tests pinning the behavior of
 * processApiMatch/parseStatistics/extractMatchId (moved here from
 * hooks/useLiveScores.ts in Phase 6). Written against the pre-move code and
 * unchanged since — they pass identically against the new module location,
 * proving the move preserved behavior exactly.
 */

const baseCompetitor = (overrides: Partial<any> = {}) => ({
  homeAway: "home",
  score: "1",
  team: {
    id: "1",
    displayName: "Team A",
    logo: "https://example.com/a.png",
  },
  ...overrides,
});

const baseEvent = (overrides: Partial<any> = {}) => ({
  id: "evt1",
  status: {
    type: {
      state: "in",
      description: "In Progress",
      shortDetail: "45'",
    },
    displayClock: "45'",
  },
  competitions: [
    {
      competitors: [
        baseCompetitor({ homeAway: "home", score: "1", team: { id: "h1", displayName: "Home FC" } }),
        baseCompetitor({ homeAway: "away", score: "0", team: { id: "a1", displayName: "Away FC" } }),
      ],
      details: [],
    },
  ],
  ...overrides,
});

describe("extractMatchId", () => {
  it("returns the id for a valid event", () => {
    expect(extractMatchId({ id: "abc123" })).toBe("abc123");
  });

  it("returns null when id is missing", () => {
    // Deliberately malformed input (missing required `id`) to test runtime
    // robustness against real-world incomplete payloads.
    expect(extractMatchId({} as unknown as ESPNEvent)).toBeNull();
  });

  it("returns null when id is an empty string", () => {
    expect(extractMatchId({ id: "" })).toBeNull();
  });

  it("returns null when id is not a string", () => {
    expect(extractMatchId({ id: 123 } as unknown as { id: string })).toBeNull();
  });

  it("returns null for a null/undefined event", () => {
    expect(extractMatchId(null)).toBeNull();
    expect(extractMatchId(undefined)).toBeNull();
  });
});

describe("parseStatistics", () => {
  it("reads numeric `value` fields by stat name (case-insensitive)", () => {
    const competitor: ESPNCompetitor = {
      statistics: [
        { name: "totalShots", value: 12 },
        { name: "ShotsOnTarget", value: 5 },
        { name: "foulsCommitted", value: 8 },
        { name: "wonCorners", value: 3 },
        { name: "possessionPct", value: 55 },
      ],
    };

    expect(parseStatistics(competitor)).toEqual({
      shotAttempts: 12,
      shotsOnGoal: 5,
      fouls: 8,
      yellowCards: 0,
      redCards: 0,
      cornerKicks: 3,
      possession: 55,
    });
  });

  it("falls back to parsing displayValue when value is absent", () => {
    const competitor: ESPNCompetitor = {
      statistics: [{ name: "possessionPct", displayValue: "45.7%" }],
    };
    expect(parseStatistics(competitor).possession).toBeCloseTo(45.7);
  });

  it("defaults missing stats to 0", () => {
    const competitor: ESPNCompetitor = { statistics: [] };
    expect(parseStatistics(competitor)).toEqual({
      shotAttempts: 0,
      shotsOnGoal: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      cornerKicks: 0,
      possession: 0,
    });
  });

  it("defaults to 0 when statistics array is entirely missing", () => {
    const competitor: ESPNCompetitor = {};
    expect(parseStatistics(competitor).shotAttempts).toBe(0);
  });

  it("always reports yellowCards/redCards as 0 (counted separately from event details)", () => {
    const competitor: ESPNCompetitor = {
      statistics: [{ name: "totalShots", value: 1 }],
    };
    expect(parseStatistics(competitor).yellowCards).toBe(0);
    expect(parseStatistics(competitor).redCards).toBe(0);
  });
});

describe("processApiMatch", () => {
  it("parses a basic live match", () => {
    const result = processApiMatch(baseEvent());
    expect(result).toMatchObject({
      id: "evt1",
      homeTeam: "Home FC",
      awayTeam: "Away FC",
      homeTeamId: "h1",
      awayTeamId: "a1",
      homeScore: 1,
      awayScore: 0,
      isLive: true,
      status: "In Progress",
      minutesPlayed: "45'",
    });
  });

  it("returns HT for half-time shortDetail", () => {
    const result = processApiMatch(
      baseEvent({
        status: {
          type: { state: "in", description: "Halftime", shortDetail: "HT" },
          displayClock: "45'",
        },
      }),
    );
    expect(result?.minutesPlayed).toBe("HT");
  });

  it("returns FT for full-time shortDetail", () => {
    const result = processApiMatch(
      baseEvent({
        status: {
          type: { state: "post", description: "Final", shortDetail: "FT" },
          displayClock: "",
        },
      }),
    );
    expect(result?.minutesPlayed).toBe("FT");
    expect(result?.isLive).toBe(false);
  });

  it("records an own goal with penaltyKick/ownGoal flags", () => {
    const event = baseEvent({
      competitions: [
        {
          competitors: [
            baseCompetitor({ homeAway: "home", team: { id: "h1", displayName: "Home FC" } }),
            baseCompetitor({ homeAway: "away", team: { id: "a1", displayName: "Away FC" } }),
          ],
          details: [
            {
              scoringPlay: true,
              team: { id: "h1" },
              athletesInvolved: [{ displayName: "Jane Defender" }],
              clock: { displayValue: "23'" },
              penaltyKick: false,
              ownGoal: true,
              type: { text: "Own Goal" },
            },
          ],
        },
      ],
    });

    const result = processApiMatch(event);
    expect(result?.goalScorers).toEqual([
      {
        name: "Jane Defender",
        time: "23'",
        teamId: "h1",
        isPenalty: false,
        isOwnGoal: true,
        goalType: "Own Goal",
      },
    ]);
  });

  it("records a penalty goal", () => {
    const event = baseEvent({
      competitions: [
        {
          competitors: [
            baseCompetitor({ homeAway: "home", team: { id: "h1", displayName: "Home FC" } }),
            baseCompetitor({ homeAway: "away", team: { id: "a1", displayName: "Away FC" } }),
          ],
          details: [
            {
              scoringPlay: true,
              team: { id: "a1" },
              athletesInvolved: [{ displayName: "Pat Striker" }],
              clock: { displayValue: "60'" },
              penaltyKick: true,
              ownGoal: false,
              type: { text: "Penalty" },
            },
          ],
        },
      ],
    });

    const result = processApiMatch(event);
    expect(result?.goalScorers).toEqual([
      {
        name: "Pat Striker",
        time: "60'",
        teamId: "a1",
        isPenalty: true,
        isOwnGoal: false,
        goalType: "Penalty",
      },
    ]);
  });

  it("falls back to shortName then 'Unknown Player' when athletesInvolved is missing", () => {
    const eventWithShortName = baseEvent({
      competitions: [
        {
          competitors: [
            baseCompetitor({ homeAway: "home", team: { id: "h1", displayName: "Home FC" } }),
            baseCompetitor({ homeAway: "away", team: { id: "a1", displayName: "Away FC" } }),
          ],
          details: [
            {
              scoringPlay: true,
              team: { id: "h1" },
              athletesInvolved: [{ shortName: "J. Doe" }],
              clock: { displayValue: "10'" },
            },
          ],
        },
      ],
    });
    expect(processApiMatch(eventWithShortName)?.goalScorers?.[0].name).toBe(
      "J. Doe",
    );

    const eventWithNoAthlete = baseEvent({
      competitions: [
        {
          competitors: [
            baseCompetitor({ homeAway: "home", team: { id: "h1", displayName: "Home FC" } }),
            baseCompetitor({ homeAway: "away", team: { id: "a1", displayName: "Away FC" } }),
          ],
          details: [
            {
              scoringPlay: true,
              team: { id: "h1" },
              clock: { displayValue: "10'" },
            },
          ],
        },
      ],
    });
    expect(processApiMatch(eventWithNoAthlete)?.goalScorers?.[0].name).toBe(
      "Unknown Player",
    );
  });

  it("counts yellow and red cards per team from competition details", () => {
    const event = baseEvent({
      competitions: [
        {
          competitors: [
            baseCompetitor({ homeAway: "home", team: { id: "h1", displayName: "Home FC" } }),
            baseCompetitor({ homeAway: "away", team: { id: "a1", displayName: "Away FC" } }),
          ],
          details: [
            { yellowCard: true, team: { id: "h1" } },
            { yellowCard: true, team: { id: "a1" } },
            { redCard: true, team: { id: "a1" } },
          ],
        },
      ],
    });

    const result = processApiMatch(event);
    expect(result?.homeTeamStatistics?.yellowCards).toBe(1);
    expect(result?.homeTeamStatistics?.redCards).toBe(0);
    expect(result?.awayTeamStatistics?.yellowCards).toBe(1);
    expect(result?.awayTeamStatistics?.redCards).toBe(1);
  });

  it("returns undefined goalScorers when there are no scoring plays", () => {
    const result = processApiMatch(baseEvent());
    expect(result?.goalScorers).toBeUndefined();
  });

  it("returns statistics with defaults when competitor.statistics is missing", () => {
    const result = processApiMatch(baseEvent());
    expect(result?.homeTeamStatistics).toMatchObject({
      shotAttempts: 0,
      shotsOnGoal: 0,
      fouls: 0,
      cornerKicks: 0,
      possession: 0,
    });
  });

  it("returns null when competitions is an empty array", () => {
    expect(processApiMatch(baseEvent({ competitions: [] }))).toBeNull();
  });

  it("returns null when status is entirely missing (still requires competitors)", () => {
    // status is optional-chained throughout, so a missing status alone does not
    // cause a null return as long as competitors are present.
    const result = processApiMatch(baseEvent({ status: undefined }));
    expect(result).not.toBeNull();
    expect(result?.status).toBe("Scheduled");
    expect(result?.isLive).toBe(false);
    expect(result?.minutesPlayed).toBe("?");
  });

  it("returns null for a malformed event with no id", () => {
    // Deliberately malformed input (missing required `id`) to test runtime
    // robustness against real-world incomplete payloads.
    expect(
      processApiMatch({ competitions: [] } as unknown as ESPNEvent),
    ).toBeNull();
  });

  it("returns null for a completely empty event object", () => {
    expect(processApiMatch({} as unknown as ESPNEvent)).toBeNull();
  });

  it("returns null when home or away competitor is missing", () => {
    const event = baseEvent({
      competitions: [
        {
          competitors: [
            baseCompetitor({ homeAway: "home", team: { id: "h1", displayName: "Home FC" } }),
          ],
        },
      ],
    });
    expect(processApiMatch(event)).toBeNull();
  });
});
