import React, { useState } from 'react'; // Add useState
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from './store';
import { Ionicons } from '@expo/vector-icons';

const HomeScreen = () => {
  const router = useRouter();
  const { players, matches, history, resetState } = useGameStore(); // Add resetState
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false); // Add state for modal
  
  // Check if there's a game in progress
  const hasGameInProgress = players.length > 0 && matches.length > 0;

  // Function to handle game cancellation
  const handleCancelGame = () => {
    resetState();
    setIsConfirmModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>DONG</Text>
        <Text style={styles.subtitle}>Drink ON Goal</Text>
      </View>

      {hasGameInProgress ? (
        <View style={styles.sessionContainer}>
          <Text style={styles.sessionTitle}>Current Game in Progress</Text>
          <View style={styles.sessionInfoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="people" size={22} color="#0275d8" />
              <Text style={styles.infoText}>{players.length} Players</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="football" size={22} color="#0275d8" />
              <Text style={styles.infoText}>{matches.length} Matches</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push('/gameProgress')}
          >
            <Ionicons name="play" size={22} color="#fff" />
            <Text style={styles.buttonText}>Continue Game</Text>
          </TouchableOpacity>
          
          {/* Add Cancel Game Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setIsConfirmModalVisible(true)}
          >
            <Ionicons name="close-circle-outline" size={22} color="#fff" />
            <Text style={styles.buttonText}>Cancel Game</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push('/setupGame')}
        >
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.buttonText}>Start New Game</Text>
        </TouchableOpacity>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.setupButton}
          onPress={() => router.push('/setupGame')}
        >
          <Ionicons name="settings-outline" size={20} color="#fff" />
          <Text style={styles.smallButtonText}>Setup</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => router.push('/history')}
        >
          <Ionicons name="time-outline" size={20} color="#fff" />
          <Text style={styles.smallButtonText}>History</Text>
        </TouchableOpacity>
      </View>

      {history.length > 0 && (
        <View style={styles.statsContainer}>
          {/* Stats content - no changes */}
        </View>
      )}
      
      <Text style={styles.footer}>The perfect drinking game for football fans</Text>

      {/* Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isConfirmModalVisible}
        onRequestClose={() => setIsConfirmModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Cancel Game</Text>
            <Text style={styles.modalText}>
              Are you sure you want to cancel the current game? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonCancel]}
                onPress={() => setIsConfirmModalVisible(false)}
              >
                <Text style={styles.textStyle}>No, Keep Game</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.buttonConfirm]}
                onPress={handleCancelGame}
              >
                <Text style={styles.textStyle}>Yes, Cancel Game</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0275d8',
  },
  subtitle: {
    fontSize: 14,
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
    backgroundColor: '#0275d8',
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
});

export default HomeScreen;