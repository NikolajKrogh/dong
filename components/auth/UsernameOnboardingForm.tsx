import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { Text, YStack } from "tamagui";

import { useColors } from "../../app/style/theme";
import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth,
} from "../../hooks/useAccountAuth";
import { ShellActionButton, ShellCard } from "../ui";

interface UsernameOnboardingFormProps {
  returnTo?: string | null;
  prefillName?: string;
}

const UsernameOnboardingForm = ({
  returnTo,
  prefillName,
}: UsernameOnboardingFormProps) => {
  const router = useRouter();
  const colors = useColors();
  const { account, saveDisplayName, status } = useAccountAuth();
  const normalizedReturnTo = normalizeAccountFlowReturnTo(returnTo);
  const [displayName, setDisplayName] = useState(
    account?.preferredDisplayName ?? prefillName ?? "",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const inputStyles = StyleSheet.create({
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
  });

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
      <YStack gap="$4">
        <YStack gap="$2">
          <Text fontSize={22} fontWeight="700" color="$textPrimary">
            Choose your display name
          </Text>
          <Text fontSize={15} color="$textSecondary">
            This name is stored on your account and shown whenever you create or
            join a multiplayer session.
          </Text>
        </YStack>

        <YStack gap="$1.5">
          <Text fontSize={13} fontWeight="600" color="$textMuted">
            Display name
          </Text>
          <TextInput
            ref={inputRef}
            autoCapitalize="words"
            autoCorrect={false}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={inputStyles.input}
            value={displayName}
            onChangeText={setDisplayName}
            onSubmitEditing={() => void handleSubmit()}
          />
        </YStack>

        {errorMessage ? (
          <Text fontSize={14} color="$danger">{errorMessage}</Text>
        ) : null}

        <ShellActionButton
          disabled={isSubmitting}
          label={isSubmitting ? "Saving…" : "Save display name"}
          onPress={() => void handleSubmit()}
        />

        <Text fontSize={13} color="$textMuted" textAlign="center">
          Duplicate display names are allowed.
        </Text>
      </YStack>
    </ShellCard>
  );
};

export default UsernameOnboardingForm;
