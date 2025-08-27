import {
  StyleSheet,
  Dimensions,
  TextStyle,
  ViewStyle,
  ImageStyle,
} from "react-native";
import type { lightColors as Light, darkColors as Dark } from "./theme";
type Colors = typeof Light | typeof Dark;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- Base Styles ---
const makeBaseCard = (colors: Colors): ViewStyle => ({
  backgroundColor: colors.surface,
  borderRadius: 12,
  marginBottom: 16,
  shadowColor: colors.black,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 2,
});

const makeBaseText = (colors: Colors): TextStyle => ({
  color: colors.textPrimary,
});

const makeTextTitle = (colors: Colors): TextStyle => ({
  ...makeBaseText(colors),
  fontWeight: "bold",
  color: colors.textSecondary,
});

const makeTextValue = (colors: Colors): TextStyle => ({
  ...makeBaseText(colors),
  fontWeight: "bold",
  color: colors.primary,
});

const makeTextLabel = (colors: Colors): TextStyle => ({
  ...makeBaseText(colors),
  fontSize: 13,
  color: colors.textMuted,
  textAlign: "center",
});

const baseBadge: ViewStyle = {
  paddingVertical: 4,
  paddingHorizontal: 10,
  borderRadius: 16,
  flexDirection: "row",
  alignItems: "center",
};

const makeBaseHeader = (colors: Colors): ViewStyle => ({
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 16,
  backgroundColor: colors.surface,
  borderBottomWidth: 1,
  borderBottomColor: colors.borderSubtle,
});
export function createHistoryStyles(colors: Colors) {
  const baseCard = makeBaseCard(colors);
  const baseText = makeBaseText(colors);
  const textTitle = makeTextTitle(colors);
  const textValue = makeTextValue(colors);
  const textLabel = makeTextLabel(colors);
  const baseHeader = makeBaseHeader(colors);

  return StyleSheet.create({
    // --- Layout & Containers ---
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    listContent: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      paddingHorizontal: 16,
      marginBottom: 4,
    },
    tabsContainer: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      paddingVertical: 4,
      marginHorizontal: 16,
      marginVertical: 12,
      borderRadius: 12,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tabContentWrapper: {
      flex: 1,
      flexDirection: "row",
      width: SCREEN_WIDTH * 3, // Assuming 3 tabs
    },
    tabContent: {
      width: SCREEN_WIDTH,
      flex: 1,
    },

    // --- Headers ---
    pageHeader: {
      // Main header for the history screen
      ...baseHeader,
      justifyContent: "space-between",
      paddingVertical: 12,
      elevation: 2,
    } as ViewStyle,
    headerBackButton: {
      // Back button in pageHeader
      padding: 8,
    },
    headerTitle: {
      // Title in pageHeader
      ...textTitle,
      fontSize: 18,
    } as TextStyle,
    rightPlaceholder: {
      // For centering title in pageHeader
      width: 56,
    },

    // --- Tabs ---
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    activeTab: {
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
    },
    iconRow: {
      // Container for icon + text in tab
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    tabText: {
      ...baseText,
      fontSize: 15,
      color: colors.textMuted,
      marginLeft: 6,
    },
    activeTabText: {
      color: colors.primary,
      fontWeight: "500",
    },

    // --- Cards ---
    gameItem: {
      // Card for each game in the list
      ...baseCard,
      padding: 16,
    },
    enhancedPlayerCard: {
      // Card for player stats ranking
      ...baseCard,
      padding: 16,
      position: "relative",
      overflow: "hidden",
      elevation: 3, // Slightly more prominent
    },
    topPlayerCard: {
      // Highlight for top player
      borderLeftWidth: 4,
      borderLeftColor: colors.gold,
    },
    modalPlayerCard: {
      // Row for player in modal
      ...baseCard,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
      marginBottom: 8,
      elevation: 1, // Less prominent
    },
    modalMatchCard: {
      // Card for match in modal
      ...baseCard,
      padding: 16,
      marginBottom: 12,
      elevation: 1,
      position: "relative",
    },
    matchRow: {
      // Match display within GameHistoryItem (non-modal)
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      position: "relative",
    },
    featuredStatCard: {
      // Prominent card in OverallStats
      ...baseCard,
      backgroundColor: colors.primary,
      marginHorizontal: 16,
      marginVertical: 12,
      padding: 16,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },

    // --- Stat Display Styles ---
    statsGrid: {
      // Grid container (OverallStats, Modal)
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginTop: 8,
      paddingHorizontal: 16, // Add padding if items don't have margin
    },
    statItem: {
      // Basic stat item (used in old OverallStats)
      ...baseCard,
      width: "48%",
      padding: 16,
      alignItems: "center",
      elevation: 2,
    },
    statItemWithIcon: {
      // Stat item with icon (OverallStats)
      ...baseCard,
      width: "48%",
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      elevation: 2,
    },
    statIconContainer: {
      // Circle background for icon
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryLighter,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    statTextContainer: {
      // Text part next to icon
      flex: 1,
    },
    summaryItem: {
      // Used by StatDisplayItem component (GameHistoryItem)
      alignItems: "center",
      flex: 1, // Allow items to space out evenly
      paddingHorizontal: 4, // Add some space between items
    },
    summaryIcon: {
      // Icon in StatDisplayItem
      marginBottom: 4,
    },
    modalStatItem: {
      // Stat item in modal grid
      ...baseCard,
      width: "48%",
      padding: 12,
      alignItems: "center",
      elevation: 1,
    },
    playerStatDetails: {
      // Row container for player metrics (PlayerStatsList, Modal)
      flexDirection: "row",
      justifyContent: "space-around", // Space out metrics
      marginTop: 12, // Add space above metrics
    },
    playerStatDetail: {
      // Individual metric (drinks, games, avg)
      alignItems: "center",
      minWidth: 70,
    },
    playerDetailWithIcon: {
      // Metric with icon (PlayerStatsList)
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },

    // --- Text Styles ---
    sectionTitle: {
      // Main section titles (Overall, Player Rankings)
      ...textTitle,
      fontSize: 20,
      marginBottom: 12,
      paddingHorizontal: 16,
    } as TextStyle,
    sectionSubtitle: {
      // Subtitle below section title
      ...baseText,
      fontSize: 14, // Smaller than title
      color: colors.textMuted,
      marginBottom: 16, // More space after subtitle
      paddingHorizontal: 16,
    } as TextStyle,
    gameDate: {
      // Date in GameHistoryItem header
      ...textTitle,
      fontSize: 16,
    } as TextStyle,
    summaryValue: {
      // Value in StatDisplayItem
      ...textValue,
      fontSize: 18,
    } as TextStyle,
    summaryLabel: {
      // Label in StatDisplayItem
      ...textLabel,
      fontSize: 12,
    } as TextStyle,
    statValue: {
      // Value in stat items (Overall, Modal)
      ...textValue,
      fontSize: 20, // Slightly larger for grid items
      marginBottom: 2, // Less margin for grid items
      textAlign: "left", // Align left in statItemWithIcon
    } as TextStyle,
    statLabel: {
      // Label in stat items (Overall, Modal)
      ...textLabel,
      textAlign: "left", // Align left in statItemWithIcon
    } as TextStyle,
    featuredStatValue: {
      // Value in featured card
      ...textValue,
      fontSize: 32,
      color: colors.white,
    } as TextStyle,
    featuredStatLabel: {
      // Label in featured card
      ...textLabel,
      fontSize: 14,
      color: colors.white,
      textAlign: "left",
    } as TextStyle,
    playerStatName: {
      // Player name in lists/cards
      ...textTitle,
      fontSize: 18,
      marginBottom: 4, // Less margin
    } as TextStyle,
    playerStatValue: {
      // Metric value for player stats
      ...textValue,
      fontSize: 17,
      marginBottom: 4,
    } as TextStyle,
    playerStatLabel: {
      // Metric label for player stats
      ...textLabel,
      fontSize: 12,
    } as TextStyle,
    topDrinkerText: {
      // Text in top drinker highlight
      ...baseText,
      marginLeft: 8,
      fontSize: 14,
      color: colors.textMuted, // Muted color for base text
    } as TextStyle,
    topDrinkerName: {
      // Player name within top drinker text
      fontWeight: "600",
      color: colors.textSecondary, // Darker color for name
    } as TextStyle,
    gameCount: {
      // Games played text in player card
      ...baseText,
      fontSize: 12,
      color: colors.textMuted,
    } as TextStyle,
    drinkBarText: {
      // Text inside drink bar
      ...baseText,
      color: colors.white,
      fontWeight: "bold",
      fontSize: 13,
    } as TextStyle,
    playerDetailLabel: {
      // Label for avg drinks/game
      ...textLabel,
      fontSize: 13,
      marginLeft: 6,
      textAlign: "left",
    } as TextStyle,
    playerDetailHighlight: {
      // Highlighted part of avg drinks/game
      fontWeight: "bold",
      color: colors.textPrimary,
    } as TextStyle,
    modalTitle: {
      // Modal title text
      ...textTitle,
      fontSize: 18,
    } as TextStyle,
    modalDate: {
      // Date text inside modal
      ...baseText,
      fontSize: 16,
      color: colors.textMuted,
      marginBottom: 20,
      textAlign: "center",
    } as TextStyle,
    modalSectionTitle: {
      // Section titles inside modal
      ...textTitle,
      fontSize: 18,
      marginLeft: 8,
    } as TextStyle,
    modalPlayerName: {
      // Player name inside modal list
      ...baseText,
      fontSize: 16,
    } as TextStyle,
    modalPlayerDrinks: {
      // Drink count inside modal badge
      ...baseText,
      color: colors.white,
      fontSize: 14,
      fontWeight: "600",
      marginLeft: 4,
    } as TextStyle,
    modalMatchTeamName: {
      // Team name inside modal match card
      ...baseText,
      fontSize: 14,
      textAlign: "center",
    } as TextStyle,
    modalScoreText: {
      // Score text inside modal match card
      ...textTitle, // Use title style for boldness
      fontSize: 24,
      paddingHorizontal: 8,
    } as TextStyle,
    modalScoreDivider: {
      // Divider '-' in score
      fontSize: 20,
      color: colors.darkGray,
    } as TextStyle,
    modalMatchPlayersTitle: {
      // "Players:" title in modal match card
      ...textTitle,
      fontSize: 14,
      color: colors.textSecondary, // Slightly less prominent
      marginBottom: 4,
    } as TextStyle,
    modalMatchPlayerName: {
      // Player name in modal match card list
      ...baseText,
      fontSize: 14,
      color: colors.textMuted,
    } as TextStyle,
    matchesListTitle: {
      // "Match Results:" title
      ...textTitle,
      fontSize: 15,
      marginBottom: 8,
    } as TextStyle,
    matchTeamName: {
      // Team name in GameHistoryItem match list
      ...baseText,
      fontSize: 12,
      textAlign: "center",
      width: "100%",
    } as TextStyle,
    scoreText: {
      // Score in GameHistoryItem match list
      ...textTitle,
      fontSize: 18,
      paddingHorizontal: 8,
    } as TextStyle,
    vsText: {
      // Divider '-' in GameHistoryItem match list
      fontSize: 16,
      color: colors.darkGray,
    } as TextStyle,
    expandButtonText: {
      // Text for "Show/Hide Matches"
      ...baseText,
      fontSize: 14,
      color: colors.primary,
      fontWeight: "500",
    } as TextStyle,
    emptyStateText: {
      // Text for empty history
      ...baseText,
      textAlign: "center",
      fontSize: 16,
      color: colors.textMuted,
      marginTop: 16,
      marginBottom: 24,
    } as TextStyle,
    startGameButtonText: {
      // Text on start game button (empty state)
      ...baseText,
      color: colors.white,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 8,
    } as TextStyle,
    rankText: {
      // Text inside rank badge
      ...baseText,
      color: colors.white,
      fontWeight: "bold",
      fontSize: 14,
      textAlign: "center",
    } as TextStyle,
    commonBadgeText: {
      // Text inside common match badge
      ...baseText,
      color: colors.white,
      fontSize: 9,
      fontWeight: "600",
    } as TextStyle,

    // --- Game History Item Specific ---
    gameHeader: {
      // Container for icon + date
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    } as ViewStyle,
    gameIcon: {
      // Icon in game header
      marginRight: 8,
    } as ImageStyle,
    gameSummary: {
      // Container for StatDisplayItems
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    } as ViewStyle,
    topDrinkerContainer: {
      // Highlight box for top drinker
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.warningLight,
      padding: 10,
      borderRadius: 8,
      marginBottom: 12,
    } as ViewStyle,
    expandButton: {
      // "Show/Hide Matches" button
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      marginTop: 8, // Add margin top
    } as ViewStyle,
    matchesList: {
      // Container for matches in GameHistoryItem
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    } as ViewStyle,

    // --- Match Display Specific (Shared by MatchCard) ---
    matchTeams: {
      // Row container for teams + score
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    } as ViewStyle,
    matchTeamBlock: {
      // Container for logo + name
      flex: 2, // Adjust flex as needed
      alignItems: "center",
    } as ViewStyle,
    matchTeamLogo: {
      // Team logo image
      width: 36, // Consistent size
      height: 36,
      marginBottom: 4,
    } as ImageStyle,
    scoreBlock: {
      // Container for score (e.g., 2 - 1)
      flex: 1, // Adjust flex as needed
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    } as ViewStyle,

    // --- Player Stats List Specific ---
    playerHeader: {
      // Container for name + game count
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 4,
    } as ViewStyle,
    drinkBar: {
      // The actual colored bar
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: "center",
      paddingHorizontal: 8,
      minWidth: 40,
    } as ViewStyle,
    playerListContent: {
      // Padding for FlatList
      paddingHorizontal: 16,
    } as ViewStyle,

    // --- Badges ---
    rankBadge: {
      // Base for rank badges (1, 2, 3)
      ...baseBadge,
      position: "absolute",
      top: 10,
      right: 10,
      width: 28, // Ensure width and height are the same for a circle
      height: 28,
      borderRadius: 14, // Half of width/height for a circle
      justifyContent: "center", // Center content vertically
      alignItems: "center", // Center content horizontally
      zIndex: 10,
      elevation: 3, // Add shadow for Android
      shadowColor: colors.black, // Add shadow for iOS
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.5,
    } as ViewStyle,
    goldBadge: { backgroundColor: colors.gold },
    silverBadge: { backgroundColor: colors.silver },
    bronzeBadge: { backgroundColor: colors.bronze },
    commonBadge: {
      // "Common Match" badge
      ...baseBadge,
      position: "absolute",
      top: 0,
      right: 0,
      backgroundColor: colors.success,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderBottomLeftRadius: 6,
      borderTopRightRadius: 7,
      zIndex: 10,
    } as ViewStyle,
    modalDrinkBadge: {
      // Drinks badge in modal player list
      ...baseBadge,
      backgroundColor: colors.primary,
    } as ViewStyle,

    // --- Modal Specific ---
    modalCenteredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.backgroundModalOverlay,
    } as ViewStyle,
    modalView: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      width: "90%",
      maxHeight: "90%",
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      overflow: "hidden",
    } as ViewStyle,
    modalHeader: {
      ...baseHeader,
      justifyContent: "space-between",
      paddingVertical: 12,
    } as ViewStyle,
    modalCloseButton: {
      padding: 4, // Hit area for close button
    },
    modalScrollView: {
      // No specific style needed unless padding is different
    },
    modalSummaryCard: {
      // Container for stats grid in modal
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    } as ViewStyle,
    modalStatGrid: {
      // Grid container within modal summary
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginTop: 8,
    } as ViewStyle,
    modalSection: {
      // Section container within modal
      marginBottom: 24,
    } as ViewStyle,
    modalSectionHeader: {
      // Header for modal sections (Players, Matches)
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    } as ViewStyle,
    modalPlayerInfo: {
      // Left side of modal player row
      flexDirection: "row",
      alignItems: "center",
    } as ViewStyle,
    modalPlayerIcon: {
      // Icon next to player name in modal
      marginRight: 8,
    } as ImageStyle,
    modalMatchLogo: {
      // Logo size in modal match card
      width: 48,
      height: 48,
      marginBottom: 6,
    } as ImageStyle,
    modalMatchPlayers: {
      // Container for player list in modal match card
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    } as ViewStyle,
    modalMatchPlayersList: {
      // Wrapper for player names
      flexDirection: "row",
      flexWrap: "wrap",
    } as ViewStyle,
    modalStatValue: {
      ...textValue,
      fontSize: 20,
      textAlign: "center", // Center align for modal stats
    },
    modalStatLabel: {
      ...textLabel,
      textAlign: "center", // Center align for modal stats
    },
    playerNameContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 8,
    },
    playerIcon: {
      marginRight: 5,
    },
    gameCountBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    gameCountText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: "600",
      marginLeft: 4,
    },
    gamesPlayedText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 8,
    },
    gamePlayedContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      marginBottom: 8,
    },

    // Player Details Modal
    playerDetailsHeader: {
      alignItems: "center",
      paddingVertical: 20,
    },
    playerDetailsName: {
      fontSize: 24,
      fontWeight: "bold",
      marginTop: 12,
      color: colors.textPrimary,
    },
    playerGameItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    playerGameDate: {
      flexDirection: "row",
      alignItems: "center",
    },
    playerGameDateText: {
      marginLeft: 6,
      fontSize: 14,
      color: colors.textSecondary,
    },
    playerGameDrinks: {
      flexDirection: "row",
      alignItems: "center",
    },
    playerGameDrinksText: {
      marginRight: 6,
      fontSize: 16,
      fontWeight: "500",
      color: colors.primary,
    },
    noDataText: {
      textAlign: "center",
      color: colors.textMuted,
      paddingVertical: 16,
    },
    // --- Drink Bar Styles ---
    drinkBarSection: {
      marginVertical: 4,
    },
    drinkBarHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
      justifyContent: "space-between",
    },
    drinkBarLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
      marginLeft: 4,
    },
    drinkBarMaxIndicator: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "500",
    },
    drinkBarContainer: {
      height: 24,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
    },
    drinkBarBackground: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.backgroundLight,
      borderRadius: 12,
    },
    // --- Empty State ---
    emptyStateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    } as ViewStyle,
    startGameButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 25, // Pill shape
    } as ViewStyle,

    emptyTabContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    // Player Comparison Styles
    sectionHeaderButtons: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
    },
    compareButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      paddingHorizontal: 10,
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
    },
    compareButtonText: {
      ...baseText,
      color: colors.primary,
      fontSize: 12,
      fontWeight: "500",
      marginLeft: 4,
    },
    selectionInstructions: {
      ...baseText,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      marginVertical: 8,
    },
    comparisonHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    comparisonHeaderItem: {
      flex: 2,
      alignItems: "center",
    },
    comparisonVs: {
      flex: 1,
      alignItems: "center",
    },
    comparisonVsText: {
      ...textTitle,
      fontSize: 18,
      color: colors.textMuted,
    },
    comparisonPlayerName: {
      ...textTitle,
      fontSize: 16,
      marginTop: 6,
    },
    comparisonSection: {
      marginBottom: 24,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    comparisonSectionTitle: {
      ...textTitle,
      fontSize: 16,
      marginBottom: 12,
    },
    comparisonStats: {
      marginTop: 8,
    },
    comparisonStatItem: {
      marginBottom: 16,
    },
    comparisonStatHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    comparisonStatLabel: {
      ...baseText,
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 6,
    },
    tooltipIcon: {
      marginLeft: 4,
    },
    comparisonValues: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
    },
    comparisonValue: {
      ...textValue,
      fontSize: 18,
    },
    comparisonDivider: {
      fontSize: 12,
      color: colors.textMuted,
      marginHorizontal: 10,
    },
    headToHeadRecord: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
    },
    recordItem: {
      alignItems: "center",
      flex: 1,
    },
    recordValue: {
      ...textValue,
      fontSize: 22,
    },
    recordLabel: {
      ...textLabel,
      fontSize: 12,
    },
    performanceStats: {
      marginTop: 8,
    },
    influenceStats: {
      marginTop: 8,
    },
    influenceItem: {
      marginBottom: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
    },
    influenceLabel: {
      ...baseText,
      fontSize: 14,
      marginBottom: 6,
    },
    influenceValues: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    influenceValue: {
      ...textValue,
      fontSize: 14,
    },
    selectedPlayerCard: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLighter,
    },
    tooltipOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    tooltipContainer: {
      width: "80%",
      maxWidth: 300,
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: "hidden",
      elevation: 5,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    tooltipContent: {
      padding: 16,
    },
    tooltipHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    tooltipTitle: {
      ...textTitle,
      fontSize: 16,
    },
    tooltipDescription: {
      ...baseText,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
  });
}

// Dummy default export to satisfy Expo Router if this file is treated as a route
export default function StyleModuleRoute() {
  return null;
}
