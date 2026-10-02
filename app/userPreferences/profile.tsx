import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { Text as TText, XStack, YStack } from "tamagui";

import ProfileSection from "../../components/preferences/ProfileSection";
import SettingsMenuRow from "../../components/preferences/SettingsMenuRow";
import SettingsPage from "../../components/preferences/SettingsPage";
import { ShellCard, ShellSection } from "../../components/ui";
import { buildAccountAuthRoute, useAccountAuth } from "../../hooks/useAccountAuth";
import { useColors } from "../../styles/theme";

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { account, deleteAccount, status } = useAccountAuth();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const displayName = account?.username?.trim();

  useEffect(() => {
    if (status !== "loading" && status !== "ready") router.replace("/userPreferences");
  }, [router, status]);

  const confirmDelete = () => {
    const performDelete = async () => {
      setDeleteError(null);
      try {
        await deleteAccount();
        router.replace("/userPreferences");
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : "Unable to delete the account.");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm("Permanently delete your account and all your data? This cannot be undone.")) void performDelete();
      return;
    }
    Alert.alert("Delete account", "This permanently deletes your account and all your data. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void performDelete(); } },
    ]);
  };

  return (
    <SettingsPage title="Profile">
      {account && status === "ready" ? (
        <>
          <ShellSection title="Account">
            <ShellCard compact>
              <XStack gap="$3" alignItems="center">
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.textLight, fontWeight: "700", fontSize: 18 }}>{displayName?.[0]?.toUpperCase() ?? "?"}</Text>
                </View>
                <YStack>
                  <TText color="$textPrimary" fontWeight="600" fontSize={16}>{displayName ?? "Account"}</TText>
                  <TText color="$textMuted" fontSize={13}>Signed in</TText>
                </YStack>
              </XStack>
            </ShellCard>
          </ShellSection>
          <ProfileSection showSectionTitle={false} />
          <ShellSection title="Friends">
            <ShellCard compact>
              <SettingsMenuRow label="Friends" icon="people-outline" last onPress={() => router.push('/friends' as never)} />
            </ShellCard>
          </ShellSection>
          <ShellSection title="Account actions">
            <ShellCard compact>
              <SettingsMenuRow label="Change password" icon="lock-closed-outline" onPress={() => router.push(buildAccountAuthRoute("/auth/change-password", "/userPreferences/profile") as never)} />
              <SettingsMenuRow label="Delete account" icon="trash-outline" danger last onPress={confirmDelete} />
            </ShellCard>
          </ShellSection>
          {deleteError ? <TText color="$danger">{deleteError}</TText> : null}
        </>
      ) : null}
    </SettingsPage>
  );
}
