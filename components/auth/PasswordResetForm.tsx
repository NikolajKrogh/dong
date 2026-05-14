import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null,
  );
  const [recoveryConfirmationMessage, setRecoveryConfirmationMessage] =
    useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasEstablishedRecoverySession, setHasEstablishedRecoverySession] =
    useState(false);
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCompletedRecovery, setHasCompletedRecovery] = useState(false);

  const isRecoveryMode =
    hasCompletedRecovery || hasEstablishedRecoverySession || status === "recoveringPassword";

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

        if (error) {
          throw error;
        }
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

    return () => {
      isActive = false;
    };
  }, [isRecoveryMode, normalizedRecoveryCode]);

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

  if (isRecoveringSession) {
    return (
      <ShellCard elevated>
        <View style={styles.container}>
          <View style={{ gap: 8 }}>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>
              Completing your recovery link and preparing the password form.
            </Text>
          </View>

          <Text style={styles.message}>Please wait while we open the recovery link.</Text>
        </View>
      </ShellCard>
    );
  }

  if (isRecoveryMode) {
    return (
      <ShellCard elevated>
        <View style={styles.container}>
          <View style={{ gap: 8 }}>
            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>
              Choose a password for your account and confirm it below.
            </Text>
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          {recoveryConfirmationMessage ? (
            <Text style={styles.message}>{recoveryConfirmationMessage}</Text>
          ) : null}

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Confirm new password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <ShellActionButton
            disabled={isSubmitting}
            label={isSubmitting ? "Updating…" : "Update password"}
            onPress={() => {
              void handleRecoverySubmit();
            }}
          />

          <Pressable
            onPress={() => {
              router.replace(
                buildAccountAuthRoute("/auth", normalizedReturnTo) as never,
              );
            }}
          >
            <Text style={styles.link}>Return to sign in</Text>
          </Pressable>
        </View>
      </ShellCard>
    );
  }

  return (
    <ShellCard elevated>
      <View style={styles.container}>
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>
            Enter the email address for your account and we will send a recovery
            link.
          </Text>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email address"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {confirmationMessage ? (
          <Text style={styles.message}>{confirmationMessage}</Text>
        ) : null}

        <ShellActionButton
          disabled={isSubmitting}
          label={isSubmitting ? "Sending…" : "Send recovery email"}
          onPress={() => {
            void handleSubmit();
          }}
        />

        <Pressable
          onPress={() => {
            router.replace(
                buildAccountAuthRoute("/auth", normalizedReturnTo) as never,
            );
          }}
        >
          <Text style={styles.link}>Return to sign in</Text>
        </Pressable>
      </View>
    </ShellCard>
  );
};

export default PasswordResetForm;