/**
 * @file useUserPreferencesLogic.ts
 * @description Centralises modal state, navigation, and league preference helpers for the user preferences screen.
 */
import React from "react";
import { useRouter } from "expo-router";
import { useGameStore } from "../store/store";
import { LeagueEndpoint } from "../constants/leagues";

/**
 * Values and callbacks consumed by the user preferences presenter component.
 */
export interface UserPreferencesHookResult {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  commonMatchNotificationsEnabled: boolean;
  setCommonMatchNotificationsEnabled: (enabled: boolean) => void;
  configuredLeagues: LeagueEndpoint[];
  addLeague: (league: LeagueEndpoint) => void;
  removeLeague: (code: string) => void;
  resetLeaguesToDefaults: () => void;
  defaultSelectedLeagues: LeagueEndpoint[];
  handleSaveDefaultLeagues: (newDefaults: LeagueEndpoint[]) => void;
  playerName: string | null;
  setPlayerName: (name: string | null) => void;
  goBack: () => void;
  showOnboarding: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  showAddLeagueModal: boolean;
  openAddLeagueModal: () => void;
  closeAddLeagueModal: () => void;
  leaguesForAddingModal: LeagueEndpoint[];
  setLeaguesForAddingModal: React.Dispatch<
    React.SetStateAction<LeagueEndpoint[]>
  >;
  toggleLeagueSelectionForAdding: (league: LeagueEndpoint) => void;
  handleAddSelectedLeaguesFromModal: () => void;
  searchQueryForAddingModal: string;
  setSearchQueryForAddingModal: React.Dispatch<React.SetStateAction<string>>;
  showManageLeaguesModal: boolean;
  openManageLeaguesModal: () => void;
  closeManageLeaguesModal: () => void;
  showSelectDefaultLeaguesModal: boolean;
  openSelectDefaultLeaguesModal: () => void;
  closeSelectDefaultLeaguesModal: () => void;
}

/**
 * Exposes state and handlers required by the preferences UI, including league selection flows, onboarding toggles, and navigation.
 * @returns {UserPreferencesHookResult} Preference data and callbacks for the presenter layer.
 */
const useUserPreferencesLogic = (): UserPreferencesHookResult => {
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
    playerName,
    setPlayerName,
  } = useGameStore();

  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [showAddLeagueModal, setShowAddLeagueModal] = React.useState(false);
  const [showManageLeaguesModal, setShowManageLeaguesModal] =
    React.useState(false);
  const [showSelectDefaultLeaguesModal, setShowSelectDefaultLeaguesModal] =
    React.useState(false);
  const [leaguesForAddingModal, setLeaguesForAddingModal] = React.useState<
    LeagueEndpoint[]
  >([]);
  const [searchQueryForAddingModal, setSearchQueryForAddingModal] =
    React.useState("");

  const goBack = React.useCallback(() => {
    router.push("../");
  }, [router]);

  const openOnboarding = React.useCallback(() => {
    setShowOnboarding(true);
  }, []);

  const closeOnboarding = React.useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const openAddLeagueModal = React.useCallback(() => {
    setLeaguesForAddingModal([]);
    setSearchQueryForAddingModal("");
    setShowAddLeagueModal(true);
  }, []);

  const closeAddLeagueModal = React.useCallback(() => {
    setShowAddLeagueModal(false);
    setSearchQueryForAddingModal("");
  }, []);

  const toggleLeagueSelectionForAdding = React.useCallback(
    (league: LeagueEndpoint) => {
      setLeaguesForAddingModal((prevSelected) =>
        prevSelected.some((item) => item.code === league.code)
          ? prevSelected.filter((item) => item.code !== league.code)
          : [...prevSelected, league]
      );
    },
    []
  );

  const handleAddSelectedLeaguesFromModal = React.useCallback(() => {
    leaguesForAddingModal.forEach((leagueToAdd) => addLeague(leagueToAdd));
    setLeaguesForAddingModal([]);
    setSearchQueryForAddingModal("");
    setShowAddLeagueModal(false);
  }, [addLeague, leaguesForAddingModal]);

  const openManageLeaguesModal = React.useCallback(() => {
    setShowManageLeaguesModal(true);
  }, []);

  const closeManageLeaguesModal = React.useCallback(() => {
    setShowManageLeaguesModal(false);
  }, []);

  const openSelectDefaultLeaguesModal = React.useCallback(() => {
    setShowSelectDefaultLeaguesModal(true);
  }, []);

  const closeSelectDefaultLeaguesModal = React.useCallback(() => {
    setShowSelectDefaultLeaguesModal(false);
  }, []);

  const handleSaveDefaultLeagues = React.useCallback(
    (newDefaults: LeagueEndpoint[]) => {
      setDefaultSelectedLeagues(newDefaults);
      setShowSelectDefaultLeaguesModal(false);
    },
    [setDefaultSelectedLeagues]
  );

  return {
    soundEnabled,
    setSoundEnabled,
    commonMatchNotificationsEnabled,
    setCommonMatchNotificationsEnabled,
    configuredLeagues,
    addLeague,
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
  };
};

export default useUserPreferencesLogic;
