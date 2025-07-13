import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../app/style/palette";

export const goalToastConfig = {
  success: (props: {
    text1?: string;
    text2?: string;
    props?: { scoringTeam?: "home" | "away" };
  }) => {
    // Get scoring team from props
    const scoringTeam = props.props?.scoringTeam || "home";

    // Parse the title more intelligently using regex to find the score pattern
    const title = props.text1 || "";
    const scoreRegex = /\s(\d+)-(\d+)\s/;
    const scoreMatch = title.match(scoreRegex);

    let homeTeam, awayTeam, score;

    if (scoreMatch && scoreMatch.index !== undefined) {
      // Extract score
      score = scoreMatch[0].trim();

      // Extract team names based on the position of the score
      const splitIndex = scoreMatch.index;
      homeTeam = title.substring(0, splitIndex).trim();
      awayTeam = title.substring(splitIndex + scoreMatch[0].length).trim();
    } else {
      // Fallback in case regex fails
      const parts = title.split(" ");
      const scoreIndex = parts.findIndex((part) => part.includes("-"));

      if (scoreIndex > 0 && scoreIndex < parts.length - 1) {
        homeTeam = parts.slice(0, scoreIndex).join(" ");
        score = parts[scoreIndex];
        awayTeam = parts.slice(scoreIndex + 1).join(" ");
      } else {
        // Last resort fallback
        const titleParts = title.split(" ");
        homeTeam = titleParts[0] || "";
        score = titleParts[1] || "0-0";
        awayTeam = titleParts[2] || "";
      }
    }

    // Parse player names from the message for better formatting
    let drinkMessage = props.text2 || "";

    return (
      <View
        style={{
          width: "90%",
          backgroundColor: colors.toastBackground,
          borderRadius: 12,
          padding: 12,
          flexDirection: "column",
          alignSelf: "center",
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 8,
          borderLeftWidth: 3,
          borderLeftColor: colors.warning,
        }}
      >
        {/* Score section */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: scoringTeam === "home" ? colors.success : colors.white,
              fontWeight: scoringTeam === "home" ? "bold" : "normal",
              flex: 1,
            }}
          >
            {homeTeam}
          </Text>
          <View
            style={{
              backgroundColor: colors.darkSurface,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              marginHorizontal: 8,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "bold",
                color: colors.warning,
              }}
            >
              {score}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 16,
              color: scoringTeam === "away" ? colors.success : colors.white,
              fontWeight: scoringTeam === "away" ? "bold" : "normal",
              flex: 1,
              textAlign: "right",
            }}
          >
            {awayTeam}
          </Text>
        </View>

        {/* Improved message section */}
        <View
          style={{
            backgroundColor: colors.darkSurface,
            marginTop: 10,
            borderRadius: 6,
            padding: 10,
          }}
        >
          {/* Beer icon and player names on the same line */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Ionicons name="beer" size={20} color={colors.warning} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: colors.warning,
                marginLeft: 8,
                textAlign: "center",
              }}
            >
              {drinkMessage.replace("should drink!", "")} DRINK!
            </Text>
          </View>
        </View>
      </View>
    );
  },
};
