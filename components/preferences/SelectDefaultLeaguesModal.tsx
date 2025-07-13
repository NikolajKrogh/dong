import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { selectDefaultLeaguesModalStyles } from "../../app/style/userPreferencesStyles";
import { colors } from "../../app/style/palette";
import { LeagueEndpoint } from "../../constants/leagues";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";

/**
 * @interface SelectDefaultLeaguesModalProps
 * @brief Props for the SelectDefaultLeaguesModal component.
 */
interface SelectDefaultLeaguesModalProps {
  /** @brief Whether the modal is visible. */
  visible: boolean;
  /** @brief Function to call when the modal is closed. */
  onClose: () => void;
  /** @brief Array of all currently configured leagues by the user. */
  configuredLeagues: LeagueEndpoint[];
  /** @brief Array of leagues currently selected as default. */
  currentDefaultLeagues: LeagueEndpoint[];
  /** @brief Function to call when the user saves the selected default leagues.
   *  @param selectedDefaults - An array of LeagueEndpoint objects representing the new default leagues.
   */
  onSave: (selectedDefaults: LeagueEndpoint[]) => void;
}

/**
 * @component LeagueItem
 * @brief Displays a single league item within the selection list.
 *
 * This component shows the league's logo, name, and an indicator
 * of whether it's currently selected as a default league.
 *
 * @param {object} props - The component's props.
 * @param {LeagueEndpoint} props.league - The league data to display.
 * @param {boolean} props.isSelected - Whether the league is currently selected.
 * @param {() => void} props.onPress - Function to call when the league item is pressed.
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
        selectDefaultLeaguesModalStyles.availableLeagueItem,
        isSelected && selectDefaultLeaguesModalStyles.selectedLeagueItem,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={selectDefaultLeaguesModalStyles.leagueLogoContainer}>
        {isLoading ? (
          <View style={selectDefaultLeaguesModalStyles.leagueLogoPlaceholder}>
            <Ionicons
              name="hourglass-outline"
              size={20}
              color={colors.textMuted}
            />
          </View>
        ) : logoSource ? (
          <Image
            source={logoSource}
            style={selectDefaultLeaguesModalStyles.leagueLogo}
            resizeMode="contain"
          />
        ) : (
          <View style={selectDefaultLeaguesModalStyles.leagueLogoPlaceholder}>
            <Ionicons
              name="football-outline"
              size={20}
              color={colors.textMuted}
            />
          </View>
        )}
      </View>
      <View style={selectDefaultLeaguesModalStyles.leagueItemContent}>
        <Text
          style={selectDefaultLeaguesModalStyles.availableLeagueName}
          numberOfLines={1}
        >
          {league.name}
        </Text>
      </View>
      <Ionicons
        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
        size={22}
        color={isSelected ? colors.success : colors.textMuted}
      />
    </TouchableOpacity>
  );
};

/**
 * @component SelectDefaultLeaguesModal
 * @brief A modal for selecting which configured leagues should be active by default.
 *
 * This modal allows users to choose a subset of their configured leagues
 * to be automatically selected or prioritized when viewing match data.
 *
 * @param {SelectDefaultLeaguesModalProps} props - The component's props.
 * @returns {JSX.Element} The rendered SelectDefaultLeaguesModal.
 */
const SelectDefaultLeaguesModal: React.FC<SelectDefaultLeaguesModalProps> = ({
  visible,
  onClose,
  configuredLeagues,
  currentDefaultLeagues,
  onSave,
}) => {
  const [selectedLeagues, setSelectedLeagues] = useState<LeagueEndpoint[]>([]);

  /**
   * @brief Effect to initialize or update the selected leagues when the modal becomes visible
   *        or when the current default leagues change.
   */
  useEffect(() => {
    if (visible) {
      setSelectedLeagues(currentDefaultLeagues);
    }
  }, [visible, currentDefaultLeagues]);

  /**
   * @brief Toggles the selection state of a league.
   * If the league is already selected, it's removed; otherwise, it's added.
   * @param {LeagueEndpoint} league - The league to toggle.
   */
  const toggleLeagueSelection = (league: LeagueEndpoint) => {
    setSelectedLeagues((prevSelected) =>
      prevSelected.some((l) => l.code === league.code)
        ? prevSelected.filter((l) => l.code !== league.code)
        : [...prevSelected, league]
    );
  };

  /**
   * @brief Handles the save action.
   * Calls the onSave prop with the currently selected leagues and then closes the modal.
   */
  const handleSave = () => {
    onSave(selectedLeagues);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={selectDefaultLeaguesModalStyles.modalSafeArea}>
        <View style={selectDefaultLeaguesModalStyles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={selectDefaultLeaguesModalStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={selectDefaultLeaguesModalStyles.headerTitle}>
            Set Default Leagues
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={selectDefaultLeaguesModalStyles.contentContainer}>
          <View style={selectDefaultLeaguesModalStyles.leagueHeaderRow}>
            <Text style={selectDefaultLeaguesModalStyles.leagueCountText}>
              Select leagues to load by default on the match screen.
            </Text>
          </View>
          <Text style={selectDefaultLeaguesModalStyles.selectionInfoText}>
            {selectedLeagues.length} of {configuredLeagues.length} selected
          </Text>
          {configuredLeagues.length > 0 ? (
            <FlatList
              data={configuredLeagues}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <LeagueItem
                  league={item}
                  isSelected={selectedLeagues.some((l) => l.code === item.code)}
                  onPress={() => toggleLeagueSelection(item)}
                />
              )}
              contentContainerStyle={
                selectDefaultLeaguesModalStyles.leagueListContent
              }
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={selectDefaultLeaguesModalStyles.emptyState}>
              <View style={selectDefaultLeaguesModalStyles.emptyStateIcon}>
                <Ionicons
                  name="list-outline"
                  size={50}
                  color={colors.primaryDark}
                />
              </View>
              <Text style={selectDefaultLeaguesModalStyles.emptyStateTitle}>
                No Configured Leagues
              </Text>
              <Text style={selectDefaultLeaguesModalStyles.emptyStateMessage}>
                Please add leagues via "Manage Configured Leagues" or "Add New
                Leagues" first.
              </Text>
            </View>
          )}
        </View>
        {configuredLeagues.length > 0 && (
          <TouchableOpacity
            style={selectDefaultLeaguesModalStyles.saveButton}
            onPress={handleSave}
          >
            <Text style={selectDefaultLeaguesModalStyles.saveButtonText}>
              Save Defaults ({selectedLeagues.length})
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default SelectDefaultLeaguesModal;
