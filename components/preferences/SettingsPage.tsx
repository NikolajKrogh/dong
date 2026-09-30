import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ShellScreen } from "../ui";
import { isWideLayout } from "../../styles/responsive";
import { useColors } from "../../styles/theme";
import Header from "./Header";

export default function SettingsPage({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const colors = useColors();

  return (
    <ShellScreen
      padded={false}
      centerContent={isWideLayout(width)}
      contentMaxWidth={isWideLayout(width) ? 960 : undefined}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header
          title={title}
          onBack={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(title === "Settings" ? "/" : "/userPreferences")))}
        />
        <ScrollView
          testID="UserPreferencesContent"
          style={{ flex: 1, backgroundColor: colors.backgroundLight, ...(Platform.OS === "web" ? { fontFamily: "system-ui" } : {}) }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 32, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </ShellScreen>
  );
}
