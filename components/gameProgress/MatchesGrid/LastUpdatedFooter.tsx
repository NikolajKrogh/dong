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
            <Ionicons name="sync" size={14} color="#666" />
          </Animated.View>
        ) : (
          <Ionicons name="time-outline" size={14} color="#666" />
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
    backgroundColor: "#f9f9f9",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pillRefreshing: {
    backgroundColor: "#f0f0f0",
    borderColor: "#e0e0e0",
    borderWidth: 1,
  },
  timeText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#28a745",
    marginLeft: 4,
  },
});

export default React.memo(LastUpdatedFooter);
