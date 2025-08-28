import {
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Dimensions,
} from "react-native";
import type { lightColors as Light, darkColors as Dark } from "./theme";
type Colors = typeof Light | typeof Dark;

export function createGameProgressStyles(colors: Colors) {
  // --- Base Styles ---
  const baseContainer: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
  };

  const baseCard: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: 8,
    elevation: 2,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  };

  const baseButton: ViewStyle = {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  };

  const baseButtonText: TextStyle = {
    color: colors.textLight,
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 5,
  };

  const baseSectionTitle: TextStyle = {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    marginLeft: 8,
    color: colors.textPrimary,
  };

  const baseModalView: ViewStyle = {
    margin: 20,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  };

  const baseCounterButton: ViewStyle = {
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  };

  const baseBadge: ViewStyle = {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  };

  return StyleSheet.create({
    // ============ Layout & Container Styles ============
    safeArea: {
      ...baseContainer,
      paddingTop: 25,
    },
    container: {
      ...baseContainer,
    },
    contentContainer: {
      flex: 1,
    },
    section: {
      marginBottom: 24,
    },
    matchesGridContainer: {
      padding: 8,
      paddingBottom: 80,
    },
    playersListContent: {
      padding: 8,
      paddingBottom: 80,
    },
    gridContainer: {
      padding: 8,
      paddingBottom: 80,
    },
    listContainer: {
      padding: 10,
    },

    // ============ Tab Navigation Styles ============
    tabContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      backgroundColor: colors.surface,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 20,
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.textLight,
    },
    tabsContainer: {
      flex: 1,
      flexDirection: "row",
    },
    tabContent: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },

    // ============ Text Styles ============
    sectionTitle: {
      ...baseSectionTitle,
    },
    sectionHelp: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 10,
      textAlign: "center",
    },
    textStyle: {
      color: colors.textLight,
      fontWeight: "bold",
      textAlign: "center",
    },

    // ============ Header Styles ============
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textSecondary,
    },
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
    },
    headerStatus: {
      flexDirection: "row",
      alignItems: "center",
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    statusActive: {
      backgroundColor: colors.success,
    },
    statusIdle: {
      backgroundColor: colors.textDisabled,
    },
    layoutToggleButton: {
      padding: 8,
      marginLeft: 8,
      borderRadius: 8,
      backgroundColor: colors.primaryTransparentLight,
    },
    toggleButton: {
      padding: 8,
    },
    refreshButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 16,
      backgroundColor: colors.primaryTransparentLight,
    },
    lastUpdateText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
      marginLeft: 4,
    },
    sortToggleButton: {
      paddingHorizontal: 8,
      justifyContent: "center",
      alignItems: "center",
    },

    // ============ Live Score Styles ============
    liveIndicator: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: colors.liveIndicator,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      flexDirection: "column",
      alignItems: "center",
    },
    liveText: {
      color: colors.textLight,
      fontSize: 10,
      fontWeight: "bold",
    },
    gridLiveIndicator: {
      position: "absolute",
      top: 5,
      right: 5,
      backgroundColor: colors.liveIndicator,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      zIndex: 10,
    },
    gridLiveText: {
      color: colors.textLight,
      fontSize: 8,
      fontWeight: "bold",
    },

    // ============ Score Styles ============
    scoreText: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.primary,
      marginHorizontal: 25,
    },
    gridScoreText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.primary,
      marginHorizontal: 8,
    },
    teamScoreContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 70,
    },
    logoScoreContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    teamLogoContainer: {
      flex: 1,
      alignItems: "center",
    },
    scoresContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flex: 2,
      paddingHorizontal: 12,
    },
    scoreVsContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
    },

    // ============ Minutes Played Styles ============
    minutesPlayedText: {
      fontSize: 12,
      fontWeight: "bold",
      color: colors.liveIndicator,
      marginHorizontal: 8,
      textAlign: "center",
      alignSelf: "center",
    },
    minutesPlayedBadge: {
      backgroundColor: "transparent",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    listMinutesContainer: {
      backgroundColor: "transparent",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    // ============ Match Card Styles ============
    matchGridItem: {
      ...baseCard,
      flex: 1,
      margin: 8,
      padding: 16,
      minHeight: 100,
      position: "relative",
    },
    matchCardContainer: {
      ...baseCard,
      borderRadius: 10,
      overflow: "hidden",
      shadowOpacity: 0.08,
      position: "relative",
    },
    matchItem: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
    },
    matchListItemContainer: {
      ...baseCard,
      marginBottom: 12,
      padding: 12,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    gridItem: {
      ...baseCard,
      flex: 1,
      margin: 6,
      height: 90,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowOpacity: 0.1,
      elevation: 1,
      position: "relative",
    },

    // ============ Match Header & Content Styles ============
    matchHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    matchHeaderSection: {
      paddingTop: 14,
      paddingBottom: 8,
      paddingHorizontal: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.backgroundLight,
    },
    matchListHeaderSection: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    matchCardContent: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    matchDetailsSection: {
      flex: 0.6,
      position: "relative",
      paddingRight: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    playerNamesSection: {
      flex: 0.4,
      borderLeftWidth: 1,
      borderLeftColor: colors.borderLight,
      paddingLeft: 8,
      justifyContent: "center",
    },
    matchInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },

    // ============ Match Team Styles ============
    matchTeams: {
      fontSize: 16,
      fontWeight: "500",
      flex: 1,
      paddingRight: 8,
    },
    matchTeamsWithCommonBadge: {
      marginTop: 4,
    },
    matchText: {
      fontSize: 16,
      fontWeight: "bold",
    },
    matchTeamContainer: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    matchTeamLogo: {
      width: 36,
      height: 36,
      marginBottom: 4,
      resizeMode: "contain",
    } as ImageStyle,
    matchTeamName: {
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
      color: colors.textSecondary,
    },
    matchListTeamsSection: {
      flexDirection: "column",
      flex: 1,
    },
    matchListTeamRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 4,
    },
    matchListTeamLogo: {
      width: 28,
      height: 28,
      borderRadius: 14,
      marginRight: 8,
    } as ImageStyle,
    matchListTeamName: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },

    // ============ Match VS & Divider Styles ============
    matchVsBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginHorizontal: 4,
    },
    matchVsText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textMuted,
    },
    matchListDivider: {
      alignSelf: "center",
      marginVertical: 2,
    },
    matchListVsText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "bold",
    },
    matchDetailsDivider: {
      width: 1,
      height: 16,
      backgroundColor: colors.borderLight,
      marginHorizontal: 10,
    },
    vsText: {
      fontSize: 14,
      color: colors.textMuted,
      marginHorizontal: 10,
    },

    // ============ Match Details Styles ============
    matchCompactDetails: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    matchCompactGoalsSection: {
      flexDirection: "row",
      alignItems: "center",
    },
    matchGoalsCount: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primary,
      marginLeft: 4,
    },
    matchListRightSection: {
      alignItems: "flex-end",
    },
    matchListGoalsCounter: {
      flexDirection: "row",
      alignItems: "center",
    },
    matchListGoalsCount: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.primary,
      marginLeft: 4,
    },

    // ============ Match Players Styles ============
    matchCompactPlayersSection: {
      flex: 1,
      flexDirection: "column",
    },
    matchPlayerCount: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "500",
    },
    matchPlayerPreview: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    matchListPlayersSection: {
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: 8,
      marginTop: 4,
    },
    matchListPlayersLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    matchListPlayersNames: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyPlayerCount: {
      fontSize: 13,
      color: colors.textDisabled,
    },

    // ============ Teams & Logos Styles ============
    teamsContainer: {
      flex: 1,
      justifyContent: "center",
    },
    logosRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    teamColumn: {
      alignItems: "center",
    },
    teamLogo: {
      width: 32,
      height: 32,
      borderRadius: 16,
    } as ImageStyle,

    // ============ Stats Row Styles ============
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: 8,
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    statValue: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.textSecondary,
      marginLeft: 4,
    },
    playerPreview: {
      fontSize: 11,
      color: colors.textMuted,
      marginLeft: 4,
    },

    // ============ Common Match Badge Styles ============
    commonTag: {
      fontSize: 12,
      fontStyle: "italic",
      color: colors.success,
    },
    commonMatchBadge: {
      backgroundColor: colors.primary,
      color: colors.textLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: "bold",
    },
    commonMatchLabel: {
      backgroundColor: colors.success,
      color: colors.textLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 16,
      fontSize: 12,
      marginTop: 8,
    },
    commonBadge: {
      position: "absolute",
      bottom: 8,
      right: 8,
      backgroundColor: colors.success,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    commonBadgeText: {
      color: colors.textLight,
      fontSize: 10,
      fontWeight: "500",
    },
    matchCommonBadge: {
      position: "absolute",
      bottom: 8,
      right: 8,
      backgroundColor: colors.success,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      zIndex: 10,
    },
    matchCommonBadgeText: {
      color: colors.textLight,
      fontSize: 11,
      fontWeight: "600",
    },
    matchListCommonBadge: {
      backgroundColor: colors.successLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 6,
    },
    matchListCommonBadgeText: {
      fontSize: 12,
      color: colors.successDarkText,
      fontWeight: "bold",
    },
    commonIndicator: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },

    // ============ Player Card Styles ============

    playerCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },

    // ============ Player Card Styles ============
    playerCard: {
      ...baseCard,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    playerName: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 16,
    },
    completedBadge: {
      backgroundColor: colors.successLight,
    },
    pendingBadge: {
      backgroundColor: colors.dangerLight,
    },
    statusText: {
      fontSize: 13,
      fontWeight: "500",
    },
    completedText: {
      color: colors.successOwedText,
    },
    pendingText: {
      color: colors.dangerOwedText,
    },
    progressContainer: {
      marginBottom: 16,
    },
    progressBackground: {
      height: 6,
      backgroundColor: colors.borderLight,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
    },
    progressCompleted: {
      backgroundColor: colors.success,
    },
    progressWarning: {
      backgroundColor: colors.warning,
    },
    progressDanger: {
      backgroundColor: colors.danger,
    },
    statsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statBlock: {
      alignItems: "center",
    },
    requiredValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textSecondary,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    controlsContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    controlButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    decrementButton: {
      backgroundColor: colors.danger,
    },
    incrementButton: {
      backgroundColor: colors.success,
    },
    valueContainer: {
      alignItems: "center",
      marginHorizontal: 10,
      minWidth: 50,
    },
    controlValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textSecondary,
    },
    controlLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },

    // ============ Player Badge Styles ============
    playerBadgeContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
    },
    playerBadge: {
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      paddingVertical: 2,
      paddingHorizontal: 8,
      marginRight: 4,
      marginBottom: 2,
    },
    playerBadgeText: {
      fontSize: 11,
      color: colors.primaryDark,
      fontWeight: "500",
    },
    countBadge: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    countBadgeText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "500",
    },

    // ============ Drink Stats & Counter Styles ============
    drinkStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    requiredLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    statItemWithControls: {
      alignItems: "center",
      flex: 1,
    },
    compactDrinkStats: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginTop: 4,
    },
    compactStatItem: {
      alignItems: "center",
      flex: 1,
    },
    compactStatWithControls: {
      alignItems: "center",
      flex: 2,
    },
    compactStatLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    compactStatValue: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
    },

    // ============ Goal Counter Styles ============
    goalCounter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    goalCounterLarge: {
      alignItems: "center",
      marginHorizontal: 20,
    },
    goalValueLarge: {
      fontSize: 36,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    goalLabelLarge: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
    },
    goalValue: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    goalLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    goalBadge: {
      backgroundColor: colors.primary,
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 12,
    },
    goalBadgeText: {
      color: colors.textLight,
      fontWeight: "bold",
      fontSize: 12,
    },

    // ============ Drink Counter Styles ============
    drinkCounter: {
      flexDirection: "row",
      alignItems: "center",
    },
    drinkValue: {
      fontSize: 20,
      fontWeight: "bold",
      marginHorizontal: 8,
      color: colors.textPrimary,
    },
    drinkLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },

    // ============ Owed Value Styles ============
    owedValue: {
      fontSize: 20,
      fontWeight: "bold",
    },
    owedLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    owedPositive: {
      color: colors.danger,
    },
    owedZero: {
      color: colors.success,
    },
    quickStatText: {
      fontSize: 13,
      fontWeight: "500",
    },
    owedZeroText: {
      color: colors.successOwedText,
    },
    owedPositiveText: {
      color: colors.dangerOwedText,
    },
    quickStatBadge: {
      ...baseBadge,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    owedZeroBadge: {
      backgroundColor: colors.successLight,
      borderColor: colors.owedZeroBorder,
    },
    owedPositiveBadge: {
      backgroundColor: colors.dangerLight,
      borderColor: colors.owedPositiveBorder,
    },

    // ============ Button Styles ============
    button: {
      ...baseButton,
      borderRadius: 20,
      padding: 10,
      elevation: 2,
      marginHorizontal: 5,
    },
    counterButton: {
      ...baseCounterButton,
      width: 36,
      height: 36,
      backgroundColor: colors.primary,
    },
    counterValueContainer: {
      alignItems: "center",
      marginHorizontal: 16,
    },
    counterButtonText: {
      color: colors.textLight,
      fontSize: 20,
      fontWeight: "bold",
    },
    smallCounterButton: {
      ...baseCounterButton,
      width: 28,
      height: 28,
      borderRadius: 14,
      marginHorizontal: 8,
    },
    tinyButton: {
      ...baseCounterButton,
      width: 28,
      height: 28,
      borderRadius: 14,
      marginHorizontal: 8,
    },
    tinyButtonText: {
      color: colors.textLight,
      fontSize: 16,
      fontWeight: "bold",
    },

    // ============ Quick Action Button Styles ============
    quickActionButton: {
      ...baseButton,
      width: 50,
      height: 50,
      borderRadius: 25,
      elevation: 3,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    actionButton: {
      backgroundColor: colors.primary,
    },
    quickActionButtonText: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textLight,
    },
    quickActionsContainer: {
      width: "100%",
      alignItems: "center",
      padding: 16,
    },
    goalQuickActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 20,
    },
    consumedControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    compactControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    // ============ Navigation & Action Button Styles ============
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    backButtonText: {
      marginLeft: 4,
      fontSize: 16,
      color: colors.primary,
    },
    closeButton: {
      marginTop: 16,
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderRadius: 4,
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.textMuted,
    },
    historyButton: {
      ...baseButton,
      flex: 1,
      backgroundColor: colors.secondary,
      padding: 16,
      flexDirection: "row",
    },
    buttonText: {
      ...baseButtonText,
    },
    disabledButton: {
      opacity: 0.7,
      backgroundColor: colors.secondary,
    },

    // ============ Footer Button Styles ============
    footerContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 8,
      gap: 8,
    },
    homeButton: {
      ...baseButton,
      flex: 1,
      backgroundColor: colors.success,
      padding: 12,
      flexDirection: "row",
    },
    setupButton: {
      ...baseButton,
      flex: 1,
      backgroundColor: colors.primary,
      padding: 12,
      flexDirection: "row",
    },
    endButton: {
      ...baseButton,
      flex: 1,
      backgroundColor: colors.danger,
      padding: 12,
      flexDirection: "row",
    },
    endButtonText: {
      color: colors.textLight,
      fontSize: 18,
      fontWeight: "bold",
    },
    endButtonContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 16,
      gap: 12,
    },
    buttonConfirm: {
      backgroundColor: colors.danger,
    },
    buttonCancel: {
      backgroundColor: colors.secondary,
    },
    footerEndGameText: {
      color: colors.danger,
    },

    // ============ Match List Item Styles ============
    matchListItemCard: {
      height: 120,
    },
    commonMatchIndicator: {
      position: "absolute",
      top: 0,
      right: 0,
      backgroundColor: colors.success,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderBottomLeftRadius: 6,
      borderTopRightRadius: 6,
      zIndex: 10,
    },
    commonMatchIndicator_Text: {
      color: colors.textLight,
      fontSize: 10,
      fontWeight: "600",
    },
    matchList_LogoImage: {
      width: 45,
      height: 45,
      resizeMode: "contain",
    },
    matchList_HomeLogoWrapper: {
      width: 40,
      height: 50,
      justifyContent: "center",
      alignItems: "center",
      paddingLeft: 45,
    },
    matchList_AwayLogoWrapper: {
      width: 40,
      height: 50,
      justifyContent: "center",
      alignItems: "center",
      paddingRight: 45,
    },
    matchList_ScoresWrapper: {
      paddingHorizontal: 6,
    },
    matchList_ScoreText: {
      fontSize: 26,
    },
    matchList_StatusText: {
      fontSize: 20,
    },
    matchList_VSFallbackText: {
      fontSize: 20,
    },

    // ============ Player Assignment Styles ============
    assignedPlayersContainer: {
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: 8,
    },
    assignedPlayerName: {
      fontSize: 12,
      color: colors.textMuted,
      marginRight: 8,
      marginBottom: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
    },
    playerNamesContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 4,
    },
    noPlayersText: {
      fontSize: 12,
      fontStyle: "italic",
      color: colors.textDisabled,
      textAlign: "center",
    },
    affectedPlayersList: {
      maxHeight: 120,
      width: "100%",
    },
    affectedPlayerText: {
      fontSize: 14,
      paddingVertical: 4,
      color: colors.textPrimary,
    },
    impactLabel: {
      fontSize: 16,
      fontWeight: "500",
      marginTop: 16,
      marginBottom: 8,
      color: colors.textPrimary,
    },
    matchAssignments: {
      marginTop: 16,
    },
    assignmentLabel: {
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 4,
      color: colors.textPrimary,
    },
    assignmentText: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    // ============ Modal Styles ============
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.backgroundModalOverlay,
    },
    modalView: {
      ...baseModalView,
    },
    modalTitle: {
      marginBottom: 15,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    modalText: {
      marginBottom: 15,
      textAlign: "center",
      color: colors.textSecondary,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-around",
      width: "100%",
    },

    // ============ Grid Row Styles ============
    gridRow: {
      flex: 1,
      justifyContent: "space-between",
    },

    // ============ Tab Navigation Local Styles ============
    tabNavContainer: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
    },
    tabNavContentContainer: {
      flex: 1,
      overflow: "hidden",
    },
    tabPage: {
      width: Dimensions.get("window").width,
      flex: 1,
    },
    tabBarContainer: {
      marginHorizontal: 16,
      marginVertical: 12,
    },
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 8,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      overflow: "hidden",
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      backgroundColor: colors.surface,
    },
    activeTabButton: {
      backgroundColor: colors.primaryLight,
    },
    tabButtonText: {
      fontSize: 15,
      color: colors.textMuted,
      marginLeft: 8,
    },
    activeTabButtonText: {
      color: colors.primary,
      fontWeight: "500",
    },
    tabBadge: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 6,
    },
    tabBadgeText: {
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}

// Dummy default export to satisfy Expo Router if this file is treated as a route
export default function StyleModuleRoute() {
  return null;
}
