import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from "react-native";
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
      <View style={styles.tooltipOverlay}>
        {/* Backdrop press area (separate so taps inside content don't close) */}
        <Pressable
          style={StyleSheet.absoluteFill}
          android_ripple={{
            color: colors.primaryTransparentLight || "#00000022",
          }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss tooltip"
        />
        <View style={styles.tooltipContainer} pointerEvents="box-none">
          <View style={styles.tooltipContent}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.tooltipDescription}>{description}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default TooltipModal;
