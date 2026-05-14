import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "../../app/style/theme";
import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth,
} from "../../hooks/useAccountAuth";
import { ShellActionButton, ShellCard } from "../ui";

interface UsernameOnboardingFormProps {
  returnTo?: string | null;
}

const UsernameOnboardingForm = ({ returnTo }: UsernameOnboardingFormProps) => {
  const router = useRouter();
  const colors = useColors();
  const { account, saveDisplayName, status } = useAccountAuth();
  const normalizedReturnTo = normalizeAccountFlowReturnTo(returnTo);
  const [displayName, setDisplayName] = useState(
    account?.preferredDisplayName ?? "",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: 16,
        },
        title: {
          fontSize: 24,
          fontWeight: "700",
          color: colors.textPrimary,
        },
        subtitle: {
          fontSize: 15,
          color: colors.textSecondary,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          color: colors.textPrimary,
          backgroundColor: colors.surface,
        },
        message: {
          fontSize: 14,
          color: colors.textSecondary,
        },
        error: {
          fontSize: 14,
          color: colors.danger,
        },
        link: {
          color: colors.primary,
          fontWeight: "600",
        },
      }),
    [colors],
  );

  useEffect(() => {
    if (status === "ready") {
      router.replace((normalizedReturnTo ?? "/") as never);
    }

    if (status === "signedOut") {
      router.replace(
        buildAccountAuthRoute("/auth", normalizedReturnTo) as never,
      );
    }
  }, [normalizedReturnTo, router, status]);

  useEffect(() => {
    setDisplayName(account?.preferredDisplayName ?? "");
  }, [account?.preferredDisplayName]);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await saveDisplayName(displayName);
      router.replace((normalizedReturnTo ?? "/") as never);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the name.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ShellCard elevated>
      <View style={styles.container}>
        <View style={{ gap: 8 }}>
            <Text style={styles.title}>Choose your display name</Text>
          <Text style={styles.subtitle}>
              This name is stored on your account and shown whenever you create or
              join a multiplayer session.
          </Text>
        </View>

        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="Display name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <ShellActionButton
          disabled={isSubmitting}
          label={isSubmitting ? "Saving…" : "Save display name"}
          onPress={() => {
            void handleSubmit();
          }}
        />

        <Text style={styles.message}>
          Duplicate display names are allowed.
        </Text>
      </View>
    </ShellCard>
  );
};

export default UsernameOnboardingForm;