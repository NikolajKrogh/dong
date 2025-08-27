/**
 * @file ManageLeaguesModal.tsx
 * @description Modal UI for viewing, removing, and resetting configured football leagues. Includes animated removal of league cards and integrates with themed styles.
 */
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
  Image,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createUserPreferencesStyles } from "../../app/style/userPreferencesStyles";
import { LeagueEndpoint } from "../../constants/leagues";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";
import { useColors } from "../../app/style/theme";

/** Props for `ManageLeaguesModal`. */
interface ManageLeaguesModalProps {
  /** Whether the modal is visible. */
  visible: boolean;
  /** Callback when the modal requests close. */
  onClose: () => void;
  /** Array of currently configured leagues. */
  configuredLeagues: LeagueEndpoint[];
  /** Removes a league by code. */
  removeLeague: (code: string) => void;
  /** Resets leagues to default selection. */
  resetLeaguesToDefaults: () => void;
}

/** Props for `LeagueCard`. */
interface LeagueCardProps {
  /** League data to display. */
  league: LeagueEndpoint;
  /** Removes the league by code. */
  removeLeague: (code: string) => void;
}

/**
 * Renders a single league card row.
 * @description Shows league logo (or placeholder), name and a remove action. Includes loading state for logo fetch.
 * @param props Component props.
 */
const LeagueCard: React.FC<LeagueCardProps> = ({ league, removeLeague }) => {
  const colors = useColors();
  const { manageLeaguesModalStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
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
 * Modal for managing configured leagues.
 * @description Lists current leagues with animated removal and provides a reset-to-defaults action. Uses themed styles and safe area layout.
 * @param props Component props.
 */
const ManageLeaguesModal: React.FC<ManageLeaguesModalProps> = ({
  visible,
  onClose,
  configuredLeagues,
  removeLeague,
  resetLeaguesToDefaults,
}) => {
  const colors = useColors();
  const { manageLeaguesModalStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
  const fadeAnims = useRef<{ [key: string]: Animated.Value }>({});
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

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
            onPress={() => setShowResetConfirm(true)}
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

        {showResetConfirm && (
          <View style={manageLeaguesModalStyles.confirmOverlay}>
            <View style={manageLeaguesModalStyles.confirmDialog}>
              <Text style={manageLeaguesModalStyles.confirmTitle}>
                Reset leagues?
              </Text>
              <Text style={manageLeaguesModalStyles.confirmMessage}>
                This will restore the default league selection.
              </Text>
              <View style={manageLeaguesModalStyles.confirmActions}>
                <TouchableOpacity
                  onPress={() => setShowResetConfirm(false)}
                  style={manageLeaguesModalStyles.confirmCancelBtn}
                >
                  <Text style={manageLeaguesModalStyles.confirmCancelText}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    resetLeaguesToDefaults();
                    setShowResetConfirm(false);
                  }}
                  style={manageLeaguesModalStyles.confirmResetBtn}
                >
                  <Text style={manageLeaguesModalStyles.confirmResetText}>
                    Reset
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default ManageLeaguesModal;
