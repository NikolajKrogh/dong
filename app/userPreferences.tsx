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
import LeagueSettings from "../components/preferences/LeagueSettings";
import OnboardingButton from "../components/preferences/OnboardingButton";
import AddLeagueModal from "../components/preferences/AddLeagueModal";
import ManageLeaguesModal from "../components/preferences/ManageLeaguesModal";
import SelectDefaultLeaguesModal from "../components/preferences/SelectDefaultLeaguesModal";

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
    defaultSelectedLeagues,
    setDefaultSelectedLeagues,
  } = useGameStore();

  const insets = useSafeAreaInsets();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAddLeagueModal, setShowAddLeagueModal] = useState(false);
  const [showManageLeaguesModal, setShowManageLeaguesModal] = useState(false);
  const [showSelectDefaultLeaguesModal, setShowSelectDefaultLeaguesModal] =
    useState(false); // State for the new modal

  // State for AddLeagueModal specifically
  const [leaguesForAddingModal, setLeaguesForAddingModal] = useState<
    LeagueEndpoint[]
  >([]);
  const [searchQueryForAddingModal, setSearchQueryForAddingModal] =
    useState("");

  /**
   * @brief Navigates back to the previous screen.
   */
  const goBack = () => {
    router.push("../");
  };

  /**
   * @brief Toggles the selection state of a league for the AddLeagueModal.
   */
  const toggleLeagueSelectionForAdding = (league: LeagueEndpoint) => {
    setLeaguesForAddingModal((prevSelected) =>
      prevSelected.some((l) => l.code === league.code)
        ? prevSelected.filter((l) => l.code !== league.code)
        : [...prevSelected, league]
    );
  };

  /**
   * @brief Handles the addition of selected leagues from the AddLeagueModal.
   */
  const handleAddSelectedLeaguesFromModal = () => {
    leaguesForAddingModal.forEach((leagueToAdd) => addLeague(leagueToAdd)); // Use addLeague from store
    setLeaguesForAddingModal([]);
    setSearchQueryForAddingModal(""); // Reset search query
    setShowAddLeagueModal(false);
  };

  /**
   * @brief Handles saving the selected default leagues.
   */
  const handleSaveDefaultLeagues = (newDefaults: LeagueEndpoint[]) => {
    setDefaultSelectedLeagues(newDefaults);
    setShowSelectDefaultLeaguesModal(false);
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

        <LeagueSettings
          configuredLeagues={configuredLeagues}
          onManageLeaguesPress={() => setShowManageLeaguesModal(true)}
          onAddLeaguesPress={() => {
            setLeaguesForAddingModal([]); // Reset for AddLeagueModal
            setSearchQueryForAddingModal(""); // Reset for AddLeagueModal
            setShowAddLeagueModal(true);
          }}
          defaultSelectedLeagues={defaultSelectedLeagues}
          onSetDefaultLeaguesPress={() =>
            setShowSelectDefaultLeaguesModal(true)
          }
        />

        <OnboardingButton onPress={() => setShowOnboarding(true)} />
      </ScrollView>

      <AddLeagueModal
        visible={showAddLeagueModal}
        onClose={() => {
          setShowAddLeagueModal(false);
          setSearchQueryForAddingModal(""); // Reset search on close
        }}
        configuredLeagues={configuredLeagues}
        selectedLeagues={leaguesForAddingModal}
        setSelectedLeagues={setLeaguesForAddingModal}
        toggleLeagueSelection={toggleLeagueSelectionForAdding}
        handleAddSelectedLeagues={handleAddSelectedLeaguesFromModal}
        searchQuery={searchQueryForAddingModal}
        setSearchQuery={setSearchQueryForAddingModal}
      />

      <ManageLeaguesModal
        visible={showManageLeaguesModal}
        onClose={() => setShowManageLeaguesModal(false)}
        configuredLeagues={configuredLeagues}
        removeLeague={removeLeague} // removeLeague from store is passed here
        resetLeaguesToDefaults={resetLeaguesToDefaults} // resetLeaguesToDefaults from store
      />

      <SelectDefaultLeaguesModal
        visible={showSelectDefaultLeaguesModal}
        onClose={() => setShowSelectDefaultLeaguesModal(false)}
        configuredLeagues={configuredLeagues}
        currentDefaultLeagues={defaultSelectedLeagues}
        onSave={handleSaveDefaultLeagues}
      />
    </SafeAreaView>
  );
};

export default UserPreferencesScreen;
