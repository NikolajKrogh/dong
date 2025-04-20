import React from "react";
import { Text, View } from "react-native";
import { goalToastConfig } from "../../../components/gameProgress/GoalToast";

jest.mock("@expo/vector-icons", () => {
  const ReactNative = require("react-native");
  return {
    Ionicons: ({ name, size, color }: any) => (
      <ReactNative.Text>
        Icon:{name} Size:{size} Color:{color}
      </ReactNative.Text>
    ),
  };
});

describe("GoalToast Component Logic", () => {
  const renderToast = (props: {
    text1?: string;
    text2?: string;
    props?: { scoringTeam?: "home" | "away" };
  }) => {
    return goalToastConfig.success(props);
  };

  it("should parse title correctly with regex and highlight home team", () => {
    const props = {
      text1: "Arsenal 1-0 Chelsea",
      text2: "Player A should drink!",
      props: { scoringTeam: "home" as const },
    };
    const toastElement = renderToast(props);

    // Check root element type
    expect(toastElement.type).toBe(View);

    // Find the score section View
    const scoreSection = toastElement.props.children[0];
    expect(scoreSection.type).toBe(View);

    // Extract children of score section
    const [homeText, scoreView, awayText] = scoreSection.props.children;

    // Check home team text and style
    expect(homeText.type).toBe(Text);
    expect(homeText.props.children).toBe("Arsenal");
    expect(homeText.props.style).toMatchObject({
      color: "#4CAF50", // Highlight color for scoring team
      fontWeight: "bold",
    });

    // Check score text
    const scoreText = scoreView.props.children;
    expect(scoreText.type).toBe(Text);
    expect(scoreText.props.children).toBe("1-0");

    // Check away team text and style
    expect(awayText.type).toBe(Text);
    expect(awayText.props.children).toBe("Chelsea");
    expect(awayText.props.style).toMatchObject({
      color: "#ffffff", // Default color
      fontWeight: "normal",
    });

    // Check drink message section
    const messageSection = toastElement.props.children[1];
    const messageContent = messageSection.props.children.props.children[1]; // Get the Text component
    expect(messageContent.type).toBe(Text);
    expect(messageContent.props.children).toEqual(["Player A ", " DRINK!"]);
  });

  it("should parse title correctly with regex and highlight away team", () => {
    const props = {
      text1: "Man City 2-2 Liverpool",
      text2: "Player B should drink!",
      props: { scoringTeam: "away" as const },
    };
    const toastElement = renderToast(props);
    const scoreSection = toastElement.props.children[0];
    const [homeText, , awayText] = scoreSection.props.children; // Destructure

    // Check home team style
    expect(homeText.props.style).toMatchObject({
      color: "#ffffff",
      fontWeight: "normal",
    });

    // Check away team style
    expect(awayText.props.style).toMatchObject({
      color: "#4CAF50",
      fontWeight: "bold",
    });
  });

  it("should use fallback parsing when regex fails", () => {
    const props = {
      text1: "Tottenham Hotspur 3-1 Aston Villa", // Multi-word teams
      text2: "Player C should drink!",
      props: { scoringTeam: "home" as const },
    };
    const toastElement = renderToast(props);
    const scoreSection = toastElement.props.children[0];
    const [homeText, scoreView, awayText] = scoreSection.props.children;

    expect(homeText.props.children).toBe("Tottenham Hotspur");
    expect(scoreView.props.children.props.children).toBe("3-1");
    expect(awayText.props.children).toBe("Aston Villa");
    expect(homeText.props.style).toMatchObject({ fontWeight: "bold" }); // Home scored
    expect(awayText.props.style).toMatchObject({ fontWeight: "normal" });
  });

  it("should use last resort fallback parsing", () => {
    const props = {
      text1: "InvalidTitleFormat", // Should trigger last resort
      text2: "Player D should drink!",
      props: { scoringTeam: "away" as const },
    };
    const toastElement = renderToast(props);
    const scoreSection = toastElement.props.children[0];
    const [homeText, scoreView, awayText] = scoreSection.props.children;

    expect(homeText.props.children).toBe("InvalidTitleFormat"); // Fallback assigns first word
    expect(scoreView.props.children.props.children).toBe("0-0"); // Fallback score
    expect(awayText.props.children).toBe(""); // Fallback away team
    expect(homeText.props.style).toMatchObject({ fontWeight: "normal" });
    expect(awayText.props.style).toMatchObject({ fontWeight: "bold" }); // Away scored
  });

  it("should handle missing text1", () => {
    const props = {
      text2: "Player E should drink!",
      props: { scoringTeam: "home" as const },
    };
    const toastElement = renderToast(props);
    const scoreSection = toastElement.props.children[0];
    const [homeText, scoreView, awayText] = scoreSection.props.children;

    expect(homeText.props.children).toBe(""); // Fallback
    expect(scoreView.props.children.props.children).toBe("0-0"); // Fallback
    expect(awayText.props.children).toBe(""); // Fallback
  });

  it("should handle missing text2", () => {
    const props = {
      text1: "Team A 1-1 Team B",
      props: { scoringTeam: "home" as const },
    };
    const toastElement = renderToast(props);
    const messageSection = toastElement.props.children[1];
    const messageContent = messageSection.props.children.props.children[1];

    expect(messageContent.props.children).toEqual(["", " DRINK!"]);
  });

  it("should default scoringTeam to home if not provided", () => {
    const props = {
      text1: "Home Team 1-0 Away Team",
      text2: "Player F should drink!",
    };
    const toastElement = renderToast(props);
    const scoreSection = toastElement.props.children[0];
    const [homeText, , awayText] = scoreSection.props.children;

    expect(homeText.props.style).toMatchObject({ fontWeight: "bold" }); // Home should be bold by default
    expect(awayText.props.style).toMatchObject({ fontWeight: "normal" });
  });

  describe("Score Calculation Logic", () => {
    /**
     * Helper function that mimics the core score calculation logic
     * from the showGoalToast function in gameProgress.tsx
     */
    const calculateToastScore = (
      match: {
        homeGoals?: number;
        awayGoals?: number;
      },
      team: "home" | "away",
      isLiveUpdate: boolean,
      newTotal?: number,
      otherTeamScore?: number
    ): string => {
      let homeScore = match.homeGoals || 0;
      let awayScore = match.awayGoals || 0;

      if (isLiveUpdate && typeof newTotal === "number") {
        // For live updates, use the provided newTotal and otherTeamScore
        if (team === "home") {
          homeScore = newTotal;
          awayScore = otherTeamScore ?? (match.awayGoals || 0);
        } else {
          homeScore = otherTeamScore ?? (match.homeGoals || 0);
          awayScore = newTotal;
        }
      } else if (!isLiveUpdate) {
        // For manual updates, add 1 to the current value
        homeScore =
          team === "home" ? (match.homeGoals || 0) + 1 : match.homeGoals || 0;
        awayScore =
          team === "away" ? (match.awayGoals || 0) + 1 : match.awayGoals || 0;
      }

      return `${homeScore}-${awayScore}`;
    };

    it("should calculate correct score for live home team goal updates", () => {
      const mockMatch = {
        homeGoals: 2,
        awayGoals: 1,
      };

      // Live update with newTotal=3 should show 3-1
      expect(calculateToastScore(mockMatch, "home", true, 3)).toBe("3-1");

      // With explicit otherTeamScore param
      expect(calculateToastScore(mockMatch, "home", true, 3, 1)).toBe("3-1");
    });

    it("should calculate correct score for live away team goal updates", () => {
      const mockMatch = {
        homeGoals: 2,
        awayGoals: 1,
      };

      // Live update with newTotal=2 should show 2-2
      expect(calculateToastScore(mockMatch, "away", true, 2)).toBe("2-2");

      // With explicit otherTeamScore param
      expect(calculateToastScore(mockMatch, "away", true, 2, 2)).toBe("2-2");
    });

    it("should respect explicit otherTeamScore for live updates", () => {
      const mockMatch = {
        homeGoals: 2,
        awayGoals: 1,
      };

      // Home scores, away score explicitly overridden to 3
      expect(calculateToastScore(mockMatch, "home", true, 3, 3)).toBe("3-3");

      // Away scores, home score explicitly overridden to 0
      expect(calculateToastScore(mockMatch, "away", true, 2, 0)).toBe("0-2");
    });

    it("should calculate correct score for manual home team goal updates", () => {
      const mockMatch = {
        homeGoals: 2,
        awayGoals: 1,
      };

      // Manual update should increment the current value (2+1)-1 = 3-1
      expect(calculateToastScore(mockMatch, "home", false)).toBe("3-1");
    });

    it("should calculate correct score for manual away team goal updates", () => {
      const mockMatch = {
        homeGoals: 2,
        awayGoals: 1,
      };

      // Manual update should increment the current value 2-(1+1) = 2-2
      expect(calculateToastScore(mockMatch, "away", false)).toBe("2-2");
    });

    it("should handle undefined goal values", () => {
      const mockMatch = {};

      // Should treat undefined as 0
      expect(calculateToastScore(mockMatch, "home", true, 1)).toBe("1-0");
      expect(calculateToastScore(mockMatch, "away", true, 1)).toBe("0-1");
      expect(calculateToastScore(mockMatch, "home", false)).toBe("1-0");
      expect(calculateToastScore(mockMatch, "away", false)).toBe("0-1");
    });

    it.each([
      {
        scenario: "Home scores first goal (0-3 -> 1-3)",
        match: { homeGoals: 0, awayGoals: 3 },
        team: "home" as const,
        newTotal: 1,
        expected: "1-3",
      },
      {
        scenario: "Home scores first goal (0-4 -> 1-4)",
        match: { homeGoals: 0, awayGoals: 4 },
        team: "home" as const,
        newTotal: 1,
        expected: "1-4",
      },
      {
        scenario: "Home equalizes (0-1 -> 1-1)",
        match: { homeGoals: 0, awayGoals: 1 },
        team: "home" as const,
        newTotal: 1,
        expected: "1-1",
      },
    ])(
      "Live Update: Home Team - $scenario",
      ({ match, team, newTotal, expected }) => {
        expect(calculateToastScore(match, team, true, newTotal)).toBe(expected);
      }
    );

    it.each([
      {
        scenario: "Away scores first goal (3-0 -> 3-1)",
        match: { homeGoals: 3, awayGoals: 0 },
        team: "away" as const,
        newTotal: 1,
        expected: "3-1",
      },
      {
        scenario: "Away scores first goal (4-0 -> 4-1)",
        match: { homeGoals: 4, awayGoals: 0 },
        team: "away" as const,
        newTotal: 1,
        expected: "4-1",
      },
      {
        scenario: "Away equalizes (1-0 -> 1-1)",
        match: { homeGoals: 1, awayGoals: 0 },
        team: "away" as const,
        newTotal: 1,
        expected: "1-1",
      },
    ])(
      "Live Update: Away Team - $scenario",
      ({ match, team, newTotal, expected }) => {
        expect(calculateToastScore(match, team, true, newTotal)).toBe(expected);
      }
    );
  });
});
