import { StyleSheet, Platform, StatusBar } from 'react-native';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    alignItems: 'center',
    paddingVertical: 12, 
    backgroundColor: '#f5f5f5', 
    marginBottom: 12, 
  },
  title: {
    fontSize: 40, 
    fontWeight: 'bold',
    color: '#0275d8',
  },
  subtitle: {
    fontSize: 12, 
    color: '#6c757d',
    marginTop: 4,
  },
  sessionContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sessionInfoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'space-around',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  continueButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 16,
  },
  setupButton: {
    flex: 1,
    backgroundColor: '#0275d8',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  historyButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  smallButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  statsContainer: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  statsContent: {
    padding: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statTextContainer: {
    marginLeft: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  footer: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
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
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
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
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginHorizontal: 5,
    minWidth: 120,
  },
  buttonConfirm: {
    backgroundColor: '#dc3545',
  },
  buttonCancel: {
    backgroundColor: '#6c757d',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center'
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
});

export default styles;