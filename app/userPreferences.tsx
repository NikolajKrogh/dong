import React, { useMemo, useState } from "react";
import { ScrollView, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingScreen from "../components/OnboardingScreen";
import { LeagueEndpoint } from "../constants/leagues";
import { createUserPreferencesStyles } from "./style/userPreferencesStyles";

import Header from "../components/preferences/Header";
import SoundNotificationSettings from "../components/preferences/SoundNotificationSettings";
import LeagueSettings from "../components/preferences/LeagueSettings";
import OnboardingButton from "../components/preferences/OnboardingButton";
import AddLeagueModal from "../components/preferences/AddLeagueModal";
import ManageLeaguesModal from "../components/preferences/ManageLeaguesModal";
import SelectDefaultLeaguesModal from "../components/preferences/SelectDefaultLeaguesModal";
import AppearanceSettings from "../components/preferences/AppearanceSettings";
import { useColors } from "./style/theme";

/**
 * User preferences screen for configuring notifications, leagues, appearance, and onboarding.
 * @component
 * @returns {JSX.Element} Preferences screen element.
 * @description Provides toggles for sound & common match notifications, league management (add/remove/reset & default selection), appearance theme controls, and access to onboarding. Uses multiple modals coordinated via local state.
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
  const colors = useColors();
  const { commonStyles } = useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
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

  /** Navigate back to previous screen. */
  const goBack = () => {
    router.push("../");
  };

  /** Toggle selection of a league in AddLeagueModal multi-select state. */
  const toggleLeagueSelectionForAdding = (league: LeagueEndpoint) => {
    setLeaguesForAddingModal((prevSelected) =>
      prevSelected.some((l) => l.code === league.code)
        ? prevSelected.filter((l) => l.code !== league.code)
        : [...prevSelected, league]
    );
  };

  /** Add all currently selected leagues (batch) then reset modal selection state. */
  const handleAddSelectedLeaguesFromModal = () => {
    leaguesForAddingModal.forEach((leagueToAdd) => addLeague(leagueToAdd)); // Use addLeague from store
    setLeaguesForAddingModal([]);
    setSearchQueryForAddingModal(""); // Reset search query
    setShowAddLeagueModal(false);
  };

  /** Persist selected default leagues and close modal. */
  const handleSaveDefaultLeagues = (newDefaults: LeagueEndpoint[]) => {
    setDefaultSelectedLeagues(newDefaults);
    setShowSelectDefaultLeaguesModal(false);
  };

  if (showOnboarding) {
    return <OnboardingScreen onFinish={() => setShowOnboarding(false)} />;
  }

  return (
    <SafeAreaView
      style={[commonStyles.safeArea, { backgroundColor: colors.background }]}
    >
      <Header title="Settings" onBack={goBack} paddingTop={insets.top} />

      <ScrollView
        style={[
          commonStyles.container,
          { backgroundColor: colors.backgroundLight },
        ]}
        contentContainerStyle={commonStyles.contentContainer}
      >
        <AppearanceSettings />
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
