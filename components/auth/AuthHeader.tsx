import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity, View } from "react-native";

import { useColors } from "../../app/style/theme";

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
        elevation: 2,
      }}
    >
      <TouchableOpacity onPress={handleBack} style={{ padding: 8 }}>
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

export default AuthHeader;
