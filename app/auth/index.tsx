import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import AuthForm from "../../components/auth/AuthForm";
import { ShellScreen } from "../../components/ui";
import { normalizeAccountFlowReturnTo } from "../../hooks/useAccountAuth";
import { useColors } from "../style/theme";

const AuthScreen = () => {
  const colors = useColors();
  const searchParams = useLocalSearchParams();
  const returnTo = normalizeAccountFlowReturnTo(
    (searchParams as { returnTo?: string | string[] }).returnTo,
  );

  return (
    <ShellScreen padded={false} centerContent contentMaxWidth={720}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AuthForm returnTo={returnTo} />
      </SafeAreaView>
    </ShellScreen>
  );
};

export default AuthScreen;