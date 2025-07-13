import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../app/style/historyStyles";
import { colors } from "../../app/style/palette";

/**
 * @interface TooltipModalProps
 * @brief Props for the TooltipModal component.
 * @property {boolean} visible - Whether the tooltip modal is visible.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {string} title - The title text to display in the tooltip.
 * @property {string} description - The description text to display in the tooltip.
 */
interface TooltipModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

/**
 * @component TooltipModal
 * @brief A modal component that displays helpful tooltip information.
 * 
 * This component renders a modal with a title and description to provide
 * additional context or explanation for a feature. The modal can be closed
 * by pressing the close button or tapping anywhere outside the tooltip content.
 * 
 * @param {TooltipModalProps} props - The props for the component.
 * @returns {React.ReactElement} The rendered TooltipModal component.
 */
const TooltipModal: React.FC<TooltipModalProps> = ({
  visible,
  onClose,
  title,
  description,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.tooltipOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltipContent}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.tooltipDescription}>{description}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default TooltipModal;