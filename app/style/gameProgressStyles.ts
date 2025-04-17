import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  // ============ Layout & Container Styles ============
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    display: "flex",
    flexDirection: "column",
    paddingTop: 25,
  },
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  contentContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  section: {
    marginBottom: 24,
  },

  // ============ Tab Navigation Styles ============
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: "#0275d8", // Active tab background
  },
  tabText: {
    fontSize: 16,
    color: "#333", // Default text color
  },
  activeTabText: {
    color: "#fff", // Active tab text color
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
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    marginLeft: 8,
  },
  sectionHelp: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    textAlign: "center",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },

  // ============ List Container Styles ============
  matchesGridContainer: {
    padding: 8,
    paddingBottom: 80,
  },
  playersListContent: {
    padding: 8,
    paddingBottom: 80, // Extra padding to ensure content isn't hidden behind buttons
  },

  liveIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#e74c3c",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "column",
    alignItems: "center",
  },
  liveText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  layoutToggleButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "rgba(2, 117, 216, 0.08)",
  },
  // New styles for live scores
  scoreText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0275d8",
    marginHorizontal: 25,
  },
  gridLiveIndicator: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "#e74c3c",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  gridLiveText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "bold",
  },
  gridScoreText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0275d8",
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
  minutesPlayedText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#e74c3c",
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
  listMinutesContainer: {
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "#10b981",
  },
  statusIdle: {
    backgroundColor: "#adb5bd",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    backgroundColor: "rgba(2, 117, 216, 0.08)",
  },
  lastUpdateText: {
    fontSize: 12,
    color: "#495057",
    fontWeight: "500",
    marginLeft: 4,
  },

  // ============ Match Item Styles ============
  matchGridItem: {
    flex: 1,
    margin: 8,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    minHeight: 100,
    position: "relative",
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
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
    borderLeftColor: "#e0e0e0",
    paddingLeft: 8,
    justifyContent: "center",
  },
  matchTeams: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
    paddingRight: 8,
  },
  matchTeamsWithCommonBadge: {
    marginTop: 4,
  },
  matchItem: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  matchInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  matchText: {
    fontSize: 16,
    fontWeight: "bold",
  },

  // ============ Badge & Tag Styles ============
  commonTag: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#4caf50",
  },
  commonMatchBadge: {
    backgroundColor: "#007bff",
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: "bold",
  },
  commonMatchLabel: {
    backgroundColor: "#4caf50",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    fontSize: 12,
    marginTop: 8,
  },
  goalBadge: {
    backgroundColor: "#0275d8",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  goalBadgeText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  commonBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#4caf50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  commonBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
  },
  quickStatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  owedZeroBadge: {
    backgroundColor: "#e8f5e9",
    borderColor: "#81c784",
  },
  owedPositiveBadge: {
    backgroundColor: "#ffebee",
    borderColor: "#e57373",
  },

  // ============ Player Card Styles ============
  playerCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  playerCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  playerName: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 0,
  },

  // ============ Stats & Counter Styles ============
  drinkStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
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
    color: "#666",
    marginBottom: 4,
  },
  compactStatValue: {
    fontSize: 18,
    fontWeight: "bold",
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
  },
  goalLabelLarge: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  goalValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  goalLabel: {
    fontSize: 12,
    color: "#666",
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
  },
  drinkLabel: {
    fontSize: 12,
    color: "#666",
  },

  // ============ Owed Value Styles ============
  owedValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  owedLabel: {
    fontSize: 12,
    color: "#666",
  },
  owedPositive: {
    color: "#dc3545",
  },
  owedZero: {
    color: "#28a745",
  },
  quickStatText: {
    fontSize: 13,
    fontWeight: "500",
  },
  owedZeroText: {
    color: "#388e3c",
  },
  owedPositiveText: {
    color: "#d32f2f",
  },

  // ============ Button Styles ============
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginHorizontal: 5,
  },
  counterButton: {
    width: 36,
    height: 36,
    backgroundColor: "#007bff",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  counterValueContainer: {
    alignItems: "center",
    marginHorizontal: 16,
  },
  counterButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  quickActionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  decrementButton: {
    backgroundColor: "#f44336",
  },
  incrementButton: {
    backgroundColor: "#4caf50",
  },
  quickActionButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  smallCounterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
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
  tinyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  tinyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
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
    color: "#007bff",
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#666",
  },
  historyButton: {
    flex: 1,
    backgroundColor: "#6c757d",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 5,
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: "#666",
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
    flex: 1,
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  setupButton: {
    flex: 1,
    backgroundColor: "#0275d8",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  endButton: {
    flex: 1,
    backgroundColor: "#dc3545",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  endButtonText: {
    color: "#fff",
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
    backgroundColor: "#dc3545", // Red
  },
  buttonCancel: {
    backgroundColor: "#6c757d", // Gray
  },

  // ============ Quick Actions Styles ============
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

  // ============ Player Assignment Styles ============
  assignedPlayersContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 8,
  },
  assignedPlayerName: {
    fontSize: 12,
    color: "#666",
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
    color: "#999",
    textAlign: "center",
  },
  affectedPlayersList: {
    maxHeight: 120,
    width: "100%",
  },
  affectedPlayerText: {
    fontSize: 14,
    paddingVertical: 4,
  },
  impactLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 16,
    marginBottom: 8,
  },
  matchAssignments: {
    marginTop: 16,
  },
  assignmentLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  assignmentText: {
    fontSize: 14,
    color: "#333",
  },

  // ============ Modal Styles ============
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  // ============ Match Grid Styles ============
  matchCardContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    position: "relative",
  },
  matchCommonBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#4caf50",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    zIndex: 10,
  },
  matchCommonBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  matchHeaderSection: {
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fcfcfc",
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
  },
  matchTeamName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    color: "#333",
  },
  matchVsBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  matchVsText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#666",
  },
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
    color: "#0275d8",
    marginLeft: 4,
  },
  matchDetailsDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 10,
  },
  matchCompactPlayersSection: {
    flex: 1,
    flexDirection: "column",
  },
  matchPlayerCount: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  matchPlayerPreview: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },
  listContainer: {
    padding: 10,
  },
  matchListItemContainer: {
    backgroundColor: "#fff",
    marginBottom: 12,
    borderRadius: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#eaeaea",
  },
  matchListHeaderSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
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
  },
  matchListTeamName: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  matchListDivider: {
    alignSelf: "center",
    marginVertical: 2,
  },
  matchListVsText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "bold",
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
    color: "#0275d8",
    marginLeft: 4,
  },
  matchListCommonBadge: {
    backgroundColor: "#d4edda",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  matchListCommonBadgeText: {
    fontSize: 12,
    color: "#155724",
    fontWeight: "bold",
  },
  matchListPlayersSection: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
    marginTop: 4,
  },
  matchListPlayersLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  matchListPlayersNames: {
    fontSize: 14,
    color: "#333",
  },
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
    color: "#333",
  },
  toggleButton: {
    padding: 8,
  },
  gridContainer: {
    padding: 8,
    paddingBottom: 80,
  },
  gridRow: {
    flex: 1,
    justifyContent: "space-between",
  },
  gridItem: {
    flex: 1,
    margin: 6,
    height: 90, // Reduced height since we removed team names
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    position: "relative",
  },
  commonIndicator: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4caf50",
  },
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
  },
  vsText: {
    fontSize: 14,
    color: "#888",
    marginHorizontal: 10,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
    marginLeft: 4,
  },
  playerPreview: {
    fontSize: 11,
    color: "#888",
    marginLeft: 4,
  },
  sortToggleButton: {
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPlayerCount: {
    fontSize: 13,
    color: '#666',
  },
  playerBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  playerBadge: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 4,
    marginBottom: 2,
  },
  playerBadgeText: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: '#eeeeee',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 11,
    color: '#616161',
    fontWeight: '500',
  },
});

export default styles;
