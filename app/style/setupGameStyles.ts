import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from "react-native";

// --- Color Palette ---
export const colors = {
  primary: "#0275d8",
  primaryLight: "#e3f2fd",
  primaryLighter: "#f0f8ff",
  primaryDark: "#0056b3",
  primaryFocus: "#1976d2", // For active/focused elements

  secondary: "#6c757d", // Muted actions, secondary info
  secondaryLight: "#f8f9fa", // Very light gray, often for subtle backgrounds

  success: "#28a745", // Green for success states, start buttons
  successLight: "#eaf6ec",
  successText: "#fff",

  danger: "#dc3545", // Red for errors, delete, end buttons
  dangerLight: "#fbe9e7",
  dangerText: "#fff",

  warning: "#ffc107", // Yellow for warnings
  warningLight: "#fff8e1",
  warningText: "#212529",

  info: "#17a2b8", // Blue for informational messages
  infoLight: "#e0f7fa",

  background: "#f5f5f5", // Main app background
  backgroundLight: "#f8f9fa", // Slightly lighter than main
  backgroundSubtle: "#f0f0f0", // For subtle UI elements like inactive buttons
  backgroundModalOverlay: "rgba(0, 0, 0, 0.5)",

  surface: "#fff", // Card backgrounds, modal backgrounds

  textPrimary: "#212529", // Darkest text for main content
  textSecondary: "#333", // Slightly lighter than primary
  textMuted: "#6c757d", // For less important text, placeholders
  textDisabled: "#adb5bd", // For disabled elements
  textLight: "#fff", // Text on dark backgrounds

  border: "#ddd", // Default border color
  borderLight: "#e0e0e0", // Lighter border
  borderLighter: "#eee", // Even lighter
  borderSubtle: "#e1e4e8", // For subtle divisions

  // Component-specific or semantic colors

  playerItemOddBackground: "#fff8f0",
  countBadgeBorder: "#81d4fa",
  compactMatchItemSelectedBorder: "#b3d7ff",
  processingIndicatorBorder: "#b8daff",
};

// --- Base Styles ---
const baseContainer: ViewStyle = {
  flex: 1,
};

const baseCard: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  shadowColor: colors.textPrimary, // Using a dark color for shadow
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.15,
  shadowRadius: 2,
  elevation: 2,
};

const baseInput: TextStyle = {
  height: 40,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 4,
  paddingHorizontal: 10,
  backgroundColor: colors.backgroundLight,
  color: colors.textSecondary,
  fontSize: 15,
};

const baseButton: ViewStyle = {
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
};

const baseButtonText: TextStyle = {
  color: colors.textLight,
  fontWeight: "600",
  fontSize: 16,
  marginLeft: 8, // Common for icon + text
};

const baseSectionTitle: TextStyle = {
  fontSize: 16,
  fontWeight: "bold",
  color: colors.textPrimary,
  marginBottom: 8,
};

const baseModalView: ViewStyle = {
  margin: 20,
  backgroundColor: colors.surface,
  borderRadius: 20,
  padding: 25, // Increased default padding
  alignItems: "center",
  shadowColor: colors.textPrimary,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5,
};

const styles = StyleSheet.create({
  safeArea: {
    ...baseContainer,
    backgroundColor: colors.background,
    paddingTop: 25, // Consider SafeAreaView component for this
  },
  container: {
    ...baseContainer,
  },
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
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...baseSectionTitle,
    marginTop: 12, // Keep specific override
  },
  input: {
    ...baseInput,
    flex: 1,
    backgroundColor: colors.backgroundSubtle, // Slightly different from baseInput default
  },
  teamInput: {
    ...baseInput, // Apply base and then specific flex
    flex: 0.45,
  },
  addButtonText: {
    // Often used with primary buttons
    color: colors.textLight,
    fontWeight: "bold",
  },
  subtleDeleteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(240, 240, 240, 0.8)", // Kept specific for subtlety
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  instructionText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  assignmentContainer: {
    ...baseCard,
    marginVertical: 12,
    padding: 16,
  },
  playerAssignmentName: {
    ...baseSectionTitle,
    fontSize: 18,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLighter,
  },
  assignmentItem: {
    position: "relative",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },
  selectedAssignmentItem: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary, // Or primaryFocus
  },
  assignmentItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingRight: 24,
  },
  startButton: {
    ...baseButton,
    backgroundColor: colors.success,
    paddingVertical: 16, // Larger padding
    marginVertical: 24,
  },
  startButtonText: {
    ...baseButtonText,
    fontSize: 18, // Larger text
  },
  removeButton: {
    // Generic, might need more context or make more specific
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
  },
  randomizeContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 8,
    marginBottom: 16,
  },
  matchCounterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  matchCountLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  matchItemWrapper: {
    // Used for layout, no specific visual style from palette
    marginBottom: 8,
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  counterButtonText: {
    color: colors.textLight,
    fontSize: 20,
    fontWeight: "bold",
  },
  counterValue: {
    fontSize: 20,
    fontWeight: "bold",
    marginHorizontal: 16,
    color: colors.textPrimary,
  },
  randomizeButton: {
    ...baseButton,
    backgroundColor: colors.primary,
  },
  randomizeButtonText: {
    ...baseButtonText,
    // fontSize: 16, // Already in baseButtonText
  },
  disabledTabText: {
    color: colors.textDisabled,
  },
  tabContent: {
    // Often a padding container
    padding: 16,
  },
  assignmentSection: {
    // Layout
    marginBottom: 24,
  },
  endButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  setupButton: {
    ...baseButton,
    flex: 1,
    backgroundColor: colors.primary,
  },
  endButton: {
    ...baseButton,
    flex: 1,
    backgroundColor: colors.danger,
  },
  buttonText: {
    // Generic button text, can be merged with baseButtonText if identical
    ...baseButtonText,
  },
  centeredView: {
    // For modal overlay
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.backgroundModalOverlay,
  },
  modalView: {
    ...baseModalView,
  },
  modalTitle: {
    ...baseSectionTitle,
    fontSize: 20, // Larger for modal title
    marginBottom: 15,
    textAlign: "center",
  },
  modalText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 15,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 10,
  },
  button: {
    // Generic modal button, can be more specific
    ...baseButton,
    borderRadius: 20, // Softer radius for modal buttons
    paddingVertical: 10, // Adjusted padding
    paddingHorizontal: 20,
    elevation: 2,
    marginHorizontal: 5,
  },
  buttonConfirm: {
    backgroundColor: colors.success,
  },
  buttonCancel: {
    backgroundColor: colors.secondary,
  },
  playerCard: {
    ...baseCard,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 10,
  },
  playerCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerName: {
    ...baseSectionTitle,
    fontSize: 16, // Slightly smaller for card context
    marginBottom: 0, // Override from baseSectionTitle
  },
  smallCounterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.danger, // Or a more specific color like colors.accentPink
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  tinyButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: "bold",
  },
  matchSelectItem: {
    ...baseCard,
    margin: 4,
    padding: 12,
    minHeight: 60,
  },
  matchesGridContainer: {
    padding: 8,
    paddingBottom: 80, // For potential floating action buttons
  },
  playersListContent: {
    // Used by FlatList
    padding: 8,
    paddingBottom: 80,
  },
  matchGridItem: {
    ...baseCard,
    margin: 8,
    padding: 16,
    minHeight: 80,
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  matchTeams: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textSecondary,
    flex: 1,
  },
  commonMatchLabel: {
    backgroundColor: colors.success, // Or successDark if defined
    color: colors.textLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    fontSize: 12,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  matchText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  textStyle: {
    // Generic, often for modal button text
    color: colors.textLight,
    fontWeight: "bold",
    textAlign: "center",
  },
  wizardContainer: {
    ...baseContainer,
    backgroundColor: colors.background,
    display: "flex", // Default for RN, can be removed
    flexDirection: "column",
  },
  stepIndicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  stepButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.backgroundSubtle,
  },
  activeStepButton: {
    backgroundColor: colors.primary,
  },
  stepText: {
    color: colors.textMuted,
    fontWeight: "500",
  },
  activeStepText: {
    color: colors.textLight,
    fontWeight: "bold",
  },
  stepConnector: {
    height: 2,
    width: 30,
    backgroundColor: colors.borderLight,
    marginHorizontal: 8,
  },
  activeStepConnector: {
    backgroundColor: colors.primary,
  },
  stepContentScroll: {
    // Layout
    flex: 1,
  },
  wizardNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  navButton: {
    ...baseButton,
    backgroundColor: colors.primary,
    paddingVertical: 10, // Override baseButton if needed
  },
  navButtonText: {
    ...baseButtonText,
    marginHorizontal: 8, // Keep specific if needed
  },
  suggestionsContainer: {
    position: "relative",
    flex: 0.45, // Layout specific
    zIndex: 1000, // Ensure suggestions are on top
  },
  suggestionsList: {
    position: "absolute",
    top: 45, // Adjust based on input height
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    elevation: 5, // Android shadow
    shadowColor: colors.textPrimary, // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLighter,
  },
  suggestionItemText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  overlayArea: {
    // For dismissing suggestions via tap outside
    position: "absolute",
    top: 200, // Highly layout dependent
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 900, // Below suggestionsList
  },
  modalOverlay: {
    // Transparent overlay
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.1)", // Kept specific for subtle effect
  },
  suggestionsModal: {
    // If suggestions are in a modal structure
    position: "absolute",
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 5,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: 300, // Limit height
    zIndex: 9999, // Highest zIndex
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: colors.primary,
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  errorText: {
    marginLeft: 8,
    color: colors.danger,
    fontSize: 14,
  },
  dropdownBox: {
    ...baseInput,
    borderRadius: 8, // Softer radius
    borderColor: colors.borderLight,
    paddingVertical: 8, // Adjust padding for dropdown
  },
  dropdownInput: {
    // Text style within the dropdownBox
    color: colors.textSecondary,
    fontSize: 14,
  },
  dropdown: {
    // The dropdown list itself
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: colors.surface,
  },
  dropdownText: {
    // Text style for items in the dropdown list
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 10, // Add padding to items
    paddingVertical: 10,
  },
  filterContainer: {
    // Layout
    marginBottom: 15,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: colors.primaryLighter,
    borderRadius: 6,
  },
  filterToggleText: {
    color: colors.primary, // Or textLink
    fontWeight: "500",
  },
  timeFilterControls: {
    marginTop: 10,
    padding: 12,
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  timeInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  timeLabel: {
    width: 80, // Layout specific
    fontSize: 14,
    color: colors.textSecondary,
  },
  filterStatusText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  addAllButton: {
    ...baseButton,
    backgroundColor: colors.success,
    paddingVertical: 8, // Smaller padding
    paddingHorizontal: 16,
    borderRadius: 4, // Sharper radius
    marginLeft: 10,
  },
  addAllButtonText: {
    ...baseButtonText,
    fontWeight: "500", // Slightly less bold
    fontSize: 15,
  },
  clearButton: {
    // For clearing inputs, often subtle
    padding: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: colors.textMuted, // Or textPlaceholder
  },
  emptyListContainer: {
    padding: 15,
    alignItems: "center",
  },
  emptyListText: {
    color: colors.textMuted,
    marginBottom: 10,
    textAlign: 'center', 
    paddingHorizontal: 20, 
  },
  addNewButton: {
    ...baseButton,
    paddingVertical: 8,
    backgroundColor: colors.primaryLighter, // Or primaryPale
    borderRadius: 4,
    margin: 10, // Layout specific
  },
  addNewButtonText: {
    color: colors.primary, // Or textLink
    fontSize: 15,
  },
  modalContainer: {
    // Full screen modal overlay
    ...baseContainer,
    backgroundColor: colors.backgroundModalOverlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    // Content area within a full screen modal
    backgroundColor: colors.surface,
    borderRadius: 8,
    width: "100%",
    maxHeight: "80%",
    padding: 10,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLighter,
  },
  modalSearchInput: {
    ...baseInput,
    flex: 1,
    borderColor: colors.border, // Slightly darker than baseInput default
    marginRight: 10,
  },
  modalCloseButton: {
    ...baseButton,
    paddingVertical: 8, // Smaller padding
    paddingHorizontal: 10,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
  },
  modalCloseText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  modalItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLighter,
  },
  modalItemText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  searchInput: {
    ...baseInput, // Apply base and remove conflicting properties
    borderWidth: 0, // Handled by searchInputContainer
    backgroundColor: "transparent", // Handled by searchInputContainer
    flex: 1,
    height: "100%", // Fill container
    paddingVertical: 0, // Remove default padding if not needed
    paddingHorizontal: 0,
  },
  leagueFilterContainer: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: colors.background, // Or backgroundLight
    borderRadius: 8,
  },
  leagueFilterLabel: {
    ...baseSectionTitle,
    fontSize: 16, // Keep specific
    marginBottom: 5, // Override base
  },
  leagueButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  leagueButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.backgroundSubtle, // Or neutralMedium
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leagueButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  leagueButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  leagueButtonTextSelected: {
    color: colors.textLight,
  },
  modalItemLeague: {
    // Subtext in modal items
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  leagueChipsContainer: {
    // Layout
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  leagueChipsScrollContent: {
    // For ScrollView contentContainerStyle
    paddingVertical: 8,
  },
  leagueChip: {
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4, // For wrapping
    flexDirection: "row", // For icon + text
    alignItems: "center",
  },
  selectedLeagueChip: {
    backgroundColor: colors.primaryLight,

    borderWidth: 1,
  },
  leagueChipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedLeagueChipText: {
    color: colors.primary,
    fontWeight: "500",
  },
  chipLogo: {
    width: 20,
    height: 20,
    resizeMode: "contain",
    marginRight: 6,
  } as ImageStyle,
  chipContainer: {
    // Generic container for chips if needed
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  filterSectionTitle: {
    // More specific than baseSectionTitle
    fontSize: 15,
    fontWeight: "600", // Bolder
    color: colors.textPrimary,
    marginBottom: 10,
  },
  inputGroup: {
    // Layout
    marginBottom: 12,
  },
  labeledInput: {
    // Layout
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  dateInput: {
    ...baseInput,
    backgroundColor: colors.backgroundSubtle,
  },
  timeInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeSeparatorText: {
    color: colors.textMuted,
    fontSize: 14,
    marginHorizontal: 5, // Added for spacing
  },
  filterSummary: {
    backgroundColor: colors.primaryLighter, // Or infoLight
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
  },
  matchCountText: {
    color: colors.primary, // Or textLink
    fontWeight: "500",
    fontSize: 14,
  },
  filterButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  resetFilterButton: {
    ...baseButton,
    paddingVertical: 8, // Smaller padding
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSubtle,
  },
  resetFilterText: {
    color: colors.textMuted,
    fontSize: 14,
    marginLeft: 4,
  },
  applyFilterButton: {
    ...baseButton,
    paddingVertical: 8, // Smaller padding
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
  },
  applyFilterText: {
    ...baseButtonText,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
  },
  expandableCard: {
    ...baseCard,
    borderColor: colors.borderSubtle,
    marginBottom: 16,
    borderRadius: 10, // Softer radius
    overflow: "hidden", // For content clipping
  },
  expandableCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  expandableCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandableCardTitle: {
    ...baseSectionTitle,
    fontSize: 16, // Keep specific
    fontWeight: "600", // Bolder
    color: colors.textSecondary,
    marginLeft: 10,
    marginBottom: 0, // Override base
  },
  rightContent: {
    // Layout
    flexDirection: "row",
    alignItems: "center",
  },
  compactIndicator: {
    // For expand/collapse icon
    marginLeft: 8,
    padding: 4,
  },
  expandedCardContent: {
    padding: 16,
    backgroundColor: colors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  processingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primaryLighter,
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.processingIndicatorBorder,
  },
  matchTeamsSection: {
    // Layout
    flex: 1,
    paddingVertical: 6,
    paddingLeft: 10,
  },
  matchTeamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  matchDivider: {
    // For "vs" text layout
    alignItems: "flex-start",
    marginVertical: 2,
    paddingLeft: 10,
  },
  matchTeamLogo: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    marginRight: 8,
  } as ImageStyle,
  matchTeamName: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    fontWeight: "500",
  },
  matchVsText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  matchActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 6,
  },
  matchSelectionIndicator: {
    // For checkbox/radio
    marginRight: 8,
    padding: 2,
  },
  matchDeleteButton: {
    // Subtle delete
    padding: 4,
  },
  matchAddButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  matchAddButtonDisabled: {
    backgroundColor: colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  matchEmptyListContainer: { 
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 20, 
    marginTop: 20,
    marginHorizontal: 8, 
  },
  gridContainer: {
    // For 2 or 3 column grids
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between", // Or space-around
  },
  gridItem: {
    // Generic grid item, often needs width override
    width: "32%", // Example for 3-column
    marginBottom: 8,
  },
  compactMatchItem: {
    borderRadius: 8,
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.borderLighter, // Or borderSubtle
  },
  selectedCompactMatchItem: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.compactMatchItemSelectedBorder,
  },
  compactTeamsContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  compactTeamLogo: {
    width: 26,
    height: 26,
    borderRadius: 13, // Circular
  } as ImageStyle,
  compactVsText: {
    fontSize: 10,
    color: colors.textMuted,
    marginHorizontal: 4,
  },
  compactCheckContainer: {
    // For selection checkmark
    marginLeft: 2,
  },
  playerHeader: {
    // Header for a player section/card
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  playerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerBadge: {
    backgroundColor: colors.primaryLight, // Or a specific badge color
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  playerBadgeText: {
    fontSize: 13,
    color: colors.primary, // Or textLink
  },
  chevronIcon: {
    // For expand/collapse
    marginRight: 8,
  },
  sectionHeader: {
    // Generic header for sections within a screen
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerActionsRow: {
    // For buttons/icons in a section header
    flexDirection: "row",
    alignItems: "center",
  },
  layoutToggleButton: {
    // For toggling list/grid view
    marginRight: 12,
  },
  playerContainer: {
    // Container for a single player's info/actions
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLighter,
    paddingBottom: 8,
  },
  inputContainer: {
    // More specific than baseInput, often for styled inputs
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 48, // Taller than baseInput
    backgroundColor: colors.backgroundLight, // Specific background
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
    color: colors.textMuted, // Icon color
  },
  textInput: {
    // Text input style within inputContainer
    ...baseInput, // Apply base and override
    flex: 1,
    height: "100%",
    borderWidth: 0, // Handled by container
    backgroundColor: "transparent", // Handled by container
    paddingHorizontal: 0, // Remove base padding
  },
  addButton: {
    // Generic add button, often square/circular
    ...baseButton,
    width: 48, // Square
    height: 48,
    backgroundColor: colors.primary, // Or playerAddButton color
    borderRadius: 8, // Or 24 for circular
    paddingVertical: 0, // Override baseButton
    paddingHorizontal: 0,
    marginLeft: 10,
  },
  addButtonDisabled: {
    backgroundColor: colors.textDisabled, // Or playerAddButtonDisabled
  },
  clearAllButton: {
    // Prominent clear all action
    ...baseButton,
    marginTop: 20,
    backgroundColor: colors.danger,
    alignSelf: "center", // Often centered
  },
  clearAllButtonText: {
    ...baseButtonText,
    // fontSize: 16, // Already in base
    // fontWeight: "bold", // Already in base
  },
  filterCard: {
    // Re-declared, ensure consistency or merge
    ...baseCard,
    marginBottom: 12,
    borderRadius: 12, // Softer radius
    overflow: "hidden",
    shadowOpacity: 0.1, // Softer shadow
    elevation: 3, // Slightly more elevation
  },
  filterCardHeader: {
    padding: 16,
    backgroundColor: colors.surface, // Explicit for header part
  },
  filterCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: "25%", // Layout specific
  },
  filterTitle: {
    ...baseSectionTitle,
    fontSize: 16, // Keep specific
    fontWeight: "600", // Bolder
    marginLeft: 10,
    color: colors.textSecondary,
    marginBottom: 0, // Override base
  },
  filterBadgesSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  filterBadgesScroll: {
    // For horizontal scroll of badges
    maxWidth: "85%", // Layout specific
  },
  filterBadgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap", // Allow badges to wrap if too many
    justifyContent: "flex-end",
  },
  filterBadge: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 5,
    marginLeft: 6,
    marginBottom: 4, // For wrapping
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    maxWidth: 110, // Prevent very long badges
  },
  filterBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 3,
  },
  badgeLogo: {
    width: 20,
    height: 20,
    resizeMode: "contain",
    marginRight: 2,
  } as ImageStyle,
  countBadge: {
    borderColor: colors.countBadgeBorder,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 5,
    marginLeft: 6,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    maxWidth: 110,
  },
  countBadgeText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "500",
    paddingHorizontal: 2,
  },
  noFiltersText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  indicatorContainer: {
    // For expand/collapse icon in filter card
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    backgroundColor: colors.backgroundLight, // Consistent light bg
    borderRadius: 14, // Circular
  },
  expandedContent: {
    // Content shown when filter card is expanded
    backgroundColor: colors.backgroundLight, // Or F9FAFC if defined
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle, // Or EAEFF5
  },
  filterSection: {
    // Section within expanded filter content
    marginBottom: 16,
  },
  filterInput: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },
  activeInput: {
    // When a filter input is active/focused
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderLeftColor: colors.primaryFocus, // Or 1976d2
    borderLeftWidth: 4,
  },
  inputText: {
    // Text within filterInput
    color: colors.textSecondary,
    fontSize: 15,
  },
  activeInputText: {
    fontWeight: "500",
    color: colors.textPrimary, // Darker when active
  },
  timeInput: {
    flex: 1,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },
  timeSeparator: {
    marginHorizontal: 10,
    color: colors.textMuted,
    fontWeight: "500",
  },
  resultsSummary: {
    // Summary of filter results
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  matchCountContainer: {
    // Container for displaying match count
    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  matchCount: {
    marginLeft: 6,
    fontSize: 13,
    color: colors.textPrimary,
  },
  filterActionButton: {
    ...baseButton,
    backgroundColor: colors.primaryFocus, // Or 1976d2
    borderRadius: 8,
    paddingVertical: 8, // Smaller padding
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  filterActionButtonText: {
    ...baseButtonText,
    fontSize: 13,
    marginLeft: 4,
  },
  disabledButton: {
    // Generic disabled button state
    backgroundColor: colors.textDisabled, // Or c5c5c5
    opacity: 0.7,
  },
  leagueGrid: {
    // For displaying leagues in a grid
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start", // Or space-around
    paddingHorizontal: 8, // Outer padding for the grid
  },
  leagueGridItem: {
    // Individual item in the league grid
    backgroundColor: colors.backgroundSubtle, // Or f1f3f4
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8, // Spacing between items
    marginBottom: 8,
    minWidth: 100, // Ensure some minimum width
    maxWidth: "46%", // Allow 2 items per row with margin
    // Add alignItems: 'center' if content needs centering
  },

  // Player List specific styles (already well-defined, applying palette)
  playerInputContainer: {
    // This was duplicated, ensuring one definition
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    backgroundColor: colors.backgroundLight,
    borderRadius: 10,
    // borderWidth: 0, // Already default
    paddingHorizontal: 15,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playerInputIcon: {
    marginRight: 10,
    color: colors.textMuted, // Icon color
  },
  playerTextInput: {
    ...baseInput, // Apply base and override
    flex: 1,
    height: "100%",
    borderWidth: 0, // Handled by container
    backgroundColor: "transparent", // Handled by container
    paddingHorizontal: 0, // Remove base padding
    color: colors.textSecondary, // Ensure text color
  },
  playerAddButton: {
    ...baseButton,
    width: 50, // Square
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 25, // Circular
    paddingVertical: 0, // Override base
    paddingHorizontal: 0,
    marginLeft: 10,
    shadowColor: colors.primary, // Shadow with button color
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  playerAddButtonDisabled: {
    backgroundColor: colors.textDisabled,
    elevation: 0, // Flatten disabled button
    shadowOpacity: 0,
  },
  playerItemContainer: {
    ...baseCard, // Apply base card style
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 12, // Softer radius
    marginBottom: 10,
    borderWidth: 0, // Override baseCard border if not needed
    shadowOpacity: 0.05, // Very subtle shadow
    elevation: 2, // Keep consistent elevation
    overflow: "hidden", // For rounded corners with content
  },
  playerItemEven: {
    backgroundColor: colors.primaryLighter,
  },
  playerItemOdd: {
    backgroundColor: colors.playerItemOddBackground,
  },
  playerAvatar: {
    marginRight: 15,
    width: 40,
    height: 40,
    borderRadius: 20, // Circular
    justifyContent: "center",
    alignItems: "center",
    // Background color will be from LinearGradient
  },
  playerAvatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textLight, // Text on gradient
  },
  playerNameText: {
    flex: 1,
    fontSize: 16,
    color: colors.textSecondary,
  },
  playerRemoveButton: {
    // HitSlop area for the remove icon
    padding: 5,
  },
  playerCount: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 5,
    marginBottom: 10,
    textAlign: "right",
  },
  playerEmptyListContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 30,
    marginTop: 20,
  },
  playerClearAllButton: {
    ...baseButton,
    marginTop: 15,
    marginBottom: 10,
    backgroundColor: colors.danger, // Use semantic danger color
    alignSelf: "center",
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  playerClearAllButtonText: {
    ...baseButtonText,
    fontSize: 14, // Keep specific size if needed
  },
  lottieAnimation: {
    width: 75,
    height: 75,
    alignSelf: "center",
  } as ViewStyle,
  inputRow: {
    flexDirection: "row",
    marginBottom: 16, // Increased margin for more space
    alignItems: "center",
  },
  teamInputWrapper: {
    flex: 1, // Allow inputs to take available space
  },
  teamSearchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 50, // Increased height
  },
  teamSearchFieldSelected: {
    borderColor: colors.primaryFocus,
    backgroundColor: colors.surface,
  },
  teamSearchIcon: {
    marginRight: 8,
  },
  teamSearchText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary, // Default color
  },
  teamSearchTextPlaceholder: {
    color: colors.textMuted,

  },
  teamSearchTextSelected: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  teamClearButton: {
    paddingLeft: 8, // Add some padding for easier touch
  },
  vsText: {
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textSecondary,
  },
  
});

export default styles;
