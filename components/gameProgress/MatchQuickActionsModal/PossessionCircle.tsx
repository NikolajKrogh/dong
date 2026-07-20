import React, { useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useColors } from "../../../app/style/theme";
import { describeArc } from "../../../utils/svgArc";
import { createStyles } from "./styles";

/**
 * Doughnut possession chart (home vs away) rendered with two opposing arc paths.
 * @param {{homeValue:number, awayValue:number}} props Component props.
 * @returns {JSX.Element} Possession visualization.
 */
export const PossessionCircle = ({
  homeValue,
  awayValue,
}: {
  homeValue: number;
  awayValue: number;
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const total = homeValue + awayValue;
  const normalizedHome = total > 0 ? Math.round((homeValue / total) * 100) : 0;
  const normalizedAway = total > 0 ? Math.round((awayValue / total) * 100) : 0;

  const size = 90; // Diameter of the doughnut
  const strokeWidth = 18; // Thickness of the doughnut ring
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const homeColor = colors.primary;
  const awayColor = colors.awayTeam;
  const trackColor = colors.borderLight; // Background track color

  const homeAngle = (normalizedHome / 100) * 360;
  const awayAngle = (normalizedAway / 100) * 360;

  // Path for the background track (full circle)
  const trackPath = describeArc(cx, cy, radius, 0, 359.99);

  // Path for home team's possession - counter-clockwise from 0
  const homeArcPath =
    homeAngle > 0
      ? describeArc(cx, cy, radius, 0, -homeAngle, true) // Negative angle for counter-clockwise
      : "";

  // Path for away team's possession - clockwise from 0
  const awayArcPath =
    awayAngle > 0 ? describeArc(cx, cy, radius, 0, awayAngle) : "";

  return (
    <View style={styles.possessionContainer}>
      <Text style={styles.statValue}>{normalizedHome}%</Text>

      <View style={styles.possessionCircleContainer}>
        <Text style={styles.statProgressLabel}>Possession</Text>
        <View style={styles.circleWrapper}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path
              d={trackPath}
              stroke={trackColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {homeArcPath ? (
              <Path
                d={homeArcPath}
                stroke={homeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            ) : null}
            {awayArcPath ? (
              <Path
                d={awayArcPath}
                stroke={awayColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            ) : null}
          </Svg>
        </View>
      </View>

      <Text style={styles.statValue}>{normalizedAway}%</Text>
    </View>
  );
};
