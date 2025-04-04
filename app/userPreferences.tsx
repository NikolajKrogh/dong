import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "./store";

const UserPreferencesScreen = () => {
  const router = useRouter();
  const { soundEnabled, setSoundEnabled } = useGameStore();

  return (
    <View style={[styles.safeArea, { paddingTop: 22 }]}>
      <View style={styles.container}>
        <Text style={styles.title}>User Preferences</Text>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Enable Sound</Text>
          <Switch
            value={soundEnabled}
            onValueChange={(value) => setSoundEnabled(value)}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#333",
  },
  preferenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  preferenceLabel: {
    fontSize: 18,
    color: "#333",
  },
});

export default UserPreferencesScreen;
