import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from "react-native";

// --- Color Palette ---
export const colors = {
  primary: "#0275d8",
  primaryLight: "#e3f2fd",
  primaryLighter: "#f0f8ff",
  primaryDark: "#0056b3",
  primaryFocus: "#1976d2",

  secondary: "#6c757d",
  secondaryLight: "#f8f9fa",

  success: "#28a745",
  successLight: "#eaf6ec",
  successText: "#fff",

  danger: "#dc3545",
  dangerLight: "#fbe9e7",
  dangerText: "#fff",

  warning: "#ffc107",
  warningLight: "#fff8e1",

  background: "#f5f5f5",
  backgroundLight: "#f8f9fa",
  backgroundSubtle: "#f0f0f0",
  backgroundModalOverlay: "rgba(0, 0, 0, 0.5)",

  surface: "#fff",

  textPrimary: "#212529",
  textSecondary: "#333",
  textMuted: "#6c757d",
  textDisabled: "#adb5bd",
  textLight: "#fff",

  border: "#ddd",
  borderLight: "#e0e0e0",
  borderLighter: "#eee",
  borderSubtle: "#e9ecef",

  switchTrackOff: "#d1d1d1",
  switchTrackOn: "#a3c9f0",
  thumbOn: "#0275d8",
  thumbOff: "#f4f3f4",
};

// --- Base Styles ---
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

export const commonStyles = StyleSheet.create({
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

export const headerStyles = StyleSheet.create({
  header: {
    ...baseRow,
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
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginLeft: 12,
  },
});

export const settingsStyles = StyleSheet.create({
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
  leaguesSummary: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
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

export const addLeagueModalStyles = StyleSheet.create({
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLighter,
  },
  selectedLeagueItem: {
    backgroundColor: colors.successLight,
  },
  leagueItemContent: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  availableLeagueName: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  availableLeagueCode: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
    minHeight: 40,
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
  leagueLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
    borderRadius: 4,
    overflow: "hidden",
  },
  availableLeagueCategory: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  leagueLogoContainer: {
    position: "relative",
    marginRight: 12,
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
});

export const manageLeaguesModalStyles = StyleSheet.create({
  modalSafeArea: {
    ...baseContainer,
    backgroundColor: colors.backgroundLight,
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
  leagueListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: 12,
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
  leagueLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
    borderRadius: 4,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 8,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  backButton: {
    padding: 8,
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
    fontSize: 15,
    fontWeight: "500",
    color: colors.textSecondary,
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
  leagueLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.backgroundSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  leagueCode: {
    fontSize: 13,
    color: colors.textMuted,
  },
  removeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.dangerLight,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
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
  footer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
});
