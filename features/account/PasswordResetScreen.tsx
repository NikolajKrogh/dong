import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import AuthHeader from "./AuthHeader";
import PasswordResetForm from "./PasswordResetForm";
import { ShellScreen } from "../../components/ui";
import { normalizeAccountFlowReturnTo } from ".";
import { useColors } from "../../styles/theme";

const PasswordResetScreen = () => {
  const colors = useColors();
  const searchParams = useLocalSearchParams();
  const returnTo = normalizeAccountFlowReturnTo(
    (searchParams as { returnTo?: string | string[] }).returnTo,
  );
  const recoveryCodeValue = (searchParams as { code?: string | string[] })
    .code;
  const recoveryCode = Array.isArray(recoveryCodeValue)
    ? recoveryCodeValue[0]
    : recoveryCodeValue ?? null;

  return (
    <ShellScreen padded={false} centerContent contentMaxWidth={720}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AuthHeader title="Reset password" />
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
            <PasswordResetForm
              returnTo={returnTo}
              recoveryCode={recoveryCode}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default PasswordResetScreen;
