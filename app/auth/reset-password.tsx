import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import PasswordResetForm from "../../components/auth/PasswordResetForm";
import { ShellScreen } from "../../components/ui";
import { normalizeAccountFlowReturnTo } from "../../hooks/useAccountAuth";
import { useColors } from "../style/theme";

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
        <PasswordResetForm returnTo={returnTo} recoveryCode={recoveryCode} />
      </SafeAreaView>
    </ShellScreen>
  );
};

export default PasswordResetScreen;