import React from "react";
import { View, Text } from "react-native";

/**
 * Informational placeholder for the `_style` route group.
 * @component
 * @description Prevents Expo Router from warning about an empty folder while signaling that the directory houses style/theme utilities; not intended for direct navigation.
 */
export default function StylesInfo() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 16, textAlign: "center" }}>
        This route group contains style utilities only and is not meant to be
        visited.
      </Text>
    </View>
  );
}
