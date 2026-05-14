import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { Text, XStack, YStack } from "tamagui";

import { useColors } from "../../app/style/theme";
import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth,
} from "../../hooks/useAccountAuth";
import { getSupabaseClient } from "../../utils/supabaseClient";
import { ShellActionButton, ShellCard } from "../ui";

interface PasswordResetFormProps {
  returnTo?: string | null;
  recoveryCode?: string | null;
}

const PasswordResetForm = ({ returnTo, recoveryCode }: PasswordResetFormProps) => {
  const router = useRouter();
  const colors = useColors();
  const { completePasswordRecovery, requestPasswordReset, status } = useAccountAuth();
  const normalizedReturnTo = normalizeAccountFlowReturnTo(returnTo);
  const normalizedRecoveryCode = recoveryCode?.trim() || null;

  const [email, setEmail] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [recoveryConfirmationMessage, setRecoveryConfirmationMessage] =
    useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasEstablishedRecoverySession, setHasEstablishedRecoverySession] = useState(false);
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCompletedRecovery, setHasCompletedRecovery] = useState(false);

  const confirmPasswordRef = useRef<TextInput>(null);

  const isRecoveryMode =
    hasCompletedRecovery || hasEstablishedRecoverySession || status === "recoveringPassword";

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
    if (!normalizedRecoveryCode || isRecoveryMode) {
      return;
    }

    let isActive = true;

    const exchangeRecoveryCode = async () => {
      setErrorMessage(null);
      setIsRecoveringSession(true);

      try {
        const { error } = await getSupabaseClient().auth.exchangeCodeForSession(
          normalizedRecoveryCode,
        );
        if (error) throw error;
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to open the recovery link.",
          );
          setIsRecoveringSession(false);
        }
        return;
      }

      if (isActive) {
        setIsRecoveringSession(false);
        setHasEstablishedRecoverySession(true);
      }
    };

    void exchangeRecoveryCode();
    return () => { isActive = false; };
  }, [isRecoveryMode, normalizedRecoveryCode]);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setConfirmationMessage(null);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email, normalizedReturnTo);
      setConfirmationMessage(
        "Check your email for the recovery link. When you open it, you can return here to finish the reset.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to request a reset.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoverySubmit = async () => {
    setErrorMessage(null);
    setRecoveryConfirmationMessage(null);
    setIsSubmitting(true);

    if (newPassword !== confirmPassword) {
      setIsSubmitting(false);
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      await completePasswordRecovery(newPassword);
      setHasCompletedRecovery(true);
      setHasEstablishedRecoverySession(false);
      setRecoveryConfirmationMessage(
        "Your password has been updated. Return to sign in and use the new password to continue.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update the password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const returnToSignIn = () => {
    router.replace(buildAccountAuthRoute("/auth", normalizedReturnTo) as never);
  };

  if (isRecoveringSession) {
    return (
      <ShellCard elevated>
        <YStack gap="$4">
          <YStack gap="$2">
            <Text fontSize={22} fontWeight="700" color="$textPrimary">
              Reset your password
            </Text>
            <Text fontSize={15} color="$textSecondary">
              Completing your recovery link and preparing the password form.
            </Text>
          </YStack>
          <Text fontSize={14} color="$textSecondary">
            Please wait while we open the recovery link.
          </Text>
        </YStack>
      </ShellCard>
    );
  }

  if (isRecoveryMode) {
    return (
      <ShellCard elevated>
        <YStack gap="$4">
          <YStack gap="$2">
            <Text fontSize={22} fontWeight="700" color="$textPrimary">
              Set a new password
            </Text>
            <Text fontSize={15} color="$textSecondary">
              Choose a password for your account and confirm it below.
            </Text>
          </YStack>

          {errorMessage ? (
            <Text fontSize={14} color="$danger">{errorMessage}</Text>
          ) : null}
          {recoveryConfirmationMessage ? (
            <Text fontSize={14} color="$textSecondary">{recoveryConfirmationMessage}</Text>
          ) : null}

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
              onSubmitEditing={() => void handleRecoverySubmit()}
            />
          </YStack>

          <ShellActionButton
            disabled={isSubmitting}
            label={isSubmitting ? "Updating…" : "Update password"}
            onPress={() => void handleRecoverySubmit()}
          />

          <XStack justifyContent="center">
            <Text
              fontSize={14}
              color="$primary"
              fontWeight="600"
              pressStyle={{ opacity: 0.7 }}
              onPress={returnToSignIn}
            >
              Return to sign in
            </Text>
          </XStack>
        </YStack>
      </ShellCard>
    );
  }

  return (
    <ShellCard elevated>
      <YStack gap="$4">
        <YStack gap="$2">
          <Text fontSize={22} fontWeight="700" color="$textPrimary">
            Reset your password
          </Text>
          <Text fontSize={15} color="$textSecondary">
            Enter the email address for your account and we will send a recovery
            link.
          </Text>
        </YStack>

        <YStack gap="$1.5">
          <Text fontSize={13} fontWeight="600" color="$textMuted">
            Email address
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={inputStyles.input}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => void handleSubmit()}
          />
        </YStack>

        {errorMessage ? (
          <Text fontSize={14} color="$danger">{errorMessage}</Text>
        ) : null}
        {confirmationMessage ? (
          <Text fontSize={14} color="$textSecondary">{confirmationMessage}</Text>
        ) : null}

        <ShellActionButton
          disabled={isSubmitting}
          label={isSubmitting ? "Sending…" : "Send recovery email"}
          onPress={() => void handleSubmit()}
        />

        <XStack justifyContent="center">
          <Text
            fontSize={14}
            color="$primary"
            fontWeight="600"
            pressStyle={{ opacity: 0.7 }}
            onPress={returnToSignIn}
          >
            Return to sign in
          </Text>
        </XStack>
      </YStack>
    </ShellCard>
  );
};

export default PasswordResetForm;
