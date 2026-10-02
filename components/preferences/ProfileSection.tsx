import React, { useRef, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { Text, YStack } from "tamagui";

import { useColors } from "../../styles/theme";
import { useAccountAuth } from "../../hooks/useAccountAuth";
import { ShellActionButton, ShellCard, ShellSection } from "../ui";

const ProfileSection = ({ showSectionTitle = true }: { showSectionTitle?: boolean }) => {
  const colors = useColors();
  const { account, saveUsername, status } = useAccountAuth();
  const [username, setUsername] = useState(
    account?.username ?? "",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

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

  const initialUsername = account?.username ?? "";
  const [previousUsername, setPreviousUsername] = useState(initialUsername);
  if (previousUsername !== initialUsername) {
    setPreviousUsername(initialUsername);
    setUsername(initialUsername);
  }

  if (!account || status === "loading" || status === "signedOut") {
    return null;
  }

  const handleSave = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await saveUsername(username);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the profile.",
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <ShellSection title={showSectionTitle ? "Profile" : "Public profile"} marginBottom="$3">
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
              Username
            </Text>
            <Text fontSize={14} color="$textSecondary">
              This is the name other players see in rooms and invites.
            </Text>
          </YStack>

          <YStack gap="$1.5">
            <Text fontSize={13} fontWeight="600" color="$textMuted">
              Username
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter your username"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={inputStyles.input}
              testID="ProfileDisplayNameInput"
              value={username}
              onChangeText={setUsername}
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
            label={isSubmitting ? "Saving…" : "Save username"}
            onPress={() => {
              void handleSave();
            }}
          />

          <Text fontSize={13} color="$textMuted" textAlign="center">
            Use 3–30 letters, numbers, or underscores. Your username is unique.
          </Text>
        </YStack>
      </ShellCard>
    </ShellSection>
  );
};

export default ProfileSection;
