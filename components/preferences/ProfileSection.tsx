import React, { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { Text, YStack } from "tamagui";

import { useColors } from "../../app/style/theme";
import { useAccountAuth } from "../../hooks/useAccountAuth";
import { ShellActionButton, ShellCard, ShellSection } from "../ui";

const ProfileSection = () => {
  const colors = useColors();
  const { account, saveProfile, status } = useAccountAuth();
  const [displayName, setDisplayName] = useState(
    account?.preferredDisplayName ?? "",
  );
  const [username, setUsername] = useState(account?.username ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setDisplayName(account?.preferredDisplayName ?? "");
    setUsername(account?.username ?? "");
  }, [account?.preferredDisplayName, account?.username]);

  if (!account || status === "loading" || status === "signedOut") {
    return null;
  }

  const handleSave = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await saveProfile({ displayName, username });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ShellSection title="Profile" marginBottom="$3">
      <ShellCard compact testID="ProfileSection">
        <YStack gap="$4">
          <Text fontSize={14} color="$textSecondary">
            Edit the visible name and handle stored on your host account.
          </Text>

          <YStack gap="$1.5">
            <Text fontSize={13} fontWeight="600" color="$textMuted">
              Display name
            </Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Your display name"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              style={inputStyles.input}
              testID="ProfileDisplayNameInput"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </YStack>

          <YStack gap="$1.5">
            <Text fontSize={13} fontWeight="600" color="$textMuted">
              Username or handle
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Your handle"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={inputStyles.input}
              testID="ProfileUsernameInput"
              value={username}
              onChangeText={setUsername}
              onSubmitEditing={() => {
                void handleSave();
              }}
            />
          </YStack>

          {errorMessage ? (
            <Text testID="ProfileValidationMessage" fontSize={14} color="$danger">
              {errorMessage}
            </Text>
          ) : null}

          <ShellActionButton
            disabled={isSubmitting}
            label={isSubmitting ? "Saving…" : "Save profile"}
            onPress={() => {
              void handleSave();
            }}
          />

          <Text fontSize={13} color="$textMuted" textAlign="center">
            Handles only need to be non-empty after trimming. Duplicate handles
            are allowed.
          </Text>
        </YStack>
      </ShellCard>
    </ShellSection>
  );
};

export default ProfileSection;
