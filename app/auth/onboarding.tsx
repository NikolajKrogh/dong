import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import AuthHeader from "../../components/auth/AuthHeader";
import UsernameOnboardingForm from "../../components/auth/UsernameOnboardingForm";
import { ShellScreen } from "../../components/ui";
import { normalizeAccountFlowReturnTo } from "../../hooks/useAccountAuth";
import { useColors } from "../style/theme";

const AccountOnboardingScreen = () => {
  const colors = useColors();
  const searchParams = useLocalSearchParams();
  const returnTo = normalizeAccountFlowReturnTo(
    (searchParams as { returnTo?: string | string[] }).returnTo,
  );
  const prefillNameValue = (searchParams as { prefillName?: string | string[] })
    .prefillName;
  const prefillName = Array.isArray(prefillNameValue)
    ? prefillNameValue[0]
    : (prefillNameValue ?? "");

  return (
    <ShellScreen padded={false} centerContent contentMaxWidth={720}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AuthHeader />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <UsernameOnboardingForm
              returnTo={returnTo}
              prefillName={prefillName}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default AccountOnboardingScreen;
