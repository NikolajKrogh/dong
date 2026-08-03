import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AuthHeader from "../../components/auth/AuthHeader";
import ChangePasswordForm from "../../components/auth/ChangePasswordForm";
import { ShellScreen } from "../../components/ui";
import { useColors } from "../../styles/theme";

const ChangePasswordScreen = () => {
  const colors = useColors();

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
            <ChangePasswordForm />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default ChangePasswordScreen;
