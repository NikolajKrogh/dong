import React, { useState } from "react";
import { View, FlatList, Dimensions } from "react-native";
import { MatchesGridProps, SortField, SortDirection } from "./types";
import { Match, Player } from "../../../store/store";
import { MatchWithScore } from "../../../hooks/useLiveScores";
import { createGameProgressStyles } from "../../../app/style/gameProgressStyles";
import { useColors } from "../../../app/style/theme";

import MatchesHeader from "./MatchesHeader";
import SortModal from "./SortModal";
import MatchGridItem from "./MatchGridItem";
import MatchListItem from "./MatchListItem";
import LastUpdatedFooter from "./LastUpdatedFooter";

/**
 * Main container that manages match rendering (grid or list), sorting, and integration of player assignments & live scores.
 * @component
 * @param {MatchesGridProps} props Component props.
 * @description Coordinates layout mode toggling (grid/list), sorting by team or player,
 * pins the common match at the top, and supplies each row/card with its players and live match data.
 * Also wires up refresh / last updated footer metadata.
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
  const colors = useColors();
  const styles = React.useMemo(
    () => createGameProgressStyles(colors),
    [colors]
  );
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
   * Toggles between grid and list layout modes.
   */
  const toggleLayoutMode = () => {
    setUseGridLayout(!useGridLayout);
  };

  /**
   * Changes the active sort field or toggles direction when the same field is re-selected.
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
   * Returns alphabetically sorted players assigned to a specific match (or all players if it's the common match).
   * @param {Match} match The match to retrieve players for.
   * @returns {Player[]} Sorted player array.
   * @description Filters players based on assignment mapping unless the match is the common match (then includes all).
   * Result is sorted by player name for deterministic ordering.
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
   * Retrieves live score data for a given match ID if available.
   * @param {string} matchId Match identifier.
   * @returns {MatchWithScore | undefined} Live match info or undefined.
   */
  const getLiveMatchInfo = (matchId: string): MatchWithScore | undefined => {
    return liveMatches.find((m) => m.id === matchId);
  };

  /**
   * Memoized array of matches sorted per current field & direction with the common match pinned at the top.
   * @description Sorting prioritizes the common match first, then applies the selected criterion
   * (home team, away team, or first assigned player name) with chosen direction.
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
