import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Match background of other screens
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    marginVertical: 24,
  },
  gameItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  gameDate: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  gameSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0275d8', // Match blue accent color
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  playerList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0', // Match border color used elsewhere
    paddingTop: 8,
  },
  playerListTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  playerItemName: {
    fontSize: 14,
    color: '#333',
  },
  playerItemDrinks: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0275d8', // Match blue accent color
  },
  playerStatItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  playerStatName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  playerStatDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playerStatDetail: {
    alignItems: 'center',
    flex: 1,
  },
  playerStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0275d8', // Match blue accent color
  },
  playerStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0275d8', // Match blue accent color
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 24,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#6c757d', // Match secondary button color
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  centerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalScrollView: {
    width: '100%',
  },
  modalTitle: {
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSection: {
    width: '100%',
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  playerDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    width: '100%',
  },
  playerName: {
    fontSize: 16,
    color: '#333',
  },
  playerDrinks: {
    fontSize: 16,
    color: '#fff',
  },
  drinkBadge: {
    backgroundColor: '#0275d8', // Match blue accent color
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  matchDetail: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    width: '100%',
  },
  matchDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  commonBadge: {
    backgroundColor: '#4caf50', // Match green used for common badges
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  commonBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  matchGoals: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  assignedPlayersSection: {
    marginTop: 8,
  },
  assignedPlayersTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  assignedPlayersList: {
    marginLeft: 8,
  },
  assignedPlayerName: {
    fontSize: 14,
    marginBottom: 2,
    color: '#555',
  },
  modalActions: {
    alignItems: 'center',
    marginTop: 16,
  },
  closeButton: {
    backgroundColor: '#0275d8', // Match blue accent color
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  expandButton: {
    marginTop: 4,
    alignSelf: 'center',
    padding: 8,
  },
  expandButtonText: {
    color: '#0275d8', // Match blue accent color
    fontSize: 14,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0275d8',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#0275d8',
    fontWeight: 'bold',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptyStateImage: {
    width: 120,
    height: 120,
    opacity: 0.5,
    marginBottom: 16,
  },
});