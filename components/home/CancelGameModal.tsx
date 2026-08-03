import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

import createStyles from "../../styles/indexStyles";

interface CancelGameModalProps {
  visible: boolean;
  styles: ReturnType<typeof createStyles>;
  onRequestClose: () => void;
  onConfirm: () => void;
}

export const CancelGameModal: React.FC<CancelGameModalProps> = ({
  visible,
  styles,
  onRequestClose,
  onConfirm,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Cancel Game</Text>
          <Text style={styles.modalText}>
            Are you sure you want to cancel the current game? This action
            cannot be undone.
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonCancel]}
              onPress={onRequestClose}
            >
              <Text style={styles.textStyle}>No, Keep Game</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonConfirm]}
              onPress={onConfirm}
            >
              <Text style={styles.textStyle}>Yes, Cancel Game</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CancelGameModal;
