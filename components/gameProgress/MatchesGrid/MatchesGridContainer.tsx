import React, { useState } from "react";
import { View, FlatList, Dimensions } from "react-native";
import { MatchesGridProps, SortField, SortDirection } from "./types";
import { Match, Player } from "../../../store/store";
import { MatchWithScore } from "../../../hooks/useLiveScores";
import styles from "../../../app/style/gameProgressStyles";

import MatchesHeader from "./MatchesHeader";
import SortModal from "./SortModal";
import MatchGridItem from "./MatchGridItem";
import MatchListItem from "./MatchListItem";
import LastUpdatedFooter from "./LastUpdatedFooter";

/**
 * @component MatchesGridContainer
 * @brief Main container component that manages state and coordinates child components
 * @param {MatchesGridProps} props - The properties for the component.
 */
const MatchesGridContainer: React.FC<MatchesGridProps> = ({
  matches,
  players,
  commonMatchId,
  playerAssignments,
  openQuickActions,
  liveMatches = [],
  refreshControl,
  onRefresh,
  refreshing,
  lastUpdated,
  isPolling,
}) => {
  // State to track layout mode
  const [useGridLayout, setUseGridLayout] = useState(false);
  // State for sorting options
  const [sortField, setSortField] = useState<SortField>("homeTeam");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  // State for sort options modal
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Calculate number of columns based on screen width
  const screenWidth = Dimensions.get("window").width;
  const numColumns = useGridLayout ? (screenWidth > 600 ? 3 : 2) : 1;

  /**
   * @brief Toggles the display mode between grid and list layouts.
   */
  const toggleLayoutMode = () => {
    setUseGridLayout(!useGridLayout);
  };

  /**
   * @brief Changes the sort field and toggles direction if same field is selected
   */
  const changeSortOption = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
    setSortModalVisible(false);
  };

  /**
   * @brief Gets the sorted list of players for a match
   * @param {Match} match - The match to get players for
   * @returns {Player[]} The sorted list of players assigned to the match
   */
  const getSortedPlayersForMatch = (match: Match): Player[] => {
    return players
      .filter(
        (player) =>
          match.id === commonMatchId ||
          (playerAssignments[player.id] &&
            playerAssignments[player.id].includes(match.id))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  /**
   * @brief Retrieves live match information for a given match ID.
   * @param {string} matchId - The ID of the match to find live info for.
   * @returns {MatchWithScore | undefined} The live match data or undefined if not found.
   */
  const getLiveMatchInfo = (matchId: string): MatchWithScore | undefined => {
    return liveMatches.find((m) => m.id === matchId);
  };

  /**
   * @brief Memoized sorted list of matches.
   * Sorts matches based on selected sort field and direction.
   */
  const sortedMatches = React.useMemo(() => {
    return [...matches].sort((a, b) => {
      // Always prioritize common match first regardless of sort settings
      if (a.id === commonMatchId) return -1;
      if (b.id === commonMatchId) return 1;

      // Get player information for sorting by player name
      const playersA = getSortedPlayersForMatch(a);
      const playersB = getSortedPlayersForMatch(b);

      // Apply sorting based on selected field
      let comparison: number;

      if (sortField === "homeTeam") {
        comparison = a.homeTeam.localeCompare(b.homeTeam);
      } else if (sortField === "awayTeam") {
        comparison = a.awayTeam.localeCompare(b.awayTeam);
      } else {
        // playerName
        // Sort by first player name alphabetically or empty string if no players
        const firstPlayerNameA = playersA.length > 0 ? playersA[0].name : "";
        const firstPlayerNameB = playersB.length > 0 ? playersB[0].name : "";
        comparison = firstPlayerNameA.localeCompare(firstPlayerNameB);
      }

      // Apply sort direction
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    matches,
    commonMatchId,
    sortField,
    sortDirection,
    players,
    playerAssignments,
  ]);

  const renderItem = ({ item }: { item: Match }) => {
    const assignedPlayers = getSortedPlayersForMatch(item);
    const liveMatch = getLiveMatchInfo(item.id);

    return useGridLayout ? (
      <MatchGridItem
        match={item}
        commonMatchId={commonMatchId}
        assignedPlayers={assignedPlayers}
        liveMatch={liveMatch}
        openQuickActions={openQuickActions}
      />
    ) : (
      <MatchListItem
        match={item}
        commonMatchId={commonMatchId}
        assignedPlayers={assignedPlayers}
        liveMatch={liveMatch}
        openQuickActions={openQuickActions}
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header with title, refresh status, and layout toggle */}
      <MatchesHeader
        sortField={sortField}
        sortDirection={sortDirection}
        useGridLayout={useGridLayout}
        setSortModalVisible={setSortModalVisible}
        toggleLayoutMode={toggleLayoutMode}
      />

      {/* Sort options modal */}
      <SortModal
        visible={sortModalVisible}
        sortField={sortField}
        sortDirection={sortDirection}
        onClose={() => setSortModalVisible(false)}
        onSortChange={changeSortOption}
      />

      {/* Match list container */}
      <View style={{ flex: 1 }}>
        <FlatList
          refreshControl={refreshControl}
          key={`matches-${
            useGridLayout ? "grid" : "list"
          }-${numColumns}-${sortField}-${sortDirection}`}
          data={sortedMatches}
          keyExtractor={(item) => item.id}
          numColumns={useGridLayout ? numColumns : 1}
          renderItem={renderItem}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={useGridLayout ? styles.gridRow : undefined}
          ListFooterComponent={
            <LastUpdatedFooter
              onRefresh={onRefresh}
              refreshing={refreshing}
              lastUpdated={lastUpdated}
              isPolling={isPolling}
            />
          }
        />
      </View>
    </View>
  );
};

export default MatchesGridContainer;
