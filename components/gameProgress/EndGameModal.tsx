import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { useColors } from "../../app/style/theme";

/**
 * Props for the EndGameModal component.
 * @interface
 */
interface EndGameModalProps {
  /** Whether the modal is visible. */
  isVisible: boolean;
  /** Called when user cancels closing/end action. */
  onCancel: () => void;
  /** Called when user confirms ending the game. */
  onConfirm: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Confirmation modal for ending the active game session.
 * @component
 * @param {EndGameModalProps} props Component props.
 * @returns {React.ReactElement | null} Modal element or null if hidden.
 * @description Presents a themed overlay with contextual text and two actions (Cancel / End Game). No side-effects; parent handles state persistence & history saving.
 */
const EndGameModal: React.FC<EndGameModalProps> = ({
  isVisible,
  onCancel,
  onConfirm,
}) => {
  const colors = useColors();
  const modalStyles = React.useMemo(() => createStyles(colors), [colors]);
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
                style={{ width: "100%" }}
              >
                <Text style={modalStyles.modalTitle}>End Game</Text>
                <Text style={modalStyles.modalText}>
                  Are you sure you want to end the current game? This will save
                  the results to history.
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

const createStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    overlayTouchable: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.backgroundModalOverlay,
    },
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContainer: {
      width: SCREEN_WIDTH * 0.85,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      alignItems: "center",
      shadowColor: colors.black,
      shadowOffset: {
        width: 0,
        height: 2,
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
      textAlign: "center",
      color: colors.textPrimary,
    },
    modalText: {
      marginBottom: 20,
      textAlign: "center",
      color: colors.textSecondary,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-around",
      width: "100%",
    },
    button: {
      borderRadius: 20,
      padding: 10,
      elevation: 2,
      marginHorizontal: 5,
      minWidth: 120,
    },
    buttonCancel: {
      backgroundColor: colors.secondary,
    },
    buttonConfirm: {
      backgroundColor: colors.danger,
    },
    textStyle: {
      color: colors.white,
      fontWeight: "bold",
      textAlign: "center",
    },
  });

export default EndGameModal;
