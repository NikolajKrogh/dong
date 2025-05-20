import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, Modal } from "react-native";
import { Match } from "../../store/store";
import styles, { colors } from "../../app/style/setupGameStyles";
import { Ionicons } from "@expo/vector-icons";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";

/**
 * @interface CommonMatchSelectorProps
 * @brief Props for the CommonMatchSelector component.
 * @property {Match[]} matches - An array of available matches to choose from.
 * @property {string | null} selectedCommonMatch - The ID of the currently selected common match, or null if none is selected.
 * @property {(matchId: string) => void} handleSelectCommonMatch - Callback function to handle the selection of a common match.
 */
interface CommonMatchSelectorProps {
  matches: Match[];
  selectedCommonMatch: string | null;
  handleSelectCommonMatch: (matchId: string) => void;
}

/**
 * @brief A React functional component for selecting a common match from a list.
 *
 * This component displays a list of matches and allows the user to select one as the "common match".
 * It also includes an informational modal explaining what a common match is.
 * If no matches are available, it displays a message prompting the user to add matches.
 *
 * @param {CommonMatchSelectorProps} props - The props for the component.
 * @returns {React.ReactNode} The rendered component.
 */
const CommonMatchSelector: React.FC<CommonMatchSelectorProps> = ({
  matches,
  selectedCommonMatch,
  handleSelectCommonMatch,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  /**
   * @brief Toggles the visibility of the informational modal.
   */
  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  /**
   * @const {string} commonMatchInfo
   * @brief Informational text explaining the concept of a common match.
   */
  const commonMatchInfo =
    "The common match is the game that's shown on TV and applies to all participants in the game. Regardless of which other matches players choose individually, everyone must drink one beer when a goal is scored in the common match.";

  return (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Select Common Match</Text>
        <TouchableOpacity onPress={toggleModal}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Info Modal - Using same style as AssignmentSection */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={toggleModal}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>{commonMatchInfo}</Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={toggleModal}
            >
              <Text style={styles.textStyle}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {matches.length === 0 ? (
        <View style={styles.emptyListContainer}>
          <Ionicons
            name="football-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text style={styles.emptyListTitleText}>No matches available</Text>
          <Text style={styles.emptyListSubtitleText}>
            Return to the previous step to add some matches first.
          </Text>
        </View>
      ) : (
        matches.map((item) => {
          const isSelected = selectedCommonMatch === item.id;
          const homeTeamLogo = getTeamLogoWithFallback(item.homeTeam);
          const awayTeamLogo = getTeamLogoWithFallback(item.awayTeam);

          return (
            <View key={item.id} style={styles.matchItemWrapper}>
              <TouchableOpacity
                onPress={() => handleSelectCommonMatch(item.id)}
                activeOpacity={0.6}
                style={[
                  styles.assignmentItem,
                  isSelected && styles.selectedAssignmentItem,
                ]}
              >
                {/* Teams section */}
                <View style={styles.matchTeamsSection}>
                  {/* Home team row */}
                  <View style={styles.matchTeamRow}>
                    <Image source={homeTeamLogo} style={styles.matchTeamLogo} />
                    <Text
                      style={styles.matchTeamName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.homeTeam}
                    </Text>
                  </View>

                  {/* Divider with vs text */}
                  <View style={styles.matchDivider}>
                    <Text style={styles.matchVsText}>vs</Text>
                  </View>

                  {/* Away team row */}
                  <View style={styles.matchTeamRow}>
                    <Image source={awayTeamLogo} style={styles.matchTeamLogo} />
                    <Text
                      style={styles.matchTeamName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.awayTeam}
                    </Text>
                  </View>
                </View>

                {/* Selection indicator */}
                <View style={styles.matchActionsContainer}>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={isSelected ? colors.primary : colors.border}
                  />
                </View>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
};

export default CommonMatchSelector;
