import { useGameStore } from "../../store/gameStore";
import { normalizeEspnScoreboard } from "../../supabase/functions/_shared/football-matches/espnMatchNormalizer";
import type { SavedMatch } from "../../types/footballMatch";
import { liveBoard } from "../fixtures/matchCatalog/scoreboards";
const snapshot: SavedMatch = {
  ...normalizeEspnScoreboard(liveBoard, "eng.1").matches[0],
  catalogMatchId: "123",
  observationVersion: "2",
  freshness: {
    lastAttemptAt: null,
    lastSuccessfulCheckAt: null,
    observedAt: null,
    isStale: true,
    availabilityReason: null,
  },
  historyDetails: {
    rosterEntries: [
      {
        athleteName: "A Player",
        sourceAthleteId: "a",
        side: "home",
        jersey: "9",
        position: "F",
        isStarter: true,
        didPlay: true,
        minutesPlayed: 90,
      },
    ],
    teamStats: null,
    availability: "available",
    isFinal: true,
    hasMoreRosterEntries: false,
  },
};

describe("self-contained private solo match history", () => {
  it("never rewrites ended history with newer catalog scores or lifecycle facts", () => {
    useGameStore.setState({ players: [{ id: "p", name: "Player", drinksTaken: 4 }] });
    useGameStore.getState().captureSavedMatches([snapshot]);
    useGameStore.getState().saveGameToHistory();
    const frozen = JSON.stringify(useGameStore.getState().history);
    useGameStore.getState().captureSavedMatches([{ ...snapshot, observationVersion: "99", homeScore: 0, lifecycle: "abandoned" }]);
    expect(JSON.stringify(useGameStore.getState().history)).toBe(frozen);
    expect(useGameStore.getState().players[0].drinksTaken).toBe(4);
    expect(useGameStore.getState().matches[0].catalogSnapshot?.lifecycle).toBe("abandoned");
  });
  beforeEach(() =>
    useGameStore.setState({
      matches: [
        {
          id: "source-1",
          catalogMatchId: "123",
          homeTeam: "Home",
          awayTeam: "Away",
          homeGoals: 1,
          awayGoals: 0,
        },
      ],
      history: [],
      soloTracking: null,
    }),
  );
  it("keeps captured roster and final detail through absent server detail and older observations", () => {
    useGameStore.getState().captureSavedMatches([snapshot]);
    useGameStore.getState().saveGameToHistory();
    useGameStore.getState().captureSavedMatches([{ ...snapshot, observationVersion: "1", homeScore: 0 }]);
    expect(useGameStore.getState().history[0].matches[0].catalogSnapshot?.observationVersion).toBe("2");
    useGameStore.getState().captureSavedMatches([
      {
        ...snapshot,
        historyDetails: {
          rosterEntries: null,
          teamStats: null,
          availability: "unavailable",
          isFinal: null,
          hasMoreRosterEntries: false,
        },
      },
    ]);
    const history = useGameStore.getState().history[0];
    expect(history.matches[0].catalogSnapshot?.historyDetails?.rosterEntries?.[0].athleteName).toBe("A Player");
    expect(history.matches[0]).toMatchObject({ homeGoals: 1, awayGoals: 0 });
    expect(JSON.stringify(history)).not.toContain("grantToken");
  });
});
