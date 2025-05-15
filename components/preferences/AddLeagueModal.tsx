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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  addLeagueModalStyles,
  colors,
} from "../../app/style/userPreferencesStyles";
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
  // Pass both league name AND code
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
      {isLoading ? (
        <View
          style={[
            addLeagueModalStyles.leagueLogo,
            {
              backgroundColor: colors.backgroundSubtle,
              alignItems: "center",
              justifyContent: "center",
            },
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
            {
              backgroundColor: colors.backgroundSubtle,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Ionicons
            name="football-outline"
            size={16}
            color={colors.textMuted}
          />
        </View>
      )}

      <View style={addLeagueModalStyles.leagueItemContent}>
        <Text style={addLeagueModalStyles.availableLeagueName}>
          {league.name}
        </Text>
        {/* Display category instead of code */}
        {league.category && (
          <Text style={addLeagueModalStyles.availableLeagueCategory}>
            {league.category}
          </Text>
        )}
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
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={addLeagueModalStyles.modalContainer}>
        <View style={addLeagueModalStyles.modalContent}>
          <View style={addLeagueModalStyles.modalHeader}>
            <Text style={addLeagueModalStyles.modalTitle}>Add Leagues</Text>
            <View style={addLeagueModalStyles.modalHeaderRight}>
              {selectedLeagues.length > 0 && (
                <Text style={addLeagueModalStyles.selectionCounter}>
                  {selectedLeagues.length} selected
                </Text>
              )}
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

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

          {/* Category Tabs - Only show when not searching */}
          {!searchQuery && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={addLeagueModalStyles.categoryTabsContainer}
              contentContainerStyle={addLeagueModalStyles.categoryTabsContent}
            >
              {LEAGUE_CATEGORIES.map((category) => (
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
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Search Results Title or Category Title */}
          <View style={addLeagueModalStyles.sectionTitleContainer}>
            <Text style={addLeagueModalStyles.sectionTitle}>
              {searchQuery
                ? `Search Results${
                    filteredLeagues.length > 0
                      ? ` (${filteredLeagues.length})`
                      : ""
                  }`
                : selectedCategory}
            </Text>
          </View>

          {/* League List */}
          <ScrollView
            style={addLeagueModalStyles.availableLeaguesList}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={true}
          >
            {leaguesToDisplay.length === 0 ? (
              <View style={addLeagueModalStyles.emptyStateContainer}>
                <Text style={addLeagueModalStyles.emptyStateText}>
                  {searchQuery
                    ? "No leagues found matching your search"
                    : "No leagues available in this category"}
                </Text>
              </View>
            ) : (
              leaguesToDisplay.map((league) => {
                const isSelected = selectedLeagues.some(
                  (l) => l.code === league.code
                );
                return (
                  <LeagueItem
                    key={league.code}
                    league={league}
                    isSelected={isSelected}
                    onPress={() => toggleLeagueSelection(league)}
                  />
                );
              })
            )}
          </ScrollView>

          {/* Add Selected Button */}
          {selectedLeagues.length > 0 && (
            <TouchableOpacity
              style={addLeagueModalStyles.addSelectedButton}
              onPress={handleAddSelectedLeagues}
            >
              <Text style={addLeagueModalStyles.addButtonText}>
                Add {selectedLeagues.length}{" "}
                {selectedLeagues.length === 1 ? "League" : "Leagues"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default AddLeagueModal;