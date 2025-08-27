import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Match } from "../../store/store";
import { getTeamLogoWithFallback } from "../../utils/teamLogos";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";

/**
 * Props for common match selector.
 * @description Supplies match list plus currently selected common match ID and a selection callback.
 * @property matches Array of all configured matches available for selection.
 * @property selectedCommonMatch ID of the match currently marked as common, or null if none selected.
 * @property handleSelectCommonMatch Callback invoked with a match ID when user selects/changes the common match.
 */
interface CommonMatchSelectorProps {
  matches: Match[];
  selectedCommonMatch: string | null;
  handleSelectCommonMatch: (matchId: string) => void;
}

/**
 * Common match selector.
 * @description Lets user pick a single shared (all players) match; includes info modal when needed.
 * @param {CommonMatchSelectorProps} props Component props.
 * @returns {React.ReactElement} Component element.
 */
const CommonMatchSelector: React.FC<CommonMatchSelectorProps> = ({
  matches,
  selectedCommonMatch,
  handleSelectCommonMatch,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);

  /** Toggle info modal visibility. */
  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  /** Informational copy for concept explanation. */
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
                  styles.matchCard,
                  isSelected && styles.selectedMatchCard,
                ]}
              >
                <LinearGradient
                  colors={[
                    isSelected ? colors.primaryLight : colors.primaryLighter,
                    colors.surface,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.matchCardGradient}
                >
                  {/* Teams container */}
                  <View style={styles.matchTeamsContainer}>
                    {/* Home team column */}
                    <View style={styles.matchTeamColumn}>
                      <View style={styles.logoContainer}>
                        {homeTeamLogo ? (
                          <Image
                            source={homeTeamLogo}
                            style={styles.teamLogo}
                          />
                        ) : (
                          <View style={styles.teamLogoPlaceholder}>
                            <Text style={styles.teamLogoPlaceholderText}>
                              {item.homeTeam.charAt(0)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={styles.teamName}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.homeTeam}
                      </Text>
                    </View>

                    {/* VS column */}
                    <View style={styles.vsDivider}>
                      <Text style={styles.vsText}>VS</Text>
                    </View>

                    {/* Away team column */}
                    <View style={styles.matchTeamColumn}>
                      <View style={styles.logoContainer}>
                        {awayTeamLogo ? (
                          <Image
                            source={awayTeamLogo}
                            style={styles.teamLogo}
                          />
                        ) : (
                          <View style={styles.teamLogoPlaceholder}>
                            <Text style={styles.teamLogoPlaceholderText}>
                              {item.awayTeam.charAt(0)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={styles.teamName}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.awayTeam}
                      </Text>
                    </View>
                  </View>

                  {/* Selection indicator */}
                  {isSelected && (
                    <View style={styles.selectedRibbon}>
                      <Text style={styles.selectedRibbonText}>COMMON</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
};

export default CommonMatchSelector;
