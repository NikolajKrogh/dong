import React, { useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingScreen from "../components/OnboardingScreen";

const UserPreferencesScreen = () => {
  const router = useRouter();
  const {
    soundEnabled,
    setSoundEnabled,
    commonMatchNotificationsEnabled,
    setCommonMatchNotificationsEnabled,
  } = useGameStore();
  const insets = useSafeAreaInsets();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const goBack = () => {
    router.push("../");
  };

  if (showOnboarding) {
    return <OnboardingScreen onFinish={() => setShowOnboarding(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0275d8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Sound Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sound & Notifications</Text>

          <View style={styles.card}>
            <View style={styles.preferenceRow}>
              <View style={styles.labelContainer}>
                <Ionicons
                  name="volume-high-outline"
                  size={22}
                  color="#555"
                  style={styles.prefIcon}
                />
                <Text style={styles.preferenceLabel}>Enable Sound</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={(value) => setSoundEnabled(value)}
                trackColor={{ false: "#d1d1d1", true: "#a3c9f0" }}
                thumbColor={soundEnabled ? "#0275d8" : "#f4f3f4"}
                ios_backgroundColor="#d1d1d1"
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.labelContainer}>
                <Ionicons
                  name="football-outline"
                  size={22}
                  color="#555"
                  style={styles.prefIcon}
                />
                <Text style={styles.preferenceLabel}>
                  Common Match Notifications
                </Text>
              </View>
              <Switch
                value={commonMatchNotificationsEnabled}
                onValueChange={(value) =>
                  setCommonMatchNotificationsEnabled(value)
                }
                trackColor={{ false: "#d1d1d1", true: "#a3c9f0" }}
                thumbColor={
                  commonMatchNotificationsEnabled ? "#0275d8" : "#f4f3f4"
                }
                ios_backgroundColor="#d1d1d1"
              />
            </View>
          </View>
        </View>

        {/* Button to display OnboardingScreen */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.onboardingButton}
            onPress={() => setShowOnboarding(true)}
          >
            <Ionicons name="help-circle-outline" size={22} color="#fff" />
            <Text style={styles.onboardingButtonText}>View Onboarding</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212529",
    marginLeft: 12,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6c757d",
    marginBottom: 8,
    paddingLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2.5,
    elevation: 2,
  },
  preferenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  prefIcon: {
    marginRight: 12,
  },
  preferenceLabel: {
    fontSize: 16,
    color: "#212529",
    flex: 1,
  },
  versionContainer: {
    marginTop: 32,
    alignItems: "center",
  },
  versionText: {
    fontSize: 12,
    color: "#adb5bd",
  },
  onboardingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0275d8",
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  onboardingButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default UserPreferencesScreen;
