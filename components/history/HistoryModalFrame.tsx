import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../styles/theme";

interface HistoryModalFrameProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  testID?: string;
  children: (layout: {
    contentWidth: number;
    fontScale: number;
    isDesktop: boolean;
  }) => React.ReactNode;
}

/** Native Modal also supplies web Escape, focus trapping and focus restoration. */
export default function HistoryModalFrame({
  visible,
  onClose,
  title,
  closeLabel,
  testID,
  children,
}: HistoryModalFrameProps) {
  const colors = useColors();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.max(
    0,
    Math.min(960, width - insets.left - insets.right - 24),
  );
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const contentWidth = Math.min(
    measuredWidth ?? 0,
    Math.max(0, panelWidth - 36),
  );
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
          paddingLeft: insets.left + 12,
          paddingRight: insets.right + 12,
          backgroundColor: colors.backgroundModalOverlay,
        }}
      >
        <View
          testID={testID}
          accessibilityViewIsModal
          style={{
            width: panelWidth,
            maxHeight: Math.max(0, height - insets.top - insets.bottom - 24),
            backgroundColor: colors.surface,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingLeft: 18,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                color: colors.textPrimary,
                fontSize: 20,
                fontWeight: "800",
              }}
            >
              {title}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={onClose}
              style={{
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
          >
            <View
              testID="HistoryModalContent"
              onLayout={(event) =>
                setMeasuredWidth(event.nativeEvent.layout.width)
              }
            >
              {children({
                contentWidth,
                fontScale,
                isDesktop: contentWidth >= 760 && fontScale < 1.5,
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
