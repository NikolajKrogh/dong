import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OnboardingScreen from "../components/OnboardingScreen";
import { LeagueEndpoint } from "../constants/leagues";
import { useGameStore } from "../store/store";

import AddLeagueModal from "../components/preferences/AddLeagueModal";
import AppearanceSettings from "../components/preferences/AppearanceSettings";
import Header from "../components/preferences/Header";
import LeagueSettings from "../components/preferences/LeagueSettings";
import ManageLeaguesModal from "../components/preferences/ManageLeaguesModal";
import OnboardingButton from "../components/preferences/OnboardingButton";
import SelectDefaultLeaguesModal from "../components/preferences/SelectDefaultLeaguesModal";
import SoundNotificationSettings from "../components/preferences/SoundNotificationSettings";
import { ShellScreen } from "../components/ui";
import { isWideLayout } from "./style/responsive";
import { useColors } from "./style/theme";

/**
 * User preferences screen for configuring notifications, leagues, appearance, and onboarding.
 * @component
 * @returns {JSX.Element} Preferences screen element.
 * @description Provides toggles for sound & common match notifications, league management (add/remove/reset & default selection), appearance theme controls, and access to onboarding. Uses multiple modals coordinated via local state.
 */
const UserPreferencesScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
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

  const colors = useColors();
  const wideLayout = isWideLayout(width);
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
        : [...prevSelected, league],
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
    <ShellScreen
      padded={false}
      centerContent={wideLayout}
      contentMaxWidth={wideLayout ? 960 : undefined}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Settings" onBack={goBack} />

        <ScrollView
          testID="UserPreferencesContent"
          style={{ flex: 1, backgroundColor: colors.backgroundLight }}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: 24,
          }}
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
    </ShellScreen>
  );
};

export default UserPreferencesScreen;
