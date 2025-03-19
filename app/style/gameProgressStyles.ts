import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  // ============ Layout & Container Styles ============
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 25
  },
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  contentContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
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
    flexDirection: 'row',
  },
  tabContent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  
  // ============ Text Styles ============
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: 8,
  },
  sectionHelp: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
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
  
  // ============ Match Item Styles ============
  matchGridItem: {
    flex: 1,
    margin: 8,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    minHeight: 100,
    position: 'relative',
  },
  commonMatchGridItem: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  matchCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  matchDetailsSection: {
    flex: 0.6,
    position: 'relative',
    paddingRight: 8,
    alignItems: 'center', 
    justifyContent: 'center', 
  },
  playerNamesSection: {
    flex: 0.4,  
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
    paddingLeft: 8,
    justifyContent: 'center',
  },
  matchTeams: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    paddingRight: 8,
  },
  matchTeamsWithCommonBadge: {
    marginTop: 4,
  },
  matchItem: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  matchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // ============ Badge & Tag Styles ============
  commonTag: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#4caf50',
  },
  commonMatchBadge: {
    backgroundColor: '#007bff',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  commonMatchLabel: {
    backgroundColor: '#4caf50',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    fontSize: 12,
    marginTop: 8,
  },
  goalBadge: {
    backgroundColor: '#ff5722',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  goalBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  commonBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#4caf50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  commonBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  quickStatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  owedZeroBadge: {
    backgroundColor: '#e8f5e9',
    borderColor: '#81c784',
  },
  owedPositiveBadge: {
    backgroundColor: '#ffebee',
    borderColor: '#e57373',
  },
  
  // ============ Player Card Styles ============
  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  playerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  
  // ============ Stats & Counter Styles ============
  drinkStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statItemWithControls: {
    alignItems: 'center',
    flex: 1,
  },
  compactDrinkStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  compactStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  compactStatWithControls: {
    alignItems: 'center',
    flex: 2,
  },
  compactStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  compactStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // ============ Goal Counter Styles ============
  goalCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCounterLarge: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  goalValueLarge: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  goalLabelLarge: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  goalValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  goalLabel: {
    fontSize: 12,
    color: '#666',
  },
  
  // ============ Drink Counter Styles ============
  drinkCounter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drinkValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  drinkLabel: {
    fontSize: 12,
    color: '#666',
  },
  
  // ============ Owed Value Styles ============
  owedValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  owedLabel: {
    fontSize: 12,
    color: '#666',
  },
  owedPositive: {
    color: '#dc3545',
  },
  owedZero: {
    color: '#28a745',
  },
  quickStatText: {
    fontSize: 13,
    fontWeight: '500',
  },
  owedZeroText: {
    color: '#388e3c',
  },
  owedPositiveText: {
    color: '#d32f2f',
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
    backgroundColor: '#007bff',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValueContainer: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  counterButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quickActionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  decrementButton: {
    backgroundColor: '#f44336',
  },
  incrementButton: {
    backgroundColor: '#4caf50',
  },
  quickActionButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  smallCounterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  consumedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  compactControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  tinyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // ============ Navigation & Action Button Styles ============
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 16,
    color: '#007bff',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  historyButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 5,
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: '#666',
  },
  
  // ============ Footer Button Styles ============
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    gap: 8,
  },
  homeButton: {
    flex: 1,
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  setupButton: {
    flex: 1,
    backgroundColor: '#0275d8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  endButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  endButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  endButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    width: '100%',
    alignItems: 'center',
    padding: 16,
  },
  goalQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  
  // ============ Player Assignment Styles ============
  assignedPlayersContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  assignedPlayerName: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  playerNamesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  noPlayersText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
  },
  affectedPlayersList: {
    maxHeight: 120,
    width: '100%',
  },
  affectedPlayerText: {
    fontSize: 14,
    paddingVertical: 4,
  },
  impactLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  matchAssignments: {
    marginTop: 16,
  },
  assignmentLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  assignmentText: {
    fontSize: 14,
    color: '#333',
  },
  
  // ============ Modal Styles ============
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center"
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  
});

export default styles;