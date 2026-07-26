import { useLocalSearchParams } from "expo-router";
import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AuthForm from "../../components/auth/AuthForm";
import AuthHeader from "../../components/auth/AuthHeader";
import { ShellScreen } from "../../components/ui";
import { normalizeAccountFlowReturnTo } from "../../hooks/useAccountAuth";
import { useColors } from "../../styles/theme";

const AuthScreen = () => {
  const colors = useColors();
  const searchParams = useLocalSearchParams();
  const returnTo = normalizeAccountFlowReturnTo(
    (searchParams as { returnTo?: string | string[] }).returnTo,
  );
  const confirmationCodeValue = (searchParams as { code?: string | string[] })
    .code;
  const confirmationCode = Array.isArray(confirmationCodeValue)
    ? confirmationCodeValue[0]
    : (confirmationCodeValue ?? null);

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
            <AuthForm confirmationCode={confirmationCode} returnTo={returnTo} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default AuthScreen;
