import React, { useMemo } from "react";
import { ScrollView, SafeAreaView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingScreen from "../components/OnboardingScreen";
import { createUserPreferencesStyles } from "./style/userPreferencesStyles";

import Header from "../components/preferences/Header";
import SoundNotificationSettings from "../components/preferences/SoundNotificationSettings";
import LeagueSettings from "../components/preferences/LeagueSettings";
import OnboardingButton from "../components/preferences/OnboardingButton";
import AddLeagueModal from "../components/preferences/AddLeagueModal";
import ManageLeaguesModal from "../components/preferences/ManageLeaguesModal";
import SelectDefaultLeaguesModal from "../components/preferences/SelectDefaultLeaguesModal";
import AppearanceSettings from "../components/preferences/AppearanceSettings";
import PlayerNameSettings from "../components/preferences/PlayerNameSettings";
import { useColors } from "./style/theme";
import useUserPreferencesLogic from "../hooks/useUserPreferencesLogic";

/**
 * User preferences screen for configuring notifications, leagues, appearance, and onboarding.
 * @component
 * @returns {JSX.Element} Preferences screen element.
 * @description Provides toggles for sound & common match notifications, league management (add/remove/reset & default selection), appearance theme controls, and access to onboarding. Uses multiple modals coordinated via local state.
 */
const UserPreferencesScreen = () => {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { commonStyles } = useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
  const {
    soundEnabled,
    setSoundEnabled,
    commonMatchNotificationsEnabled,
    setCommonMatchNotificationsEnabled,
    configuredLeagues,
    removeLeague,
    resetLeaguesToDefaults,
    defaultSelectedLeagues,
    handleSaveDefaultLeagues,
    playerName,
    setPlayerName,
    goBack,
    showOnboarding,
    openOnboarding,
    closeOnboarding,
    showAddLeagueModal,
    openAddLeagueModal,
    closeAddLeagueModal,
    leaguesForAddingModal,
    setLeaguesForAddingModal,
    toggleLeagueSelectionForAdding,
    handleAddSelectedLeaguesFromModal,
    searchQueryForAddingModal,
    setSearchQueryForAddingModal,
    showManageLeaguesModal,
    openManageLeaguesModal,
    closeManageLeaguesModal,
    showSelectDefaultLeaguesModal,
    openSelectDefaultLeaguesModal,
    closeSelectDefaultLeaguesModal,
  } = useUserPreferencesLogic();

  if (showOnboarding) {
    return <OnboardingScreen onFinish={closeOnboarding} />;
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

        <PlayerNameSettings playerName={playerName} onSave={setPlayerName} />

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
          onManageLeaguesPress={openManageLeaguesModal}
          onAddLeaguesPress={() => {
            openAddLeagueModal();
          }}
          defaultSelectedLeagues={defaultSelectedLeagues}
          onSetDefaultLeaguesPress={openSelectDefaultLeaguesModal}
        />

        <OnboardingButton onPress={openOnboarding} />
      </ScrollView>

      <AddLeagueModal
        visible={showAddLeagueModal}
        onClose={closeAddLeagueModal}
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
        onClose={closeManageLeaguesModal}
        configuredLeagues={configuredLeagues}
        removeLeague={removeLeague} // removeLeague from store is passed here
        resetLeaguesToDefaults={resetLeaguesToDefaults} // resetLeaguesToDefaults from store
      />

      <SelectDefaultLeaguesModal
        visible={showSelectDefaultLeaguesModal}
        onClose={closeSelectDefaultLeaguesModal}
        configuredLeagues={configuredLeagues}
        currentDefaultLeagues={defaultSelectedLeagues}
        onSave={handleSaveDefaultLeagues}
      />
    </SafeAreaView>
  );
};

export default UserPreferencesScreen;
