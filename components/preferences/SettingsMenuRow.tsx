import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text } from "react-native";

import { useColors } from "../../styles/theme";

export default function SettingsMenuRow({
  label,
  icon,
  value,
  onPress,
  last = false,
  danger = false,
  testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 52,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.primary} />
      <Text style={{ flex: 1, fontSize: 16, color: danger ? colors.danger : colors.textPrimary }}>
        {label}
      </Text>
      {value ? <Text style={{ color: colors.textMuted, fontSize: 14 }}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}
