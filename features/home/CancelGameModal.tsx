import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

import createStyles from "./homeStyles";

interface CancelGameModalProps {
  visible: boolean;
  styles: ReturnType<typeof createStyles>;
  onRequestClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
}

export const CancelGameModal: React.FC<CancelGameModalProps> = ({
  visible,
  styles,
  onRequestClose,
  onConfirm,
  title = "Cancel Game",
  message = "Are you sure you want to cancel the current game? This action cannot be undone.",
  confirmLabel = "Yes, Cancel Game",
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
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>
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
              <Text style={styles.textStyle}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
