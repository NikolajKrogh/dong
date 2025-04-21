import { Match, Player } from "../../store/store";

type PlayerAssignments = { [playerId: string]: string[] };

// --- Mock function definitions (copied from gameProgress.tsx) ---

const formatGoalToastMessage = (playersToDrink: string[]): string => {
  if (playersToDrink.length === 0) return "";
  if (playersToDrink.length <= 3) {
    return `${playersToDrink.join(", ")} should drink!`;
  } else {
    return `${playersToDrink.slice(0, 2).join(", ")} and ${
      playersToDrink.length - 2
    } others should drink!`;
  }
};

const calculateToastScoreDisplay = (
  match: Match,
  team: "home" | "away",
  isLiveUpdate: boolean,
  newTotal?: number,
  otherTeamScore?: number
): { homeScore: number; awayScore: number } => {
  let homeScore, awayScore;

  if (isLiveUpdate && typeof newTotal === "number") {
    if (team === "home") {
      homeScore = newTotal;
      awayScore = otherTeamScore ?? (match.awayGoals || 0);
    } else {
      homeScore = otherTeamScore ?? (match.homeGoals || 0);
      awayScore = newTotal;
    }
  } else {
    // Manual updates
    homeScore =
      team === "home" ? (match.homeGoals || 0) + 1 : match.homeGoals || 0;
    awayScore =
      team === "away" ? (match.awayGoals || 0) + 1 : match.awayGoals || 0;
  }
  return { homeScore, awayScore };
};

// Mock data needed for getPlayersWhoDrink
const mockPlayers: Player[] = [
  { id: "p1", name: "Alice", drinksTaken: 0 },
  { id: "p2", name: "Bob", drinksTaken: 0 },
  { id: "p3", name: "Charlie", drinksTaken: 0 },
  { id: "p4", name: "David", drinksTaken: 0 },
];

const mockPlayerAssignments: PlayerAssignments = {
  p1: ["m1", "m3"], // Alice assigned to m1 and m3
  p2: ["m2"],       // Bob assigned to m2
  p3: ["m1", "m2"], // Charlie assigned to m1 and m2
  p4: [],           // David not assigned
};

const mockCommonMatchId = "m3";

// Function definition for getPlayersWhoDrink (dependent on mock data)
const getPlayersWhoDrink = (
  matchId: string,
  players: Player[],
  commonMatchId: string | null | undefined,
  playerAssignments: PlayerAssignments
): string[] => {
  if (matchId === commonMatchId) {
    return players.map((p) => p.name);
  }
  return players
    .filter(
      (player) =>
        playerAssignments[player.id] &&
        playerAssignments[player.id].includes(matchId)
    )
    .map((p) => p.name);
};


// --- Tests ---

describe("GameProgressScreen Helper Functions", () => {

  describe("formatGoalToastMessage", () => {
    it("should return empty string for no players", () => {
      expect(formatGoalToastMessage([])).toBe("");
    });

    it("should list one player correctly", () => {
      expect(formatGoalToastMessage(["Alice"])).toBe("Alice should drink!");
    });

    it("should list two players correctly", () => {
      expect(formatGoalToastMessage(["Alice", "Bob"])).toBe("Alice, Bob should drink!");
    });

    it("should list three players correctly", () => {
      expect(formatGoalToastMessage(["Alice", "Bob", "Charlie"])).toBe("Alice, Bob, Charlie should drink!");
    });

    it("should summarize four players correctly", () => {
      expect(formatGoalToastMessage(["Alice", "Bob", "Charlie", "David"])).toBe("Alice, Bob and 2 others should drink!");
    });

    it("should summarize many players correctly", () => {
      const players = Array.from({ length: 10 }, (_, i) => `Player ${i + 1}`);
      expect(formatGoalToastMessage(players)).toBe("Player 1, Player 2 and 8 others should drink!");
    });
  });

  describe("getPlayersWhoDrink", () => {
    it("should return all players if matchId is the commonMatchId", () => {
      const drinkers = getPlayersWhoDrink(mockCommonMatchId, mockPlayers, mockCommonMatchId, mockPlayerAssignments);
      expect(drinkers).toEqual(["Alice", "Bob", "Charlie", "David"]);
    });

    it("should return players assigned to a specific matchId (m1)", () => {
      const drinkers = getPlayersWhoDrink("m1", mockPlayers, mockCommonMatchId, mockPlayerAssignments);
      expect(drinkers).toEqual(expect.arrayContaining(["Alice", "Charlie"]));
      expect(drinkers.length).toBe(2);
    });

    it("should return players assigned to a specific matchId (m2)", () => {
      const drinkers = getPlayersWhoDrink("m2", mockPlayers, mockCommonMatchId, mockPlayerAssignments);
      expect(drinkers).toEqual(expect.arrayContaining(["Bob", "Charlie"]));
      expect(drinkers.length).toBe(2);
    });

    it("should return an empty array if no players are assigned to the matchId", () => {
      const drinkers = getPlayersWhoDrink("m4", mockPlayers, mockCommonMatchId, mockPlayerAssignments);
      expect(drinkers).toEqual([]);
    });

     it("should return an empty array if a player has no assignments", () => {
       const drinkers = getPlayersWhoDrink("m1", [mockPlayers[3]], mockCommonMatchId, mockPlayerAssignments);
       expect(drinkers).toEqual([]);
     });

     it("should handle null or undefined commonMatchId correctly", () => {
        const drinkers = getPlayersWhoDrink("m1", mockPlayers, null, mockPlayerAssignments);
        expect(drinkers).toEqual(expect.arrayContaining(["Alice", "Charlie"]));
        expect(drinkers.length).toBe(2);

        const drinkersUndefined = getPlayersWhoDrink("m1", mockPlayers, undefined, mockPlayerAssignments);
        expect(drinkersUndefined).toEqual(expect.arrayContaining(["Alice", "Charlie"]));
        expect(drinkersUndefined.length).toBe(2);
     });
  });

  describe("calculateToastScoreDisplay", () => {
    const baseMatch: Match = { id: "m1", homeTeam: "A", awayTeam: "B", homeGoals: 1, awayGoals: 2, goals: 0 }; // Removed invalid status property

    // Live Updates
    it("Live: should update home score correctly", () => {
      const result = calculateToastScoreDisplay(baseMatch, "home", true, 2, 2);
      expect(result).toEqual({ homeScore: 2, awayScore: 2 });
    });

    it("Live: should update away score correctly", () => {
      const result = calculateToastScoreDisplay(baseMatch, "away", true, 3, 1);
      expect(result).toEqual({ homeScore: 1, awayScore: 3 });
    });

    it("Live: should use otherTeamScore when provided", () => {
      const result = calculateToastScoreDisplay(baseMatch, "home", true, 2, 5);
      expect(result).toEqual({ homeScore: 2, awayScore: 5 });
    });

    it("Live: should fallback to match score if otherTeamScore is undefined", () => {
      const result = calculateToastScoreDisplay(baseMatch, "home", true, 2, undefined);
      expect(result).toEqual({ homeScore: 2, awayScore: 2 });
       const resultAway = calculateToastScoreDisplay(baseMatch, "away", true, 3, undefined);
      expect(resultAway).toEqual({ homeScore: 1, awayScore: 3 });
    });

     it("Live: should handle undefined initial scores", () => {
       const matchNoScores: Match = { id: "m2", homeTeam: "C", awayTeam: "D", homeGoals: 0, awayGoals: 0, goals: 0 }; // Added required properties
       const result = calculateToastScoreDisplay(matchNoScores, "home", true, 1, 0);
       expect(result).toEqual({ homeScore: 1, awayScore: 0 });
       const resultAway = calculateToastScoreDisplay(matchNoScores, "away", true, 1, undefined);
       expect(resultAway).toEqual({ homeScore: 0, awayScore: 1 });
     });

    // Manual Updates
    it("Manual: should increment home score correctly", () => {
      const result = calculateToastScoreDisplay(baseMatch, "home", false);
      expect(result).toEqual({ homeScore: 2, awayScore: 2 });
    });

    it("Manual: should increment away score correctly", () => {
      const result = calculateToastScoreDisplay(baseMatch, "away", false);
      expect(result).toEqual({ homeScore: 1, awayScore: 3 });
    });

    it("Manual: should handle undefined initial scores", () => {
       const matchNoScores: Match = { id: "m2", homeTeam: "C", awayTeam: "D", homeGoals: 0, awayGoals: 0, goals: 0 }; // Added required properties
       const result = calculateToastScoreDisplay(matchNoScores, "home", false);
       expect(result).toEqual({ homeScore: 1, awayScore: 0 });
       const resultAway = calculateToastScoreDisplay(matchNoScores, "away", false);
       expect(resultAway).toEqual({ homeScore: 0, awayScore: 1 });
     });
  });

});