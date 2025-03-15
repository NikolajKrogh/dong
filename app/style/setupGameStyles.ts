import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
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
  playerItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    marginBottom: 6,
  },
  playerName: {
    fontSize: 16,
  },
  emptyListText: {
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 12,
  },
  matchItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    marginBottom: 6,
  },
  selectedMatchItem: {
    backgroundColor: "#d4edff",
    borderColor: "#007bff",
    borderWidth: 1,
  },
  matchText: {
    fontSize: 16,
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  assignmentContainer: {
    marginVertical: 8,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 12,
  },
  playerAssignmentName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  assignmentItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    marginBottom: 6,
  },
  selectedAssignmentItem: {
    backgroundColor: "#d4edff",
    borderColor: "#007bff",
    borderWidth: 1,
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
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: "#0275d8",
  },
  tabText: {
    fontSize: 16,
    color: "#666",
  },
  activeTabText: {
    fontWeight: "bold",
    color: "#0275d8",
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
  contentContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
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
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  }
});

export default styles;
