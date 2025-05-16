import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  SafeAreaView,
  Image,
  Animated,
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
const LeagueCard: React.FC<LeagueCardProps> = ({ league, removeLeague }) => {
  // Pass both league name AND code
  const { logoSource, isLoading } = useLeagueLogo(league.name, league.code);

  return (
    <View style={manageLeaguesModalStyles.leagueCard}>
      <View style={manageLeaguesModalStyles.leagueCardContent}>
        <View style={manageLeaguesModalStyles.logoContainer}>
          {isLoading ? (
            <View style={manageLeaguesModalStyles.leagueLogoPlaceholder}>
              <Ionicons
                name="hourglass-outline"
                size={20}
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
            <View style={manageLeaguesModalStyles.leagueLogoPlaceholder}>
              <Ionicons
                name="football-outline"
                size={20}
                color={colors.textMuted}
              />
            </View>
          )}
        </View>

        <View style={manageLeaguesModalStyles.leagueInfo}>
          <Text numberOfLines={1} style={manageLeaguesModalStyles.leagueName}>
            {league.name}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => removeLeague(league.code)}
        style={manageLeaguesModalStyles.removeButton}
      >
        <Ionicons name="close-circle" size={22} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );
};

/**
 * @component ManageLeaguesModal
 * @brief A modal component for managing configured leagues.
 *        Allows users to view, remove, and reset leagues.
 * @param {ManageLeaguesModalProps} props - The props for the component.
 * @returns {React.ReactElement} The ManageLeaguesModal component.
 */
const ManageLeaguesModal: React.FC<ManageLeaguesModalProps> = ({
  visible,
  onClose,
  configuredLeagues,
  removeLeague,
  resetLeaguesToDefaults,
}) => {
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({});

  // Effect to clean up animation refs for leagues no longer present
  useEffect(() => {
    const currentLeagueCodes = new Set(configuredLeagues.map((l) => l.code));
    const newFadeAnims = { ...fadeAnims.current };
    let changed = false;
    Object.keys(newFadeAnims).forEach((key) => {
      if (!currentLeagueCodes.has(key)) {
        delete newFadeAnims[key];
        changed = true;
      }
    });
    if (changed) {
      fadeAnims.current = newFadeAnims;
    }
  }, [configuredLeagues]);

  const handleRemoveLeagueWithAnimation = (leagueCode: string) => {
    const anim = fadeAnims.current[leagueCode];
    if (anim) {
      Animated.timing(anim, {
        toValue: 0, // Fade out and shrink
        duration: 300,
        useNativeDriver: true, // Use native driver for performance
      }).start(() => {
        removeLeague(leagueCode); // Call the original remove function after animation
        // Clean up the animation value from the ref
        delete fadeAnims.current[leagueCode];
      });
    } else {
      // Fallback if animation value not found (should not happen)
      removeLeague(leagueCode);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={manageLeaguesModalStyles.modalSafeArea}>
        <View style={manageLeaguesModalStyles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={manageLeaguesModalStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={manageLeaguesModalStyles.headerTitle}>
            Manage Leagues
          </Text>
          <TouchableOpacity
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
            style={manageLeaguesModalStyles.resetButton}
          >
            <Ionicons name="refresh-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={manageLeaguesModalStyles.contentContainer}>
          <View style={manageLeaguesModalStyles.leagueHeaderRow}>
            <Text style={manageLeaguesModalStyles.leagueCountText}>
              {configuredLeagues.length}{" "}
              {configuredLeagues.length === 1 ? "league" : "leagues"} configured
            </Text>
          </View>

          {configuredLeagues.length > 0 ? (
            <FlatList
              data={configuredLeagues}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                // Ensure animation value exists, initialize if new to the list.
                if (!fadeAnims.current[item.code]) {
                  fadeAnims.current[item.code] = new Animated.Value(1);
                }
                const animValue = fadeAnims.current[item.code];

                return (
                  <Animated.View
                    style={{
                      opacity: animValue,
                      transform: [{ scale: animValue }], // Apply scale for shrink effect
                    }}
                  >
                    <LeagueCard
                      league={item}
                      removeLeague={handleRemoveLeagueWithAnimation} // Pass the animated remove function
                    />
                  </Animated.View>
                );
              }}
              contentContainerStyle={manageLeaguesModalStyles.leagueListContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={manageLeaguesModalStyles.emptyState}>
              <View style={manageLeaguesModalStyles.emptyStateIcon}>
                <Ionicons
                  name="football-outline"
                  size={50}
                  color={colors.primary}
                />
              </View>
              <Text style={manageLeaguesModalStyles.emptyStateTitle}>
                No leagues configured
              </Text>
              <Text style={manageLeaguesModalStyles.emptyStateMessage}>
                Use the "Add Leagues" setting to configure leagues
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default ManageLeaguesModal;
