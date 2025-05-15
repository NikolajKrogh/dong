import React, { useState } from "react";
import { ScrollView, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingScreen from "../components/OnboardingScreen";
import { LeagueEndpoint } from "../constants/leagues";
import { commonStyles } from "./style/userPreferencesStyles";

import Header from "../components/preferences/Header";
import SoundNotificationSettings from "../components/preferences/SoundNotificationSettings";
import DataSourcesSettings from "../components/preferences/DataSourcesSettings";
import OnboardingButton from "../components/preferences/OnboardingButton";
import AddLeagueModal from "../components/preferences/AddLeagueModal";
import ManageLeaguesModal from "../components/preferences/ManageLeaguesModal";

/**
 * @brief UserPreferencesScreen component.
 *
 * This component renders the user preferences screen, allowing users to
 * configure sound notifications, manage data sources (leagues), and view the
 * onboarding screen.
 *
 * @returns {JSX.Element} The rendered UserPreferencesScreen.
 */
const UserPreferencesScreen = () => {
  const router = useRouter();
  const {
    soundEnabled,
    setSoundEnabled,
    commonMatchNotificationsEnabled,
    setCommonMatchNotificationsEnabled,
    configuredLeagues,
    addLeague,
    removeLeague,
    resetLeaguesToDefaults,
  } = useGameStore();

  const insets = useSafeAreaInsets();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAddLeagueModal, setShowAddLeagueModal] = useState(false);
  const [showManageLeaguesModal, setShowManageLeaguesModal] = useState(false);
  const [selectedLeagues, setSelectedLeagues] = useState<LeagueEndpoint[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * @brief Navigates back to the previous screen.
   */
  const goBack = () => {
    router.push("../");
  };

  /**
   * @brief Toggles the selection state of a league.
   *
   * If the league is already selected, it is removed from the selection.
   * Otherwise, it is added to the selection.
   *
   * @param {LeagueEndpoint} league The league to toggle.
   */
  const toggleLeagueSelection = (league: LeagueEndpoint) => {
    if (selectedLeagues.some((l) => l.code === league.code)) {
      setSelectedLeagues(selectedLeagues.filter((l) => l.code !== league.code));
    } else {
      setSelectedLeagues([...selectedLeagues, league]);
    }
  };

  /**
   * @brief Handles the addition of selected leagues.
   *
   * Adds all selected leagues to the configured leagues, clears the selection,
   * and closes the "Add League" modal.
   */
  const handleAddSelectedLeagues = () => {
    selectedLeagues.forEach((league) => addLeague(league));
    setSelectedLeagues([]);
    setShowAddLeagueModal(false);
  };

  if (showOnboarding) {
    return <OnboardingScreen onFinish={() => setShowOnboarding(false)} />;
  }

  return (
    <SafeAreaView style={commonStyles.safeArea}>
      <Header title="Settings" onBack={goBack} paddingTop={insets.top} />

      <ScrollView
        style={commonStyles.container}
        contentContainerStyle={commonStyles.contentContainer}
      >
        <SoundNotificationSettings
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          commonMatchNotificationsEnabled={commonMatchNotificationsEnabled}
          setCommonMatchNotificationsEnabled={
            setCommonMatchNotificationsEnabled
          }
        />

        <DataSourcesSettings
          configuredLeagues={configuredLeagues}
          onManageLeagues={() => setShowManageLeaguesModal(true)}
        />

        <OnboardingButton onPress={() => setShowOnboarding(true)} />
      </ScrollView>

      <AddLeagueModal
        visible={showAddLeagueModal}
        onClose={() => setShowAddLeagueModal(false)}
        configuredLeagues={configuredLeagues}
        selectedLeagues={selectedLeagues}
        toggleLeagueSelection={toggleLeagueSelection}
        handleAddSelectedLeagues={handleAddSelectedLeagues}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <ManageLeaguesModal
        visible={showManageLeaguesModal}
        onClose={() => setShowManageLeaguesModal(false)}
        configuredLeagues={configuredLeagues}
        removeLeague={removeLeague}
        resetLeaguesToDefaults={resetLeaguesToDefaults}
        onAddLeague={() => setShowAddLeagueModal(true)}
      />
    </SafeAreaView>
  );
};

export default UserPreferencesScreen;