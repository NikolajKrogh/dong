import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { Text, XStack, YStack } from "tamagui";

import { useColors } from "../../app/style/theme";
import { useAccountAuth } from "../../hooks/useAccountAuth";
import { ShellActionButton, ShellCard } from "../ui";

const ChangePasswordForm = () => {
  const router = useRouter();
  const colors = useColors();
  const { changePassword } = useAccountAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmPasswordRef = useRef<TextInput>(null);

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

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword(newPassword);
      setSuccessMessage("Your password has been updated.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update the password.",
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
            Change password
          </Text>
          <Text fontSize={15} color="$textSecondary">
            Choose a new password for your account.
          </Text>
        </YStack>

        <YStack gap="$1.5">
          <Text fontSize={13} fontWeight="600" color="$textMuted">
            New password
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            secureTextEntry
            style={inputStyles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          />
        </YStack>

        <YStack gap="$1.5">
          <Text fontSize={13} fontWeight="600" color="$textMuted">
            Confirm new password
          </Text>
          <TextInput
            ref={confirmPasswordRef}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            secureTextEntry
            style={inputStyles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onSubmitEditing={() => void handleSubmit()}
          />
        </YStack>

        {errorMessage ? (
          <Text fontSize={14} color="$danger">{errorMessage}</Text>
        ) : null}
        {successMessage ? (
          <Text fontSize={14} color="$success">{successMessage}</Text>
        ) : null}

        <ShellActionButton
          disabled={isSubmitting}
          label={isSubmitting ? "Updating…" : "Update password"}
          onPress={() => void handleSubmit()}
        />

        <XStack justifyContent="center">
          <Text
            fontSize={14}
            color="$primary"
            fontWeight="600"
            pressStyle={{ opacity: 0.7 }}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              }
            }}
          >
            ← Back to settings
          </Text>
        </XStack>
      </YStack>
    </ShellCard>
  );
};

export default ChangePasswordForm;
