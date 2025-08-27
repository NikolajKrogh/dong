import React, { useMemo } from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createHistoryStyles } from "../../app/style/historyStyles";
import { useColors } from "../../app/style/theme";
/**
 * Tooltip / detail modal for comparison stat.
 * @description Displays title + description for a stat; hidden when not visible.
 * @param {TooltipModalProps} props Component props.
 * @returns {React.ReactElement | null} Modal element or null.
 */
interface TooltipModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

// (Previously had percentage formatting & chart – simplified for text description use case.)
const TooltipModal: React.FC<TooltipModalProps> = ({
  visible,
  onClose,
  title,
  description,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);
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
