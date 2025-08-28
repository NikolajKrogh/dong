import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentColors } from "../../app/style/theme";

export const RandomMatchesToast = {
  themedSuccess: (props: { text1?: string; text2?: string }) => {
    const colors = getCurrentColors();
    return (
      <View
        style={{
          width: "92%",
          alignSelf: "center",
          backgroundColor: colors.toastBackground,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 6,
          borderLeftWidth: 3,
          borderLeftColor: colors.success,
        }}
      >
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          {props.text1 ? (
            <Text
              style={{
                color: colors.textLight,
                fontSize: 15,
                fontWeight: "700",
                marginBottom: props.text2 ? 2 : 0,
              }}
              numberOfLines={2}
            >
              {props.text1}
            </Text>
          ) : null}
          {props.text2 ? (
            <Text
              style={{ color: colors.textMuted, fontSize: 13 }}
              numberOfLines={3}
            >
              {props.text2}
            </Text>
          ) : null}
        </View>
      </View>
    );
  },
  themedWarning: (props: { text1?: string; text2?: string }) => {
    const colors = getCurrentColors();
    return (
      <View
        style={{
          width: "92%",
          alignSelf: "center",
          backgroundColor: colors.toastBackground,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 6,
          borderLeftWidth: 3,
          borderLeftColor: colors.warning,
        }}
      >
        <Ionicons name="warning-outline" size={22} color={colors.warning} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          {props.text1 ? (
            <Text
              style={{
                color: colors.textLight,
                fontSize: 15,
                fontWeight: "700",
                marginBottom: props.text2 ? 2 : 0,
              }}
              numberOfLines={2}
            >
              {props.text1}
            </Text>
          ) : null}
          {props.text2 ? (
            <Text
              style={{ color: colors.textMuted, fontSize: 13 }}
              numberOfLines={3}
            >
              {props.text2}
            </Text>
          ) : null}
        </View>
      </View>
    );
  },
};

export default RandomMatchesToast;
