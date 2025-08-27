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
import { createUserPreferencesStyles } from "../../app/style/userPreferencesStyles";
import { useColors } from "../../app/style/theme";
import { LeagueEndpoint } from "../../constants/leagues";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";

/**
 * Props for default leagues modal.
 * @description Manages visibility, current persisted defaults and persistence callback for selecting initial leagues.
 * @property visible Whether the modal is displayed.
 * @property onClose Callback invoked to close the modal (without saving changes unless explicitly saved).
 * @property configuredLeagues All leagues currently configured by the user (selection source list).
 * @property currentDefaultLeagues Leagues previously marked as defaults (used to seed local selection on open).
 * @property onSave Persists the provided selection as the new default leagues.
 */
interface SelectDefaultLeaguesModalProps {
  /** Modal visibility flag. */
  visible: boolean;
  /** Close callback. */
  onClose: () => void;
  /** All configured leagues. */
  configuredLeagues: LeagueEndpoint[];
  /** Currently default leagues. */
  currentDefaultLeagues: LeagueEndpoint[];
  /** Persist selected defaults callback. */
  onSave: (selectedDefaults: LeagueEndpoint[]) => void;
}

/**
 * League list item.
 * @description Shows logo, name and selected state; press toggles selection.
 * @param props Item props.
 * @returns {JSX.Element} Row element.
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
  const colors = useColors();
  const { selectDefaultLeaguesModalStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
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
 * Select default leagues modal.
 * @description Allows choosing subset of configured leagues to load initially on match screen.
 * @param {SelectDefaultLeaguesModalProps} props Component props.
 * @returns {JSX.Element} Modal content.
 */
const SelectDefaultLeaguesModal: React.FC<SelectDefaultLeaguesModalProps> = ({
  visible,
  onClose,
  configuredLeagues,
  currentDefaultLeagues,
  onSave,
}) => {
  const colors = useColors();
  const { selectDefaultLeaguesModalStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
  const [selectedLeagues, setSelectedLeagues] = useState<LeagueEndpoint[]>([]);

  // Initialize selection from current defaults when opening
  useEffect(() => {
    if (visible) {
      setSelectedLeagues(currentDefaultLeagues);
    }
  }, [visible, currentDefaultLeagues]);

  /** Toggle selection for a league. */
  const toggleLeagueSelection = (league: LeagueEndpoint) => {
    setSelectedLeagues((prevSelected) =>
      prevSelected.some((l) => l.code === league.code)
        ? prevSelected.filter((l) => l.code !== league.code)
        : [...prevSelected, league]
    );
  };

  /** Persist selected defaults then close. */
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
