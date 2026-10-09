import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, TouchableOpacity, View } from "react-native";

import { useColors } from "../../styles/theme";
import { androidElevationFallback, hexWithAlpha } from "../../styles/shadows";

const AuthHeader: React.FC = () => {
  const router = useRouter();
  const colors = useColors();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/" as never);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        minHeight: 48,
        paddingVertical: 8,
        paddingHorizontal: 8,
        flexDirection: "row",
        alignItems: "center",
        boxShadow: Platform.OS === "android" ? `0px 2px 4px ${hexWithAlpha(colors.black, 0.2)}` : undefined,
        ...androidElevationFallback(2),
      }}
    >
      <TouchableOpacity onPress={handleBack} style={{ padding: 8 }}>
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

export default AuthHeader;
