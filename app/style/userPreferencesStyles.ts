import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import { useColors } from "./theme";

export const createUserPreferencesStyles = (
  colors: ReturnType<typeof useColors>
) => {
  const baseContainer: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
  };

  const baseCard: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2.5,
    elevation: 2,
  };

  const baseButton: ViewStyle = {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: colors.primary,
  };

  const baseButtonText: TextStyle = {
    color: colors.textLight,
    fontWeight: "600",
    fontSize: 16,
  };

  const baseSectionTitle: TextStyle = {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 8,
    paddingLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };

  const baseRow: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
  };

  const baseInput: TextStyle = {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  };

  const baseModalContent: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  };

  const commonStyles = StyleSheet.create({
    safeArea: {
      ...baseContainer,
    },
    container: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
    },
    contentContainer: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      ...baseSectionTitle,
    },
    card: {
      ...baseCard,
    },
  });

  const headerStyles = StyleSheet.create({
    header: {
      ...baseRow,
      // Fixed content height to ensure vertical centering within the header box
      minHeight: 48,
      paddingVertical: 8,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      elevation: 2,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
      marginLeft: 8,
    },
  });

  const settingsStyles = StyleSheet.create({
    preferenceRow: {
      ...baseRow,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLighter,
    },
    labelContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    prefIcon: {
      marginRight: 12,
      color: colors.secondary,
    },
    preferenceLabel: {
      fontSize: 16,
      color: colors.textPrimary,
      flex: 1,
    },
    manageButton: {
      backgroundColor: colors.backgroundSubtle,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    manageButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    onboardingButton: {
      ...baseButton,
      marginHorizontal: 16,
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: 10,
    },
    onboardingButtonText: {
      ...baseButtonText,
      marginLeft: 8,
    },
  });

  const addLeagueModalStyles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.backgroundModalOverlay,
    },
    modalContent: {
      ...baseModalContent,
      width: "90%",
      maxHeight: "85%",
    },
    modalHeader: {
      ...baseRow,
      paddingVertical: 0,
      paddingHorizontal: 0,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    modalHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    selectionCounter: {
      fontSize: 14,
      color: colors.success,
      fontWeight: "600",
      marginRight: 8,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.backgroundSubtle,
      borderRadius: 8,
      paddingHorizontal: 12,
      marginBottom: 16,
      marginTop: 16,
      height: 40,
    },
    searchIcon: {
      marginRight: 8,
      color: colors.textMuted,
    },
    searchInput: {
      ...baseInput,
      height: 40,
    },
    clearSearch: {
      padding: 4,
    },
    availableLeaguesList: {
      maxHeight: 400,
      marginBottom: 16,
    },
    availableLeagueItem: {
      ...baseRow,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginVertical: 6,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    selectedLeagueItem: {
      backgroundColor: colors.successLight,
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
      shadowColor: colors.success,
      shadowOpacity: 0.15,
      elevation: 2,
    },
    leagueItemContent: {
      flex: 1,
      justifyContent: "center",
      marginRight: 8,
    },
    availableLeagueName: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    addSelectedButton: {
      ...baseButton,
      backgroundColor: colors.success,
      paddingVertical: 12,
      marginTop: 8,
    },
    addButtonText: {
      ...baseButtonText,
    },
    categoryTabsContainer: {
      marginBottom: 12,
      maxHeight: 50,
    },
    categoryTabsContent: {
      paddingRight: 20,
      alignItems: "center",
    },
    categoryTab: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginRight: 8,
      borderRadius: 16,
      backgroundColor: colors.backgroundSubtle,
      justifyContent: "center",
      alignItems: "center",
      height: 40,
    },
    categoryTabSelected: {
      backgroundColor: colors.primary,
    },
    categoryTabText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
      textAlign: "center",
    },
    categoryTabTextSelected: {
      color: colors.textLight,
    },
    sectionTitleContainer: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    emptyStateContainer: {
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
      height: 100,
    },
    emptyStateText: {
      color: colors.textMuted,
      fontSize: 16,
      textAlign: "center",
    },
    leagueLogoContainer: {
      position: "relative",
      marginRight: 16,
      backgroundColor: colors.backgroundSubtle,
      borderRadius: 6,
      padding: 2,
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    leagueLogo: {
      width: 36,
      height: 36,
      borderRadius: 4,
      overflow: "hidden",
    },
    availableLeagueCategory: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    popularBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      backgroundColor: colors.warning,
      borderRadius: 10,
      width: 14,
      height: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    bulkSelectionContainer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 8,
    },
    bulkSelectionButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.backgroundSubtle,
      borderRadius: 4,
      marginLeft: 8,
    },
    bulkSelectionText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    emptyStateTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 4,
    },
    selectionControls: {
      flexDirection: "row",
      alignItems: "center",
    },
    actionPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primaryLighter,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 16,
      marginLeft: 8,
    },
    actionPillText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.primary,
    },
  });

  const manageLeaguesModalStyles = StyleSheet.create({
    modalSafeArea: {
      ...baseContainer,
      backgroundColor: colors.backgroundLight,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      elevation: 2,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    resetButton: {
      padding: 8,
    },
    contentContainer: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 16,
    },
    leagueHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
    },
    leagueCountText: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.textSecondary,
    },
    leagueListContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    leagueCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    leagueCardContent: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    logoContainer: {
      width: 40,
      height: 40,
      borderRadius: 6,
      marginRight: 12,
      backgroundColor: colors.backgroundSubtle,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    leagueLogo: {
      width: "100%",
      height: "100%",
    },
    leagueLogoPlaceholder: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    leagueInfo: {
      flex: 1,
      justifyContent: "center",
    },
    leagueName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    leagueCode: {
      fontSize: 13,
      color: colors.textMuted,
    },
    removeButton: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: colors.dangerLight,
      marginLeft: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 0,
      paddingVertical: 16,
    },
    emptyStateIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primaryLighter,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    emptyStateMessage: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 22,
    },
    modalHeaderCompact: {
      ...baseRow,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    modalTitleCompact: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    closeButton: {
      padding: 8,
      borderRadius: 20,
    },
    leagueListContainer: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
    },
    leaguesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    ultraCompactCard: {
      width: "48%",
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 8,
      marginBottom: 8,
      marginTop: 4,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    ultraCompactInfo: {
      marginBottom: 4,
    },
    ultraCompactName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    ultraCompactCodeContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    ultraCompactCode: {
      fontSize: 12,
      color: colors.textMuted,
    },
    ultraCompactRemove: {
      marginLeft: 8,
    },
    emptyStateCompact: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: colors.textDisabled,
      textAlign: "center",
      marginTop: 8,
    },
    ultraCompactFooter: {
      ...baseRow,
      justifyContent: "space-between",
      padding: 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    ultraCompactButton: {
      ...baseButton,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    ultraCompactReset: {
      backgroundColor: colors.danger,
    },
    ultraCompactButtonText: {
      ...baseButtonText,
      fontSize: 14,
      fontWeight: "500",
      marginLeft: 6,
    },
    ultraCompactDetailsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    ultraCompactCategory: {
      fontSize: 11,
      color: colors.textMuted,
      backgroundColor: colors.backgroundSubtle,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 6,
    },
    confirmOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.backgroundModalOverlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    confirmDialog: {
      width: "100%",
      maxWidth: 400,
      borderRadius: 16,
      padding: 20,
      backgroundColor: colors.surface,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
    },
    confirmTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    confirmMessage: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 20,
      lineHeight: 20,
    },
    confirmActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    confirmCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.backgroundSubtle,
      marginRight: 12,
    },
    confirmResetBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.danger,
    },
    confirmCancelText: {
      color: colors.textPrimary,
      fontWeight: "500",
      fontSize: 14,
    },
    confirmResetText: {
      color: colors.dangerText,
      fontWeight: "600",
      fontSize: 14,
    },
  });

  const selectDefaultLeaguesModalStyles = StyleSheet.create({
    modalSafeArea: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
      elevation: 2,
    },
    backButton: {
      padding: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
      flex: 1,
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      backgroundColor: colors.backgroundLight,
    },
    leagueHeaderRow: {
      marginBottom: 8,
      paddingHorizontal: 0,
    },
    leagueCountText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    selectionInfoText: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 12,
      textAlign: "center",
    },
    leagueListContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    availableLeagueItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    selectedLeagueItem: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLighter,
      borderWidth: 1,
    },
    leagueLogoContainer: {
      width: 40,
      height: 40,
      borderRadius: 6,
      marginRight: 12,
      backgroundColor: colors.backgroundSubtle,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    leagueLogo: {
      width: "100%",
      height: "100%",
    },
    leagueLogoPlaceholder: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    leagueItemContent: {
      flex: 1,
      justifyContent: "center",
    },
    availableLeagueName: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyStateIcon: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: colors.primaryLighter,
      borderRadius: 50,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyStateMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 16,
      marginBottom: 16,
      marginTop: 10,
    },
    saveButtonText: {
      color: colors.textLight,
      fontSize: 16,
      fontWeight: "bold",
    },
  });

  return {
    commonStyles,
    headerStyles,
    settingsStyles,
    addLeagueModalStyles,
    manageLeaguesModalStyles,
    selectDefaultLeaguesModalStyles,
  } as const;
};

// Dummy default export to satisfy Expo Router if this file is treated as a route
export default function StyleUserPreferencesRoute() {
  return null;
}
