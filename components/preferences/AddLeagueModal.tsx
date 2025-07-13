import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  FlatList,
  Image,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  manageLeaguesModalStyles,
  addLeagueModalStyles,
} from "../../app/style/userPreferencesStyles";
import { colors } from "../../app/style/palette";
import {
  AVAILABLE_LEAGUES,
  LEAGUE_CATEGORIES,
  LeagueEndpoint,
} from "../../constants/leagues";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";

/**
 * @interface AddLeagueModalProps
 * @brief Props for the AddLeagueModal component.
 */
interface AddLeagueModalProps {
  /** @brief Whether the modal is visible. */
  visible: boolean;
  /** @brief Function to call when the modal is closed. */
  onClose: () => void;
  /** @brief Array of currently configured leagues. */
  configuredLeagues: LeagueEndpoint[];
  /** @brief Array of currently selected leagues. */
  selectedLeagues: LeagueEndpoint[];
  /**
   * @brief Function to set the selected leagues.
   * @param leagues The new array of selected leagues.
   */
  setSelectedLeagues: (leagues: LeagueEndpoint[]) => void;
  /**
   * @brief Function to toggle the selection state of a league.
   * @param league The league to toggle.
   */
  toggleLeagueSelection: (league: LeagueEndpoint) => void;
  /** @brief Function to handle the addition of selected leagues. */
  handleAddSelectedLeagues: () => void;
  /** @brief The current search query. */
  searchQuery: string;
  /**
   * @brief Function to set the search query.
   * @param query The new search query.
   */
  setSearchQuery: (query: string) => void;
}

/**
 * @brief LeagueItem component.
 *
 * Displays a single league item with its logo, name, and selection status.
 *
 * @param league The league data to display.
 * @param isSelected Whether the league is currently selected.
 * @param onPress Function to call when the league item is pressed.
 * @returns {JSX.Element} The rendered LeagueItem.
 */
const LeagueItem = ({
  league,
  isSelected,
  onPress,
}: {
  league: LeagueEndpoint;
  isSelected: boolean;
  onPress: () => void;
}) => {
  const { logoSource, isLoading } = useLeagueLogo(league.name, league.code);

  return (
    <TouchableOpacity
      style={[
        addLeagueModalStyles.availableLeagueItem,
        isSelected && addLeagueModalStyles.selectedLeagueItem,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Logo section */}
      <View style={addLeagueModalStyles.leagueLogoContainer}>
        {isLoading ? (
          <View
            style={[
              addLeagueModalStyles.leagueLogo,
              { backgroundColor: colors.backgroundSubtle },
            ]}
          >
            <Ionicons
              name="hourglass-outline"
              size={16}
              color={colors.textMuted}
            />
          </View>
        ) : logoSource ? (
          <Image
            source={logoSource}
            style={addLeagueModalStyles.leagueLogo}
            resizeMode="contain"
          />
        ) : (
          <View
            style={[
              addLeagueModalStyles.leagueLogo,
              { backgroundColor: colors.backgroundSubtle },
            ]}
          >
            <Ionicons
              name="football-outline"
              size={16}
              color={colors.textMuted}
            />
          </View>
        )}
      </View>

      <View style={addLeagueModalStyles.leagueItemContent}>
        <View style={{ justifyContent: "center", minHeight: 32 }}>
          <Text style={addLeagueModalStyles.availableLeagueName}>
            {league.name}
          </Text>
        </View>
      </View>

      <Ionicons
        name={isSelected ? "checkmark-circle" : "add-circle-outline"}
        size={22}
        color={isSelected ? colors.success : colors.secondary}
      />
    </TouchableOpacity>
  );
};

/**
 * @brief AddLeagueModal component.
 *
 * A modal component for adding new leagues to the configured leagues.
 * Allows users to search for leagues, filter by category, and select leagues to add.
 *
 * @param visible Whether the modal is visible.
 * @param onClose Function to call when the modal is closed.
 * @param configuredLeagues Array of currently configured leagues.
 * @param selectedLeagues Array of currently selected leagues.
 * @param toggleLeagueSelection Function to toggle the selection state of a league.
 * @param handleAddSelectedLeagues Function to handle the addition of selected leagues.
 * @param searchQuery The current search query.
 * @param setSearchQuery Function to set the search query.
 * @returns {JSX.Element} The rendered AddLeagueModal.
 */
const AddLeagueModal: React.FC<AddLeagueModalProps> = ({
  visible,
  onClose,
  configuredLeagues,
  selectedLeagues,
  setSelectedLeagues,
  toggleLeagueSelection,
  handleAddSelectedLeagues,
  searchQuery,
  setSearchQuery,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("Europe");

  /**
   * @brief Handles the closing of the modal.
   *
   * Resets the search query and selected category, then calls the onClose function.
   */
  const handleClose = () => {
    setSearchQuery("");
    setSelectedCategory("Europe");
    onClose();
  };

  // Filter leagues by search query and already configured leagues
  const filteredLeagues = AVAILABLE_LEAGUES.filter(
    (league) =>
      !configuredLeagues.some((l) => l.code === league.code) &&
      (searchQuery === "" ||
        league.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        league.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group leagues by category or show search results
  const leaguesToDisplay = searchQuery
    ? filteredLeagues
    : filteredLeagues.filter((league) => league.category === selectedCategory);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={manageLeaguesModalStyles.modalSafeArea}>
        <View style={manageLeaguesModalStyles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={manageLeaguesModalStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={manageLeaguesModalStyles.headerTitle}>Add Leagues</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={manageLeaguesModalStyles.contentContainer}>
          {/* Search Bar */}
          <View style={addLeagueModalStyles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={colors.textMuted}
              style={addLeagueModalStyles.searchIcon}
            />
            <TextInput
              style={addLeagueModalStyles.searchInput}
              placeholder="Search leagues..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={addLeagueModalStyles.clearSearch}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Tabs - ScrollView is always rendered, content is conditional */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={addLeagueModalStyles.categoryTabsContainer}
            contentContainerStyle={addLeagueModalStyles.categoryTabsContent}
          >
            {!searchQuery &&
              LEAGUE_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    addLeagueModalStyles.categoryTab,
                    selectedCategory === category &&
                      addLeagueModalStyles.categoryTabSelected,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      addLeagueModalStyles.categoryTabText,
                      selectedCategory === category &&
                        addLeagueModalStyles.categoryTabTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>

          {/* League count and selection controls */}
          <View style={manageLeaguesModalStyles.leagueHeaderRow}>
            <Text style={manageLeaguesModalStyles.leagueCountText}>
              {leaguesToDisplay.length > 0 && (
                <>
                  {leaguesToDisplay.length}{" "}
                  {leaguesToDisplay.length === 1 ? "league" : "leagues"}{" "}
                  available
                </>
              )}
              {leaguesToDisplay.length > 0 &&
                selectedLeagues.length > 0 &&
                " • "}
              {selectedLeagues.length > 0 &&
                `${selectedLeagues.length} selected`}
            </Text>

            {leaguesToDisplay.length > 0 && (
              <View style={addLeagueModalStyles.selectionControls}>
                <TouchableOpacity
                  onPress={() => {
                    const leaguesToSelect = leaguesToDisplay.filter(
                      (league) =>
                        !selectedLeagues.some((l) => l.code === league.code)
                    );
                    setSelectedLeagues([
                      ...selectedLeagues,
                      ...leaguesToSelect,
                    ]);
                  }}
                  style={addLeagueModalStyles.actionPill}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={14}
                    color={colors.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={addLeagueModalStyles.actionPillText}>All</Text>
                </TouchableOpacity>

                {selectedLeagues.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      const remainingSelected = selectedLeagues.filter(
                        (league) =>
                          !leaguesToDisplay.some((l) => l.code === league.code)
                      );
                      setSelectedLeagues(remainingSelected);
                    }}
                    style={[
                      addLeagueModalStyles.actionPill,
                      { backgroundColor: colors.dangerLight },
                    ]}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={14}
                      color={colors.danger}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        addLeagueModalStyles.actionPillText,
                        { color: colors.danger },
                      ]}
                    >
                      Clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Flex wrapper for League List or Empty State */}
          <View style={{ flex: 1, width: "100%" }}>
            {leaguesToDisplay.length > 0 ? (
              <FlatList
                data={leaguesToDisplay}
                keyExtractor={(item) => item.code}
                contentContainerStyle={
                  manageLeaguesModalStyles.leagueListContent
                }
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedLeagues.some(
                    (l) => l.code === item.code
                  );
                  return (
                    <LeagueItem
                      league={item}
                      isSelected={isSelected}
                      onPress={() => toggleLeagueSelection(item)}
                    />
                  );
                }}
              />
            ) : (
              <View style={manageLeaguesModalStyles.emptyState}>
                <View style={manageLeaguesModalStyles.emptyStateIcon}>
                  <Ionicons
                    name="football-outline"
                    size={50}
                    color={colors.primaryDark}
                  />
                </View>
                <Text style={manageLeaguesModalStyles.emptyStateTitle}>
                  No leagues found
                </Text>
                <Text style={manageLeaguesModalStyles.emptyStateMessage}>
                  {searchQuery
                    ? "Try a different search term"
                    : "No leagues available in this category"}
                </Text>
              </View>
            )}
          </View>

          {/* Add Selected Button */}
          {selectedLeagues.length > 0 && (
            <TouchableOpacity
              style={[
                addLeagueModalStyles.addSelectedButton,
                { marginHorizontal: 16, marginBottom: 16 },
              ]}
              onPress={handleAddSelectedLeagues}
            >
              <Text style={addLeagueModalStyles.addButtonText}>
                Add {selectedLeagues.length}{" "}
                {selectedLeagues.length === 1 ? "League" : "Leagues"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default AddLeagueModal;
