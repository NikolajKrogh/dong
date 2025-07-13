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
import { colors } from "../../../app/style/palette";

/**
 * @brief A footer component displaying the last updated time and a refresh button.
 * - Shows the time of the last score update.
 * - Provides a button to manually trigger a refresh.
 * - Indicates when a refresh is in progress with a spinning icon.
 * - Shows a live indicator dot when polling is active.
 * @param {LastUpdatedFooterProps} props - The properties passed to the component.
 * @param {() => void} props.onRefresh - Callback function executed when the refresh button is pressed.
 * @param {boolean} props.refreshing - Indicates if a refresh operation is currently in progress.
 * @param {Date | null} props.lastUpdated - The timestamp of the last successful update. Null if no update has occurred.
 * @param {boolean} props.isPolling - Indicates if automatic polling for updates is active.
 * @returns {React.ReactElement} The rendered footer component.
 */
const LastUpdatedFooter: React.FC<LastUpdatedFooterProps> = ({
  onRefresh,
  refreshing,
  lastUpdated,
  isPolling,
}) => {
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

const styles = StyleSheet.create({
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
});

export default React.memo(LastUpdatedFooter);
