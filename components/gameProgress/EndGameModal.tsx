import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, SafeAreaView } from "react-native";

interface EndGameModalProps {
  isVisible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const EndGameModal: React.FC<EndGameModalProps> = ({ isVisible, onCancel, onConfirm }) => {
  return (
    <SafeAreaView style={{ flex: 0 }}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isVisible}
        onRequestClose={onCancel}
        statusBarTranslucent={true}
      >
        <TouchableOpacity 
          style={modalStyles.overlayTouchable}
          activeOpacity={1}
          onPress={onCancel}
        >
          <View style={modalStyles.centeredView}>
            <View style={modalStyles.modalContainer}>
              <TouchableOpacity 
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={{ width: '100%' }}
              >
                <Text style={modalStyles.modalTitle}>End Game</Text>
                <Text style={modalStyles.modalText}>
                  Are you sure you want to end the current game? This will save the
                  results to history.
                </Text>
                <View style={modalStyles.modalButtons}>
                  <TouchableOpacity
                    style={[modalStyles.button, modalStyles.buttonCancel]}
                    onPress={onCancel}
                  >
                    <Text style={modalStyles.textStyle}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[modalStyles.button, modalStyles.buttonConfirm]}
                    onPress={onConfirm}
                  >
                    <Text style={modalStyles.textStyle}>End Game</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const modalStyles = StyleSheet.create({
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0, 
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center"
  },
  modalText: {
    marginBottom: 20,
    textAlign: "center"
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%"
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    minWidth: 80,
  },
  buttonCancel: {
    backgroundColor: "#ddd",
  },
  buttonConfirm: {
    backgroundColor: "#F44336", // Changed from blue (#2196F3) to red
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  }
});

export default EndGameModal;