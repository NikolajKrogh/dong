import React, { useState } from "react";

import AddLeagueModal from "../../components/preferences/AddLeagueModal";
import LeagueSettings from "../../components/preferences/LeagueSettings";
import ManageLeaguesModal from "../../components/preferences/ManageLeaguesModal";
import SelectDefaultLeaguesModal from "../../components/preferences/SelectDefaultLeaguesModal";
import SettingsPage from "../../components/preferences/SettingsPage";
import type { LeagueEndpoint } from "../../constants/leagues";
import { useGameStore } from "../../store/store";

export default function LeagueSettingsScreen() {
  const configuredLeagues = useGameStore((state) => state.configuredLeagues);
  const addLeague = useGameStore((state) => state.addLeague);
  const removeLeague = useGameStore((state) => state.removeLeague);
  const resetLeaguesToDefaults = useGameStore((state) => state.resetLeaguesToDefaults);
  const defaultSelectedLeagues = useGameStore((state) => state.defaultSelectedLeagues);
  const setDefaultSelectedLeagues = useGameStore((state) => state.setDefaultSelectedLeagues);

  const [showAddLeagueModal, setShowAddLeagueModal] = useState(false);
  const [showManageLeaguesModal, setShowManageLeaguesModal] = useState(false);
  const [showSelectDefaultLeaguesModal, setShowSelectDefaultLeaguesModal] = useState(false);
  const [leaguesForAddingModal, setLeaguesForAddingModal] = useState<LeagueEndpoint[]>([]);
  const [searchQueryForAddingModal, setSearchQueryForAddingModal] = useState("");

  return (
    <SettingsPage title="Leagues">
      <LeagueSettings
        showSectionTitle={false}
        configuredLeagues={configuredLeagues}
        onManageLeaguesPress={() => setShowManageLeaguesModal(true)}
        onAddLeaguesPress={() => {
          setLeaguesForAddingModal([]);
          setSearchQueryForAddingModal("");
          setShowAddLeagueModal(true);
        }}
        defaultSelectedLeagues={defaultSelectedLeagues}
        onSetDefaultLeaguesPress={() => setShowSelectDefaultLeaguesModal(true)}
      />
      <AddLeagueModal
        visible={showAddLeagueModal}
        onClose={() => {
          setShowAddLeagueModal(false);
          setSearchQueryForAddingModal("");
        }}
        configuredLeagues={configuredLeagues}
        selectedLeagues={leaguesForAddingModal}
        setSelectedLeagues={setLeaguesForAddingModal}
        toggleLeagueSelection={(league) => setLeaguesForAddingModal((selected) =>
          selected.some((item) => item.code === league.code)
            ? selected.filter((item) => item.code !== league.code)
            : [...selected, league],
        )}
        handleAddSelectedLeagues={() => {
          leaguesForAddingModal.forEach((league) => addLeague(league));
          setLeaguesForAddingModal([]);
          setSearchQueryForAddingModal("");
          setShowAddLeagueModal(false);
        }}
        searchQuery={searchQueryForAddingModal}
        setSearchQuery={setSearchQueryForAddingModal}
      />
      <ManageLeaguesModal
        visible={showManageLeaguesModal}
        onClose={() => setShowManageLeaguesModal(false)}
        configuredLeagues={configuredLeagues}
        removeLeague={removeLeague}
        resetLeaguesToDefaults={resetLeaguesToDefaults}
      />
      <SelectDefaultLeaguesModal
        visible={showSelectDefaultLeaguesModal}
        onClose={() => setShowSelectDefaultLeaguesModal(false)}
        configuredLeagues={configuredLeagues}
        currentDefaultLeagues={defaultSelectedLeagues}
        onSave={(selected) => {
          setDefaultSelectedLeagues(selected);
          setShowSelectDefaultLeaguesModal(false);
        }}
      />
    </SettingsPage>
  );
}
