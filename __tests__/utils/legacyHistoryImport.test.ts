import type { LegacyLocalSessionSnapshot } from "../../types/legacyHistoryImport";
import {
  buildLegacyHistoryClaimantOptions,
  buildLegacyHistoryImportRequest,
  buildLegacyHistorySourceFingerprintInput,
  normalizeLegacyHistoryParticipantName,
} from "../../utils/legacyHistoryImport";

const buildSession = (
  overrides: Partial<LegacyLocalSessionSnapshot>,
): LegacyLocalSessionSnapshot => {
  return {
    id: "session-default",
    date: "2026-05-01T18:00:00.000Z",
    players: [],
    matches: [],
    commonMatchId: null,
    playerAssignments: {},
    matchesPerPlayer: 1,
    ...overrides,
  };
};

describe("legacyHistoryImport", () => {
  it("normalizes claimant names for stable grouping", () => {
    expect(normalizeLegacyHistoryParticipantName("  Alex   Example  ")).toBe(
      "alex example",
    );
  });

  it("groups claimant options by normalized name across session-local ids", () => {
    const sessions: LegacyLocalSessionSnapshot[] = [
      buildSession({
        id: "session-b",
        date: "2026-05-02T18:00:00.000Z",
        players: [
          { id: "alex-session-b", name: "Alex Example", drinksTaken: 4 },
          { id: "jordan-session-b", name: "Jordan Guest", drinksTaken: 2 },
        ],
      }),
      buildSession({
        id: "session-a",
        date: "2026-05-01T18:00:00.000Z",
        players: [
          { id: "jordan-session-a", name: "Jordan Guest", drinksTaken: 1 },
          { id: "alex-session-a", name: " alex   example ", drinksTaken: 3 },
        ],
      }),
    ];

    const claimantOptions = buildLegacyHistoryClaimantOptions(sessions);
    const alexOption = claimantOptions.find(
      (option) => option.name === "Alex Example",
    );

    expect(alexOption).toEqual({
      id: "alex-session-a",
      name: "Alex Example",
      normalizedName: "alex example",
      sessionIds: ["session-a", "session-b"],
      sessionCount: 2,
      sourceParticipantIds: ["alex-session-a", "alex-session-b"],
      sessionParticipantIds: {
        "session-a": ["alex-session-a"],
        "session-b": ["alex-session-b"],
      },
      ambiguousSessionIds: [],
    });
  });

  it("builds deterministic fingerprint inputs and session-specific claimant payloads", () => {
    const sessions: LegacyLocalSessionSnapshot[] = [
      buildSession({
        id: "session-b",
        date: "2026-05-02T18:00:00.000Z",
        players: [
          { id: "jordan-session-b", name: "Jordan Guest", drinksTaken: 2 },
          { id: "alex-session-b", name: "Alex Example", drinksTaken: 4 },
        ],
        matches: [
          {
            id: "match-b-2",
            homeTeam: "Team Two",
            awayTeam: "Team Three",
            homeGoals: 2,
            awayGoals: 0,
            startTime: "2026-05-02T19:00:00.000Z",
          },
          {
            id: "match-b-1",
            homeTeam: "Team One",
            awayTeam: "Team Two",
            homeGoals: 1,
            awayGoals: 1,
            startTime: "2026-05-02T18:00:00.000Z",
          },
        ],
        commonMatchId: "match-b-1",
        playerAssignments: {
          "jordan-session-b": ["match-b-2", "match-b-1"],
          "alex-session-b": ["match-b-2", "match-b-1"],
        },
        matchesPerPlayer: 2,
      }),
      buildSession({
        id: "session-a",
        date: "2026-05-01T18:00:00.000Z",
        players: [
          { id: "jordan-session-a", name: "Jordan Guest", drinksTaken: 1 },
          { id: "alex-session-a", name: "Alex Example", drinksTaken: 3 },
        ],
        matches: [
          {
            id: "match-a-1",
            homeTeam: "Alpha",
            awayTeam: "Beta",
            homeGoals: 3,
            awayGoals: 2,
            startTime: "2026-05-01T18:00:00.000Z",
          },
        ],
        commonMatchId: "match-a-1",
        playerAssignments: {
          "jordan-session-a": ["match-a-1"],
          "alex-session-a": ["match-a-1"],
        },
      }),
      buildSession({
        id: "session-c",
        date: "2026-05-03T18:00:00.000Z",
        players: [
          { id: "morgan-session-c", name: "Morgan Only", drinksTaken: 5 },
        ],
        matches: [
          {
            id: "match-c-1",
            homeTeam: "Gamma",
            awayTeam: "Delta",
            homeGoals: 0,
            awayGoals: 0,
            startTime: "2026-05-03T18:00:00.000Z",
          },
        ],
        playerAssignments: {
          "morgan-session-c": ["match-c-1"],
        },
      }),
    ];

    expect(buildLegacyHistorySourceFingerprintInput(sessions[0])).toEqual({
      sourceLocalSessionId: "session-b",
      savedAt: "2026-05-02T18:00:00.000Z",
      commonMatchId: "match-b-1",
      matchesPerPlayer: 2,
      players: [
        { id: "alex-session-b", name: "Alex Example", drinksTaken: 4 },
        { id: "jordan-session-b", name: "Jordan Guest", drinksTaken: 2 },
      ],
      matches: [
        {
          id: "match-b-1",
          homeTeam: "Team One",
          awayTeam: "Team Two",
          homeGoals: 1,
          awayGoals: 1,
          startTime: "2026-05-02T18:00:00.000Z",
        },
        {
          id: "match-b-2",
          homeTeam: "Team Two",
          awayTeam: "Team Three",
          homeGoals: 2,
          awayGoals: 0,
          startTime: "2026-05-02T19:00:00.000Z",
        },
      ],
      playerAssignments: {
        "alex-session-b": ["match-b-1", "match-b-2"],
        "jordan-session-b": ["match-b-1", "match-b-2"],
      },
    });

    const claimant = buildLegacyHistoryClaimantOptions(sessions).find(
      (option) => option.name === "Alex Example",
    );

    expect(claimant).toBeDefined();

    const request = buildLegacyHistoryImportRequest({
      sessions,
      claimant: claimant!,
    });

    expect(request.claimedLocalParticipantId).toBe("alex-session-a");
    expect(request.sessions).toHaveLength(2);
    expect(
      request.sessions.map((session) => session.sourceLocalSessionId),
    ).toEqual(["session-a", "session-b"]);
    expect(
      request.sessions.map((session) => session.claimedLocalParticipantId),
    ).toEqual(["alex-session-a", "alex-session-b"]);
    expect(request.sessions[1].players).toEqual([
      { id: "alex-session-b", name: "Alex Example", drinksTaken: 4 },
      { id: "jordan-session-b", name: "Jordan Guest", drinksTaken: 2 },
    ]);
  });

  it("preserves guest participants as session-scoped snapshots in the request payload", () => {
    const sessions: LegacyLocalSessionSnapshot[] = [
      buildSession({
        id: "session-a",
        date: "2026-05-01T18:00:00.000Z",
        players: [
          { id: "alex-session-a", name: "Alex Example", drinksTaken: 3 },
          { id: "jordan-session-a", name: "Jordan Guest", drinksTaken: 1 },
        ],
        matches: [
          {
            id: "match-a-1",
            homeTeam: "Alpha",
            awayTeam: "Beta",
            homeGoals: 3,
            awayGoals: 2,
            startTime: "2026-05-01T18:00:00.000Z",
          },
        ],
        commonMatchId: "match-a-1",
        playerAssignments: {
          "alex-session-a": ["match-a-1"],
          "jordan-session-a": ["match-a-1"],
        },
      }),
      buildSession({
        id: "session-b",
        date: "2026-05-02T18:00:00.000Z",
        players: [
          { id: "alex-session-b", name: "Alex Example", drinksTaken: 4 },
          { id: "jordan-session-b", name: "Jordan Guest", drinksTaken: 2 },
        ],
        matches: [
          {
            id: "match-b-1",
            homeTeam: "Team One",
            awayTeam: "Team Two",
            homeGoals: 1,
            awayGoals: 1,
            startTime: "2026-05-02T18:00:00.000Z",
          },
        ],
        commonMatchId: "match-b-1",
        playerAssignments: {
          "alex-session-b": ["match-b-1"],
          "jordan-session-b": ["match-b-1"],
        },
      }),
    ];

    const claimant = buildLegacyHistoryClaimantOptions(sessions).find(
      (option) => option.name === "Alex Example",
    );

    expect(claimant).toBeDefined();

    const request = buildLegacyHistoryImportRequest({
      sessions,
      claimant: claimant!,
    });

    expect(request.sessions).toEqual([
      expect.objectContaining({
        sourceLocalSessionId: "session-a",
        claimedLocalParticipantId: "alex-session-a",
        guestParticipants: [
          { id: "jordan-session-a", name: "Jordan Guest", drinksTaken: 1 },
        ],
      }),
      expect.objectContaining({
        sourceLocalSessionId: "session-b",
        claimedLocalParticipantId: "alex-session-b",
        guestParticipants: [
          { id: "jordan-session-b", name: "Jordan Guest", drinksTaken: 2 },
        ],
      }),
    ]);

    expect(
      request.sessions.every((session) =>
        session.guestParticipants.every(
          (participant) => participant.id !== session.claimedLocalParticipantId,
        ),
      ),
    ).toBe(true);
  });

  it("rejects claimant options that are ambiguous inside a single session", () => {
    const sessions: LegacyLocalSessionSnapshot[] = [
      buildSession({
        id: "ambiguous-session",
        players: [
          { id: "chris-1", name: "Chris", drinksTaken: 1 },
          { id: "chris-2", name: "  Chris  ", drinksTaken: 2 },
        ],
      }),
    ];

    const claimant = buildLegacyHistoryClaimantOptions(sessions)[0];

    expect(claimant.ambiguousSessionIds).toEqual(["ambiguous-session"]);
    expect(() =>
      buildLegacyHistoryImportRequest({
        sessions,
        claimant,
      }),
    ).toThrow("Claimant Chris is ambiguous in 1 legacy session(s).");
  });
});
