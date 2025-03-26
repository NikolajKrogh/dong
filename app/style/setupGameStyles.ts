import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5", // Light background
    paddingTop: 25, 
  },
  container: {
    flex: 1,
  },
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
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    marginLeft: 8,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f8f8f8",
  },
  teamInput: {
    flex: 0.45,
  },
  vsText: {
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: "bold",
  },
  addButton: {
    backgroundColor: "#007bff",
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  subtleDeleteButton: {
    position: 'absolute',
    top: 12,           // Match the paddingVertical of assignmentItem
    right: 12,         // A bit less than paddingHorizontal for better alignment
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(240, 240, 240, 0.8)', 
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,        // Ensure it's above other content
  },
  // emptyListText: {
  //   color: "#666",
  //   fontStyle: "italic",
  //   textAlign: "center",
  //   marginVertical: 12,
  // },
  instructionText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  assignmentContainer: {
    marginVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  playerAssignmentName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  assignmentItem: {
    position: 'relative',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f8f8f8",
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
  },
  
  selectedAssignmentItem: {
    backgroundColor: "#e3f2fd",
    borderColor: "#007bff",
    borderWidth: 1,
  },
  assignmentItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center", 
    width: "100%",
    paddingRight: 24, // Add padding to make room for the delete button
  },
  startButton: {
    backgroundColor: "#28a745",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginVertical: 24,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  randomizeContainer: {
    backgroundColor: "#f8f9fa",
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
    color: "#333",
  },
  matchItemWrapper: {
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
    backgroundColor: "#0275d8",
    justifyContent: "center",
    alignItems: "center",
  },
  counterButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  counterValue: {
    fontSize: 20,
    fontWeight: "bold",
    marginHorizontal: 16,
  },
  randomizeButton: {
    backgroundColor: "#0275d8",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  randomizeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  disabledTabText: {
    color: "#ccc",
  },
  tabContent: {
    padding: 16,
  },
  assignmentSection: {
    marginBottom: 24,
  },
  endButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  setupButton: {
    flex: 1,
    backgroundColor: '#0275d8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  endButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
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
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginHorizontal: 5,
  },
  buttonConfirm: {
    backgroundColor: "#28a745",
  },
  buttonCancel: {
    backgroundColor: "#6c757d",
  },
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
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  smallCounterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  tinyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  matchSelectItem: {
    margin: 4, // Reduced margin from 8 to 4
    padding: 12, // Reduced padding from 16 to 12
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    minHeight: 60, // Reduced from 80 to 60
    borderWidth: 1,
    borderColor: '#ddd',
  },
  matchesGridContainer: {
    padding: 8,
    paddingBottom: 80,
  },
  playersListContent: {
    padding: 8,
    paddingBottom: 80,
  },
  matchGridItem: {
    margin: 8,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    minHeight: 80,
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
    marginBottom: 8,
  },
  matchTeams: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
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
  matchText: {
    fontSize: 14,
    color: '#333',
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  },
  // Wizard styles
  wizardContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column',
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stepButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeStepButton: {
    backgroundColor: '#0275d8',
  },
  stepText: {
    color: '#777',
    fontWeight: '500',
  },
  activeStepText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  stepConnector: {
    height: 2,
    width: 30,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  activeStepConnector: {
    backgroundColor: '#0275d8',
  },
  stepContentScroll: {
    flex: 1,
  },
  wizardNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0275d8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  navButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginHorizontal: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  suggestionsContainer: {
    position: 'relative',
    flex: 0.45,
    zIndex: 1000,
  },
  suggestionsList: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    elevation: 5,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionItemText: {
    fontSize: 16, // Larger text for better visibility
  },
  overlayArea: {
    position: 'absolute',
    top: 200, // Adjust based on your layout
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 900,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  suggestionsModal: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: 300,
    zIndex: 9999,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#007bff',
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  errorText: {
    marginLeft: 8,
    color: '#ff4444',
    fontSize: 14,
  },
  dropdownContainer: {
    flex: 1, 
    marginHorizontal: 4,
  },
  dropdownBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownInput: {
    color: '#333',
    fontSize: 14,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    marginTop: 4,
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
  },
  filterContainer: {
    marginBottom: 15,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },
  filterToggleText: {
    color: '#007bff',
    fontWeight: '500',
  },
  timeFilterControls: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  timeInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeLabel: {
    width: 80,
    fontSize: 14,
  },
  timeInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  filterButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  applyFilterButton: {
    backgroundColor: '#007bff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  resetFilterButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginRight: 10,
  },
  applyFilterText: {
    color: 'white',
    fontWeight: '500',
  },
  resetFilterText: {
    color: '#666',
  },
  filterStatusText: {
    marginTop: 10,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginTop: 10,
    marginBottom: 8,
  },
  addAllButton: {
    backgroundColor: "#28a745", // Green color
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginLeft: 10,
  },
  addAllButtonText: {
    color: "white",
    fontWeight: "500",
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#999',
  },
  emptyListContainer: {
    padding: 15,
    alignItems: 'center',
  },
  emptyListText: {
    color: '#999',
    marginBottom: 10,
  },
  addNewButton: {
    padding: 8,
    backgroundColor: '#f0f7ff',
    borderRadius: 4,
    margin: 10,
  },
  addNewButtonText: {
    color: '#007bff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    width: '100%',
    maxHeight: '80%',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalSearchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  modalCloseText: {
    color: '#333',
  },
  modalItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    width: '100%',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
  },
  leagueFilterContainer: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  leagueFilterLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  leagueButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leagueButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  leagueButtonSelected: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },
  leagueButtonText: {
    fontSize: 13,
    color: '#333',
  },
  leagueButtonTextSelected: {
    color: '#fff',
  },
  modalItemLeague: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default styles;