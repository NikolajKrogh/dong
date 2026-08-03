import React, { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { Text, YStack } from "tamagui";

import { useColors } from "../../styles/theme";
import { useAccountAuth } from "../../hooks/useAccountAuth";
import { ShellActionButton, ShellCard, ShellSection } from "../ui";

const ProfileSection = () => {
  const colors = useColors();
  const { account, saveDisplayName, status } = useAccountAuth();
  const [displayName, setDisplayName] = useState(
    account?.preferredDisplayName ?? "",
  );
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
  }, [account?.preferredDisplayName]);

  if (!account || status === "loading" || status === "signedOut") {
    return null;
  }

  const handleSave = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await saveDisplayName(displayName);
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
          <YStack gap="$1">
            <Text
              fontSize={12}
              fontWeight="700"
              color="$primary"
              letterSpacing={0.8}
              textTransform="uppercase"
            >
              Host identity
            </Text>
            <Text fontSize={18} fontWeight="700" color="$textPrimary">
              Display name
            </Text>
            <Text fontSize={14} color="$textSecondary">
              This is the name other players see in rooms and invites.
            </Text>
          </YStack>

          <YStack gap="$1.5">
            <Text fontSize={13} fontWeight="600" color="$textMuted">
              Display name
            </Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Enter your display name"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={inputStyles.input}
              testID="ProfileDisplayNameInput"
              value={displayName}
              onChangeText={setDisplayName}
              onSubmitEditing={() => {
                void handleSave();
              }}
            />
          </YStack>

          {errorMessage ? (
            <Text
              testID="ProfileValidationMessage"
              fontSize={14}
              color="$danger"
            >
              {errorMessage}
            </Text>
          ) : null}

          <ShellActionButton
            disabled={isSubmitting}
            label={isSubmitting ? "Saving…" : "Save display name"}
            onPress={() => {
              void handleSave();
            }}
          />

          <Text fontSize={13} color="$textMuted" textAlign="center">
            Duplicate display names are allowed.
          </Text>
        </YStack>
      </ShellCard>
    </ShellSection>
  );
};

export default ProfileSection;
