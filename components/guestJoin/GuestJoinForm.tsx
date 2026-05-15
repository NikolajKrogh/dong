import React from "react";
import { ActivityIndicator, StyleSheet, TextInput } from "react-native";
import { Text, XStack, YStack, styled, useTheme } from "tamagui";

import { ShellActionButton } from "../ui";

interface GuestJoinFormProps {
  joinCode: string;
  guestName: string;
  error: string | null;
  isSubmitting: boolean;
  retryMessage?: string | null;
  submitLabel?: string;
  onJoinCodeChange: (value: string) => void;
  onGuestNameChange: (value: string) => void;
  onSubmit: () => void;
}

const FormField = styled(YStack, {
  gap: "$2",
});

const styles = StyleSheet.create({
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },
});

export const GuestJoinForm: React.FC<GuestJoinFormProps> = ({
  joinCode,
  guestName,
  error,
  isSubmitting,
  retryMessage,
  submitLabel = "Join Room",
  onJoinCodeChange,
  onGuestNameChange,
  onSubmit,
}) => {
  const theme = useTheme();

  return (
    <YStack gap="$4">
      <FormField>
        <Text color="$colorSecondary" fontSize={14} fontWeight="700">
          Room Code
        </Text>
        <TextInput
          accessibilityLabel="Room Code"
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={onJoinCodeChange}
          placeholder="Enter room code"
          placeholderTextColor={theme.colorPlaceholder.val}
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundLight.val,
              borderColor: error
                ? theme.danger.val
                : theme.borderColorLight.val,
              color: theme.color.val,
            },
          ]}
          value={joinCode}
        />
      </FormField>

      <FormField>
        <Text color="$colorSecondary" fontSize={14} fontWeight="700">
          Guest Name
        </Text>
        <TextInput
          accessibilityLabel="Guest Name"
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={onGuestNameChange}
          placeholder="Enter your name"
          placeholderTextColor={theme.colorPlaceholder.val}
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundLight.val,
              borderColor: error
                ? theme.danger.val
                : theme.borderColorLight.val,
              color: theme.color.val,
            },
          ]}
          value={guestName}
        />
      </FormField>

      {error ? (
        <Text color="$danger" fontSize={14} lineHeight={20}>
          {error}
        </Text>
      ) : null}
      {error && retryMessage ? (
        <Text color="$colorMuted" fontSize={13} lineHeight={18}>
          {retryMessage}
        </Text>
      ) : null}

      <ShellActionButton
        label={isSubmitting ? "Joining..." : submitLabel}
        onPress={onSubmit}
        variant="success"
      />

      {isSubmitting ? (
        <XStack justifyContent="center" paddingTop="$1">
          <ActivityIndicator color={theme.success.val} />
        </XStack>
      ) : null}
    </YStack>
  );
};
