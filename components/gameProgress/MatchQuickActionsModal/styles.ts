import { StyleSheet } from "react-native";
import { useColors } from "../../../app/style/theme";

/** Style creator for the MatchQuickActionsModal and its sub-components. */
export const createStyles = (
  colors: ReturnType<typeof useColors>,
  modalWidth: number,
  screenHeight: number,
  isWideLayout: boolean,
  playerColumnCount: number,
) =>
  StyleSheet.create({
    overlayTouchable: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.backgroundModalOverlay,
      zIndex: 1000,
    },
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: isWideLayout ? 24 : 16,
    },
    modalContainer: {
      width: modalWidth,
      maxWidth: isWideLayout ? 960 : 420,
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 5,
      zIndex: 1001,
      maxHeight: Math.min(screenHeight * 0.84, isWideLayout ? 760 : 680),
    },
    modalInnerContainer: {
      width: "100%",
    },
    scrollContent: {
      padding: 16,
      alignItems: "center",
    },
    // Match header styling to match MatchesGrid
    matchHeaderSection: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      paddingBottom: 12,
    },
    matchTeamContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    matchTeamLogo: {
      width: 50,
      height: 50,
      resizeMode: "contain",
      marginBottom: 8,
    },
    matchTeamName: {
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
      color: colors.textSecondary,
      width: "100%",
    },
    matchVsBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginHorizontal: 10,
    },
    matchVsText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
    },
    // Common match badge
    commonMatchBadge: {
      backgroundColor: colors.success,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 4,
      marginBottom: 8,
    },
    commonMatchText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: "600",
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLighter,
      width: "100%",
      marginVertical: 12,
    },
    // Tab container
    tabContainer: {
      flexDirection: "row",
      justifyContent: isWideLayout ? "center" : "space-around",
      width: "100%",
      marginBottom: 12,
    },
    tabButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.backgroundSubtle,
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.white,
    },
    // For API matches - read only display
    scoreContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      paddingVertical: 16,
    },
    scoreValue: {
      alignItems: "center",
      paddingHorizontal: 12,
    },
    scoreText: {
      fontSize: 42,
      fontWeight: "bold",
      color: colors.primary,
    },
    scoreSeparator: {
      paddingHorizontal: 8,
    },
    scoreSeparatorText: {
      fontSize: 36,
      fontWeight: "bold",
      color: colors.textMuted,
    },
    // For editable matches - with controls
    goalActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      paddingVertical: 8,
    },
    teamGoalControls: {
      flex: 1,
      alignItems: "center",
    },
    teamLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 4,
    },
    scoreControlRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    goalCounter: {
      alignItems: "center",
      paddingHorizontal: 20,
    },
    goalValue: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.primary,
    },
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    blueButton: {
      backgroundColor: colors.primary,
    },
    // Goal Scorers display
    goalScorersContainer: {
      flexDirection: "row",
      width: "100%",
      minHeight: 0, // Minimum height even when empty
      maxHeight: 120, // Maximum height before scrolling
    },
    teamScorersColumn: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 4,
    },
    scorerContainer: {
      width: "100%",
      alignItems: "center",
      paddingVertical: 4,
    },
    scorerText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginVertical: 2,
      fontStyle: "italic",
      textAlign: "center",
    },
    // Players section
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
      marginLeft: 8,
    },
    // Player section - super compact layout
    compactContainer: {
      flexDirection: playerColumnCount === 1 ? "column" : "row",
      width: "100%",
      marginBottom: 12,
      justifyContent: "flex-start",
    },
    playerColumn: {
      flex: playerColumnCount === 1 ? undefined : 1,
      width: playerColumnCount === 1 ? "100%" : undefined,
      marginHorizontal: playerColumnCount === 1 ? 0 : 2,
    },
    compactPlayerCard: {
      backgroundColor: colors.backgroundSubtle,
      borderRadius: 6,
      paddingVertical: 4, // Even more compact
      paddingHorizontal: 6,
      marginBottom: 4,
      marginHorizontal: 2,
    },
    compactPlayerName: {
      fontSize: 12, // Smaller font for compactness
      fontWeight: "500",
      color: colors.textSecondary,
      textAlign: "center",
    },
    emptyStateContainer: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      marginBottom: 12,
    },
    noPlayersText: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: "italic",
      marginLeft: 8,
    },
    // Close button
    closeButton: {
      backgroundColor: colors.backgroundSubtle,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: "center",
      width: "100%",
    },
    closeButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    // Match statistics section
    statisticsContainer: {
      width: "100%",
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    statProgressContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 8, // Increased margin slightly
      width: "100%",
    },
    statProgressWrapper: {
      flex: 3,
      marginHorizontal: 8, // Add some horizontal margin
    },
    statProgressLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 4,
    },
    svgProgressBarContainer: {
      // New or repurposed style for SVG wrapper
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      height: 8, // Match barHeight
    },
    statValue: {
      flex: 1,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "bold",
      color: colors.textSecondary,
    },
    homeProgressArea: {
      // Used for background color reference
      backgroundColor: colors.primaryLight,
    },
    awayProgressArea: {
      // Used for background color reference
      backgroundColor: colors.playerItemOddBackground,
    },
    progressDivider: {
      // Used for width and color reference
      width: 2,
      backgroundColor: colors.darkSurface,
    },
    homeProgressBar: {
      // Used for borderRadius reference
      borderTopLeftRadius: 3,
      borderBottomLeftRadius: 3,
    },
    awayProgressBar: {
      // Used for borderRadius reference
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
    },
    possessionContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginVertical: 15,
      width: "100%",
    },
    possessionCircleContainer: {
      flex: 3,
      alignItems: "center",
    },
    circleWrapper: {
      width: 100,
      height: 100,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      marginTop: 5,
    },
  });
