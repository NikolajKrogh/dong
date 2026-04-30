import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
  useWindowDimensions,
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isWideLayout = screenWidth >= 1024;
  const modalStyles = React.useMemo(
    () => createStyles(colors, screenWidth, screenHeight, isWideLayout),
    [colors, isWideLayout, screenHeight, screenWidth],
  );

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

const createStyles = (
  colors: ReturnType<typeof useColors>,
  screenWidth: number,
  screenHeight: number,
  isWideLayout: boolean,
) =>
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
      padding: 16,
    },
    modalContainer: {
      width: Math.min(screenWidth - 32, isWideLayout ? 520 : screenWidth * 0.85),
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
      maxHeight: Math.min(screenHeight * 0.7, 420),
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
      flexDirection: isWideLayout ? "row" : "column",
      justifyContent: "space-around",
      width: "100%",
    },
    button: {
      borderRadius: 20,
      padding: 10,
      elevation: 2,
      marginHorizontal: isWideLayout ? 5 : 0,
      marginTop: isWideLayout ? 0 : 8,
      minWidth: 120,
      width: isWideLayout ? undefined : "100%",
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
