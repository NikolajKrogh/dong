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
  Image,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { createUserPreferencesStyles } from "../../styles/userPreferencesStyles";
import { LeagueEndpoint } from "../../constants/leagues";
import { useLeagueLogo } from "../../hooks/useLeagueLogo";
import { useColors } from "../../styles/theme";

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
const LeagueCard = React.memo(function LeagueCard({ league, removeLeague }: LeagueCardProps) {
  const colors = useColors();
  const { manageLeaguesModalStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
  // Pass both league name AND code
  const { logoSource, isLoading } = useLeagueLogo(league.name, league.code);
  const handleRemove = React.useCallback(
    () => removeLeague(league.code),
    [league.code, removeLeague],
  );

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
        onPress={handleRemove}
        style={manageLeaguesModalStyles.removeButton}
      >
        <Ionicons name="close-circle" size={22} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );
});

interface AnimatedLeagueRowProps {
  league: LeagueEndpoint;
  animValue: Animated.Value;
  removeLeague: (code: string) => void;
}

const AnimatedLeagueRow = React.memo(function AnimatedLeagueRow({
  league,
  animValue,
  removeLeague,
}: AnimatedLeagueRowProps) {
  const animatedStyle = React.useMemo(
    () => ({ opacity: animValue, transform: [{ scale: animValue }] }),
    [animValue],
  );

  return (
    <Animated.View style={animatedStyle}>
      <LeagueCard league={league} removeLeague={removeLeague} />
    </Animated.View>
  );
});

const leagueKeyExtractor = (league: LeagueEndpoint) => league.code;

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

  const handleRemoveLeagueWithAnimation = React.useCallback((leagueCode: string) => {
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
  }, [removeLeague]);

  const renderLeague = React.useCallback(({ item }: { item: LeagueEndpoint }) => {
    // Ensure animation value exists, initialize if new to the list.
    if (!fadeAnims.current[item.code]) {
      fadeAnims.current[item.code] = new Animated.Value(1);
    }

    return (
      <AnimatedLeagueRow
        league={item}
        animValue={fadeAnims.current[item.code]}
        removeLeague={handleRemoveLeagueWithAnimation}
      />
    );
  }, [handleRemoveLeagueWithAnimation]);
  const handleOpenResetConfirm = React.useCallback(() => {
    setShowResetConfirm(true);
  }, []);
  const handleCloseResetConfirm = React.useCallback(() => {
    setShowResetConfirm(false);
  }, []);
  const handleConfirmReset = React.useCallback(() => {
    resetLeaguesToDefaults();
    setShowResetConfirm(false);
  }, [resetLeaguesToDefaults]);

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
            onPress={handleOpenResetConfirm}
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
              keyExtractor={leagueKeyExtractor}
              renderItem={renderLeague}
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
                Use the &quot;Add Leagues&quot; setting to configure leagues
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
                  onPress={handleCloseResetConfirm}
                  style={manageLeaguesModalStyles.confirmCancelBtn}
                >
                  <Text style={manageLeaguesModalStyles.confirmCancelText}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmReset}
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
