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

    // Check score text
    const scoreText = scoreView.props.children;
    expect(scoreText.type).toBe(Text);
    expect(scoreText.props.children).toBe("1-0");

    // Check away team text and style
    expect(awayText.type).toBe(Text);
    expect(awayText.props.children).toBe("Chelsea");

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
    const [homeText, scoreView, awayText] = scoreSection.props.children;

    expect(homeText.props.children).toBe("Man City");
    expect(scoreView.props.children.props.children).toBe("2-2");
    expect(awayText.props.children).toBe("Liverpool");
    expect(homeText.props.style).toMatchObject({ fontWeight: "normal" });
    expect(awayText.props.style).toMatchObject({ fontWeight: "bold" });
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

});
