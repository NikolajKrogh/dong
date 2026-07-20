import React, { useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useColors } from "../../../app/style/theme";
import { createStyles } from "./styles";

/**
 * Horizontal bar comparison for a stat (home vs away).
 * @param {{homeValue:number, awayValue:number, label:string, isPercentage?:boolean}} props Component props.
 * @returns {JSX.Element} Rendered stat progress bar.
 */
export const StatProgressBar = ({
  homeValue,
  awayValue,
  label,
  isPercentage = false,
}: {
  homeValue: number;
  awayValue: number;
  label: string;
  isPercentage?: boolean;
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const maxValue = Math.max(1, homeValue, awayValue); // Ensure maxValue is at least 1 to avoid division by zero
  const homePercent = (homeValue / maxValue) * 100;
  const awayPercent = (awayValue / maxValue) * 100;

  const barHeight = 8; // Height of the progress bars
  const totalBarWidth = 100; // Represents 100% width for calculations
  const homeBarWidth = (homePercent / 100) * (totalBarWidth / 2);
  const awayBarWidth = (awayPercent / 100) * (totalBarWidth / 2);

  const homeColor = colors.primary;
  const awayColor = colors.awayTeam;
  const dividerColor = colors.darkSurface;

  return (
    <View
      style={styles.statProgressContainer}
      accessible={true}
      accessibilityLabel={`${label}: Home ${homeValue}${
        isPercentage ? "%" : ""
      }, Away ${awayValue}${isPercentage ? "%" : ""}`}
    >
      <Text style={styles.statValue}>
        {homeValue}
        {isPercentage ? "%" : ""}
      </Text>

      <View style={styles.statProgressWrapper}>
        <Text style={styles.statProgressLabel}>{label}</Text>
        <View style={styles.svgProgressBarContainer}>
          <Svg height={barHeight} width="100%">
            {/* Background for Home Side */}
            <Rect
              x="0"
              y="0"
              width="50%"
              height={barHeight}
              fill={styles.homeProgressArea.backgroundColor}
              rx={styles.homeProgressBar.borderTopLeftRadius} // Optional: for rounded corners
              ry={styles.homeProgressBar.borderTopLeftRadius}
            />
            {/* Home Progress */}
            <Rect
              x={`${50 - homeBarWidth}%`} // Start from the right edge of the home area and draw left
              y="0"
              width={`${homeBarWidth}%`}
              height={barHeight}
              fill={homeColor}
              rx={styles.homeProgressBar.borderTopLeftRadius}
              ry={styles.homeProgressBar.borderTopLeftRadius}
            />

            {/* Background for Away Side */}
            <Rect
              x="50%"
              y="0"
              width="50%"
              height={barHeight}
              fill={styles.awayProgressArea.backgroundColor}
              rx={styles.awayProgressBar.borderTopRightRadius} // Optional: for rounded corners
              ry={styles.awayProgressBar.borderTopRightRadius}
            />
            {/* Away Progress */}
            <Rect
              x="50%"
              y="0"
              width={`${awayBarWidth}%`}
              height={barHeight}
              fill={awayColor}
              rx={styles.awayProgressBar.borderTopRightRadius}
              ry={styles.awayProgressBar.borderTopRightRadius}
            />

            {/* Center Divider */}
            <Rect
              x="50%"
              y="0"
              width={styles.progressDivider.width}
              height={barHeight}
              fill={dividerColor}
              transform="translate(-1)" // Adjust to center the 2px divider
            />
          </Svg>
        </View>
      </View>

      <Text style={styles.statValue}>
        {awayValue}
        {isPercentage ? "%" : ""}
      </Text>
    </View>
  );
};
