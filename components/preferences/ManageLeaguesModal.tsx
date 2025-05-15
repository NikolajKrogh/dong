import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  SafeAreaView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  manageLeaguesModalStyles,
  colors,
} from "../../app/style/userPreferencesStyles";
import { LeagueEndpoint } from "../../constants/leagues";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";

/**
 * @interface ManageLeaguesModalProps
 * @brief Props for the ManageLeaguesModal component.
 */
interface ManageLeaguesModalProps {
  /** @brief Whether the modal is visible. */
  visible: boolean;
  /** @brief Function to call when the modal is closed. */
  onClose: () => void;
  /** @brief Array of currently configured leagues. */
  configuredLeagues: LeagueEndpoint[];
  /** @brief Function to remove a league. */
  removeLeague: (code: string) => void;
  /** @brief Function to reset leagues to their default settings. */
  resetLeaguesToDefaults: () => void;
  /** @brief Function to call when the "Add League" button is pressed. */
  onAddLeague: () => void;
}

/**
 * @interface LeagueCardProps
 * @brief Props for the LeagueCard component.
 */
interface LeagueCardProps {
  /** @brief The league data to display. */
  league: LeagueEndpoint;
  /** @brief Function to remove the league. */
  removeLeague: (code: string) => void;
}

/**
 * @component LeagueCard
 * @brief Displays a single league card with its logo, name, code, category, and a remove button.
 * @param {LeagueCardProps} props - The props for the component.
 * @returns {React.ReactElement} The LeagueCard component.
 */
const LeagueCard: React.FC<LeagueCardProps> = ({
  league,
  removeLeague,
}) => {
  // Pass both league name AND code
  const { logoSource, isLoading } = useLeagueLogo(league.name, league.code);

  return (
    <View key={league.code} style={manageLeaguesModalStyles.ultraCompactCard}>
      <View style={manageLeaguesModalStyles.logoContainer}>
        {isLoading ? (
          <View
            style={[
              manageLeaguesModalStyles.leagueLogo,
              {
                backgroundColor: colors.backgroundSubtle,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <Ionicons
              name="hourglass-outline"
              size={18}
              color={colors.textMuted}
            />
          </View>
        ) : logoSource ? (
          <Image
            source={logoSource}
            style={manageLeaguesModalStyles.leagueLogo}
            resizeMode="contain"
          />
        ) : (
          <View
            style={[
              manageLeaguesModalStyles.leagueLogo,
              {
                backgroundColor: colors.backgroundSubtle,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <Ionicons
              name="football-outline"
              size={18}
              color={colors.textMuted}
            />
          </View>
        )}
      </View>

      <View style={manageLeaguesModalStyles.ultraCompactInfo}>
        <Text
          numberOfLines={1}
          style={manageLeaguesModalStyles.ultraCompactName}
        >
          {league.name}
        </Text>
        <View style={manageLeaguesModalStyles.ultraCompactDetailsContainer}>
          <View style={manageLeaguesModalStyles.ultraCompactCodeContainer}>
            <Text style={manageLeaguesModalStyles.ultraCompactCode}>
              {league.code}
            </Text>
            {league.category && (
              <Text style={manageLeaguesModalStyles.ultraCompactCategory}>
                {league.category}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => removeLeague(league.code)}
            style={manageLeaguesModalStyles.ultraCompactRemove}
            accessibilityLabel={`Remove ${league.name}`}
          >
            <Ionicons name="close-circle" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

/**
 * @component ManageLeaguesModal
 * @brief A modal component for managing configured leagues.
 *        Allows users to view, remove, and reset leagues, or navigate to add new leagues.
 * @param {ManageLeaguesModalProps} props - The props for the component.
 * @returns {React.ReactElement} The ManageLeaguesModal component.
 */
const ManageLeaguesModal: React.FC<ManageLeaguesModalProps> = ({
  visible,
  onClose,
  configuredLeagues,
  removeLeague,
  resetLeaguesToDefaults,
  onAddLeague,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={manageLeaguesModalStyles.modalSafeArea}>
        <View style={manageLeaguesModalStyles.modalHeaderCompact}>
          <Text style={manageLeaguesModalStyles.modalTitleCompact}>
            Manage Leagues
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={manageLeaguesModalStyles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {configuredLeagues.length > 0 ? (
          <ScrollView
            style={manageLeaguesModalStyles.leagueListContainer}
            contentContainerStyle={manageLeaguesModalStyles.leagueListContent}
          >
            <View style={manageLeaguesModalStyles.leaguesGrid}>
              {configuredLeagues.map((league) => (
                <LeagueCard
                  key={league.code}
                  league={league}
                  removeLeague={removeLeague}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={manageLeaguesModalStyles.emptyStateCompact}>
            <Ionicons name="football-outline" size={40} color="#ccc" />
            <Text style={manageLeaguesModalStyles.emptyStateText}>
              No leagues configured
            </Text>
            <Text style={manageLeaguesModalStyles.emptyStateSubtext}>
              Add leagues to get match data and live scores
            </Text>
          </View>
        )}

        <View style={manageLeaguesModalStyles.ultraCompactFooter}>
          <TouchableOpacity
            style={manageLeaguesModalStyles.ultraCompactButton}
            onPress={() => {
              onClose(); // Close current modal before opening another
              onAddLeague();
            }}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={manageLeaguesModalStyles.ultraCompactButtonText}>
              Add League
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              manageLeaguesModalStyles.ultraCompactButton,
              manageLeaguesModalStyles.ultraCompactReset,
            ]}
            onPress={() => {
              Alert.alert(
                "Reset Leagues",
                "Are you sure you want to reset to default leagues?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Reset",
                    onPress: resetLeaguesToDefaults,
                    style: "destructive",
                  },
                ]
              );
            }}
          >
            <Ionicons name="refresh-outline" size={15} color="#fff" />
            <Text style={manageLeaguesModalStyles.ultraCompactButtonText}>
              Reset
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default ManageLeaguesModal;