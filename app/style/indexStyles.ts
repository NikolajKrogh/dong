import { StyleSheet, Platform, StatusBar } from "react-native";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  headerContainer: {
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#f5f5f5",
    marginBottom: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#0275d8",
  },
  subtitle: {
    fontSize: 12,
    color: "#6c757d",
    marginTop: 4,
  },
  sessionContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    margin: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  sessionInfoRow: {
    flexDirection: "row",
    marginBottom: 16,
    justifyContent: "space-around",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    fontSize: 16,
    color: "#666",
    marginLeft: 8,
  },
  continueButton: {
    backgroundColor: "#28a745",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  startButton: {
    backgroundColor: "#28a745",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 16,
  },
  setupButton: {
    flex: 1,
    backgroundColor: "#0275d8",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0275d8", // Primary blue color
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  historyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },

  historyButtonArrow: {
    paddingRight: 14,
  },
  subtleHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff", // White background
    borderRadius: 12,
    marginHorizontal: 16, // Keep consistent margins
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1, // Add a light border
    borderColor: "#e0e0e0", // Light grey border color
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, // Lighter shadow
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2, // Lower elevation
  },

  subtleHistoryButtonText: {
    color: "#0275d8", // Blue text color
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30, // Add some padding at the bottom for comfortable scrolling
  },
  smallButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  statsContainer: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  viewMoreIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },

  viewMoreText: {
    fontSize: 14,
    color: "#0275d8",
    marginRight: 4,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 0, // Remove existing margin that might affect alignment
  },
  statsContent: {
    padding: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  statTextContainer: {
    marginLeft: 12,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  footer: {
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
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
  modalButton: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginHorizontal: 5,
    minWidth: 120,
  },
  buttonConfirm: {
    backgroundColor: "#dc3545",
  },
  buttonCancel: {
    backgroundColor: "#6c757d",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  iconContainer: {
    marginRight: 8,
  },
  userPreferencesButton: {
    position: "absolute",
    bottom: 16, // Position at the bottom
    right: 16, // Position at the right
    padding: 12,
    borderRadius: 30,
    backgroundColor: "#0275d8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10,
  },
  userPreferencesButtonHover: {
    backgroundColor: "#025aa5", // Darker shade for hover effect
  },
  logo: {
    width: 512,
    height: 120,
    resizeMode: "contain",
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleChevron: {
    marginLeft: 6,
    marginBottom: -1,
  },
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff", 
  },
  splashAnimation: {
    width: 400,
    height: 400,
  },
});

export default styles;
