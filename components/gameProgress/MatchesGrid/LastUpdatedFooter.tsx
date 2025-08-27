import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LastUpdatedFooterProps } from "./types";
import { useColors } from "../../../app/style/theme";

/**
 * Footer showing last update time with manual refresh and live polling indicators.
 * @component
 * @param {LastUpdatedFooterProps} props Component props.
 * @param {() => void} props.onRefresh Triggered when the refresh pill is pressed.
 * @param {boolean} props.refreshing True while a refresh request is in progress.
 * @param {Date | null} props.lastUpdated Timestamp of last successful update, or null if none yet.
 * @param {boolean} props.isPolling True when automatic polling is active (shows live dot).
 * @returns {React.ReactElement} Rendered footer element.
 * @description Displays a compact pill containing either a spinning refresh icon (while refreshing) or a time icon plus the last updated time formatted as HH:MM. When polling is active and not currently refreshing, a green live dot is rendered to indicate ongoing background updates.
 */
const LastUpdatedFooter: React.FC<LastUpdatedFooterProps> = ({
  onRefresh,
  refreshing,
  lastUpdated,
  isPolling,
}) => {
  const colors = useColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        footerContainer: {
          alignItems: "center",
          paddingVertical: 20,
          width: "100%",
        },
        pill: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.backgroundLight,
          borderRadius: 20,
          paddingVertical: 6,
          paddingHorizontal: 12,
          elevation: 3,
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
        pillRefreshing: {
          backgroundColor: colors.backgroundSubtle,
          borderColor: colors.borderLight,
          borderWidth: 1,
        },
        timeText: {
          fontSize: 13,
          color: colors.textMuted,
          marginLeft: 4,
        },
        liveDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.success,
          marginLeft: 4,
        },
      }),
    [colors]
  );
  // Keep animation for refresh indicator
  const spinValue = React.useRef(new Animated.Value(0)).current;

  // Create rotation animation when refreshing state changes
  React.useEffect(() => {
    if (refreshing) {
      // Start rotation animation
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      // Stop animation
      spinValue.setValue(0);
      // Ensure the loop is stopped explicitly if it was running
      spinValue.stopAnimation();
    }
  }, [refreshing, spinValue]);

  // Create interpolated rotation value
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.footerContainer}>
      <TouchableOpacity
        style={[styles.pill, refreshing && styles.pillRefreshing]}
        onPress={onRefresh}
        activeOpacity={0.6}
        disabled={refreshing}
      >
        {refreshing ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync" size={14} color={colors.textMuted} />
          </Animated.View>
        ) : (
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
        )}

        <Text style={styles.timeText}>
          {refreshing
            ? "Refreshing..."
            : lastUpdated
            ? lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--"}
        </Text>
        {isPolling && !refreshing && <View style={styles.liveDot} />}
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(LastUpdatedFooter);
