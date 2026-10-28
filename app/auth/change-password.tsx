import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform } from "react-native";

import ChangePasswordForm from "../../components/auth/ChangePasswordForm";
import { SettingsPage } from "../../features/preferences";
import { normalizeAccountFlowReturnTo } from "../../features/account";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const backTarget = normalizeAccountFlowReturnTo(returnTo) ?? "/userPreferences/profile";
  return (
    <SettingsPage title="Change password" onBack={() => router.replace(backTarget as never)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ChangePasswordForm />
      </KeyboardAvoidingView>
    </SettingsPage>
  );
}
