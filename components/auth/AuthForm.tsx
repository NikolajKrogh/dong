import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput } from "react-native";
import { Text, XStack, YStack, styled } from "tamagui";

import { useColors } from "../../app/style/theme";
import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth as useAccountAuthState,
} from "../../hooks/useAccountAuth";
import { getSupabaseClient } from "../../utils/supabaseClient";
import { ShellActionButton, ShellCard } from "../ui";

type AuthMode = "signIn" | "signUp";

interface AuthFormProps {
  returnTo?: string | null;
  confirmationCode?: string | null;
}

const TabContainer = styled(XStack, {
  backgroundColor: "$backgroundSubtle",
  borderRadius: "$4",
  padding: "$1",
  gap: 0,
});

const TabPill = styled(XStack, {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: "$2",
  borderRadius: "$3",
  pressStyle: { opacity: 0.8 },
  cursor: "pointer",
  variants: {
    active: {
      true: {
        backgroundColor: "$surface",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 2,
      },
      false: { backgroundColor: "transparent" },
    },
  } as const,
  defaultVariants: { active: false },
});

const AuthForm = ({ returnTo, confirmationCode }: AuthFormProps) => {
  const router = useRouter();
  const colors = useColors();
  const { signUp, signIn, verifySignupOtp, status } = useAccountAuthState();
  const normalizedReturnTo = normalizeAccountFlowReturnTo(returnTo);
  const normalizedConfirmationCode = confirmationCode?.trim() || null;

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signUpEmailSent, setSignUpEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingSession, setIsConfirmingSession] = useState(false);
  const [
    hasEstablishedConfirmationSession,
    setHasEstablishedConfirmationSession,
  ] = useState(false);

  const displayNameRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);

  const inputStyles = StyleSheet.create({
    input: {
      borderWidth: 0,
      backgroundColor: colors.backgroundSubtle,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textPrimary,
    },
    otpInput: {
      borderWidth: 0,
      backgroundColor: colors.backgroundSubtle,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 16,
      fontSize: 28,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      letterSpacing: 8,
    },
  });

  useEffect(() => {
    if (status === "ready") {
      router.replace((normalizedReturnTo ?? "/") as Href);
    }
    if (status === "needsDisplayName") {
      router.replace(
        buildAccountAuthRoute("/auth/onboarding", normalizedReturnTo, {
          prefillName: displayName,
        }) as never,
      );
    }
  }, [normalizedReturnTo, router, status, displayName]);

  useEffect(() => {
    if (
      !normalizedConfirmationCode ||
      hasEstablishedConfirmationSession ||
      status === "needsDisplayName" ||
      status === "ready"
    ) {
      return;
    }

    let isActive = true;

    const exchangeConfirmationCode = async () => {
      setErrorMessage(null);
      setIsConfirmingSession(true);

      try {
        const { error } = await getSupabaseClient().auth.exchangeCodeForSession(
          normalizedConfirmationCode,
        );
        if (error) throw error;
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to open the confirmation link.",
          );
          setIsConfirmingSession(false);
        }
        return;
      }

      if (isActive) {
        setIsConfirmingSession(false);
        setHasEstablishedConfirmationSession(true);
      }
    };

    void exchangeConfirmationCode();
    return () => {
      isActive = false;
    };
  }, [hasEstablishedConfirmationSession, normalizedConfirmationCode, status]);

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (mode === "signUp" && password !== confirmPassword) {
      setErrorMessage("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "signIn") {
        await signIn(email, password);
      } else {
        await signUp(email, password, normalizedReturnTo);
        setSignUpEmailSent(true);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to continue.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await verifySignupOtp(email, otpCode);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to verify the code.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    setOtpCode("");

    try {
      await signUp(email, password, normalizedReturnTo);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to resend the code.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isConfirmingSession) {
    return (
      <ShellCard elevated>
        <YStack gap="$4">
          <YStack gap="$2">
            <Text fontSize={22} fontWeight="700" color="$textPrimary">
              Confirming your account
            </Text>
            <Text fontSize={15} color="$textSecondary">
              Opening your confirmation link and preparing the account.
            </Text>
          </YStack>
          <Text fontSize={14} color="$textSecondary">
            Please wait while we finish the sign-up confirmation.
          </Text>
        </YStack>
      </ShellCard>
    );
  }

  if (signUpEmailSent) {
    return (
      <ShellCard elevated>
        <YStack gap="$4">
          <YStack gap="$2">
            <Text fontSize={22} fontWeight="700" color="$textPrimary">
              Check your inbox
            </Text>
            <Text fontSize={15} color="$textSecondary">
              We sent a 6-digit code to{" "}
              <Text fontWeight="600" color="$textPrimary">
                {email}
              </Text>
              . Enter it below to confirm your account.
            </Text>
          </YStack>

          <YStack gap="$1">
            <Text fontSize={13} fontWeight="600" color="$textMuted">
              Verification code
            </Text>
            <TextInput
              ref={otpInputRef}
              autoFocus
              keyboardType="number-pad"
              maxLength={6}
              placeholder="------"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={inputStyles.otpInput}
              value={otpCode}
              onChangeText={setOtpCode}
              onSubmitEditing={() => void handleVerifyOtp()}
            />
          </YStack>

          {errorMessage ? (
            <Text fontSize={14} color="$danger">
              {errorMessage}
            </Text>
          ) : null}

          <ShellActionButton
            borderRadius="$5"
            disabled={isSubmitting || otpCode.length < 6}
            label={isSubmitting ? "Verifying…" : "Confirm account  →"}
            onPress={() => void handleVerifyOtp()}
          />

          <YStack gap="$2" alignItems="center">
            <Text
              fontSize={14}
              color="$primary"
              fontWeight="600"
              pressStyle={{ opacity: 0.7 }}
              onPress={() => {
                if (!isSubmitting) void handleResend();
              }}
            >
              Didn&apos;t receive it? Resend
            </Text>
            <Text
              fontSize={14}
              color="$primary"
              fontWeight="600"
              pressStyle={{ opacity: 0.7 }}
              onPress={() => {
                setSignUpEmailSent(false);
                setOtpCode("");
                setErrorMessage(null);
              }}
            >
              Use a different email?
            </Text>
          </YStack>
        </YStack>
      </ShellCard>
    );
  }

  const subtitle =
    mode === "signIn"
      ? "Use your account to restore the same multiplayer identity on every device."
      : "Choose an email and password, then confirm your account and set your display name.";

  const submitLabel = isSubmitting
    ? "Please wait…"
    : mode === "signIn"
      ? "Sign in  →"
      : "Create account  →";

  return (
    <ShellCard elevated>
      <YStack gap="$4">
        {/* Mode tabs */}
        <TabContainer>
          <TabPill
            active={mode === "signIn"}
            onPress={() => {
              setMode("signIn");
              setErrorMessage(null);
              setPassword("");
              setConfirmPassword("");
              setShowPassword(false);
              setShowConfirmPassword(false);
            }}
          >
            <Text
              fontSize={15}
              fontWeight={mode === "signIn" ? "700" : "500"}
              color={mode === "signIn" ? "$textPrimary" : "$textMuted"}
            >
              Sign in
            </Text>
          </TabPill>
          <TabPill
            active={mode === "signUp"}
            onPress={() => {
              setMode("signUp");
              setErrorMessage(null);
              setPassword("");
              setConfirmPassword("");
              setShowPassword(false);
              setShowConfirmPassword(false);
            }}
          >
            <Text
              fontSize={15}
              fontWeight={mode === "signUp" ? "700" : "500"}
              color={mode === "signUp" ? "$textPrimary" : "$textMuted"}
            >
              Create account
            </Text>
          </TabPill>
        </TabContainer>

        <Text fontSize={14} color="$primary" textAlign="center" fontStyle="italic">
          {subtitle}
        </Text>

        {/* Display name (sign-up only) */}
        {mode === "signUp" ? (
          <YStack gap="$1">
            <XStack alignItems="center" gap="$1.5">
              <Ionicons
                name="person-outline"
                size={15}
                color={colors.textMuted}
              />
              <Text fontSize={13} fontWeight="600" color="$textMuted">
                Display name
              </Text>
            </XStack>
            <TextInput
              ref={displayNameRef}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              style={inputStyles.input}
              value={displayName}
              onChangeText={setDisplayName}
              onSubmitEditing={() => emailInputRef.current?.focus()}
            />
          </YStack>
        ) : null}

        {/* Email input */}
        <YStack gap="$1">
          <XStack alignItems="center" gap="$1.5">
            <Ionicons name="mail-outline" size={15} color={colors.textMuted} />
            <Text fontSize={13} fontWeight="600" color="$textMuted">
              Email address
            </Text>
          </XStack>
          <TextInput
            ref={emailInputRef}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            style={inputStyles.input}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
        </YStack>

        {/* Password input */}
        <YStack gap="$1">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$1.5">
              <Ionicons
                name="lock-closed-outline"
                size={15}
                color={colors.textMuted}
              />
              <Text fontSize={13} fontWeight="600" color="$textMuted">
                Password
              </Text>
            </XStack>
            {mode === "signIn" ? (
              <Text
                fontSize={13}
                color="$primary"
                fontWeight="600"
                pressStyle={{ opacity: 0.7 }}
                onPress={() => {
                  router.push(
                    buildAccountAuthRoute(
                      "/auth/reset-password",
                      normalizedReturnTo,
                    ) as never,
                  );
                }}
              >
                Forgot yours?
              </Text>
            ) : null}
          </XStack>
          <XStack position="relative" alignItems="center">
            <TextInput
              ref={passwordInputRef}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={
                mode === "signUp" ? "Create a password" : "Enter your password"
              }
              placeholderTextColor={colors.textMuted}
              returnKeyType={mode === "signUp" ? "next" : "done"}
              secureTextEntry={!showPassword}
              style={[inputStyles.input, { flex: 1, paddingRight: 44 }]}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => {
                if (mode === "signUp") {
                  confirmPasswordRef.current?.focus();
                } else {
                  void handleSubmit();
                }
              }}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: 12 }}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </XStack>
        </YStack>

        {/* Confirm password (sign-up only) */}
        {mode === "signUp" ? (
          <YStack gap="$1">
            <XStack alignItems="center" gap="$1.5">
              <Ionicons
                name="lock-closed-outline"
                size={15}
                color={colors.textMuted}
              />
              <Text fontSize={13} fontWeight="600" color="$textMuted">
                Confirm password
              </Text>
            </XStack>
            <XStack position="relative" alignItems="center">
              <TextInput
                ref={confirmPasswordRef}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Re-enter password"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                secureTextEntry={!showConfirmPassword}
                style={[inputStyles.input, { flex: 1, paddingRight: 44 }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onSubmitEditing={() => void handleSubmit()}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((v) => !v)}
                style={{ position: "absolute", right: 12 }}
              >
                <Ionicons
                  name={
                    showConfirmPassword ? "eye-off-outline" : "eye-outline"
                  }
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </XStack>
          </YStack>
        ) : null}

        {errorMessage ? (
          <Text fontSize={14} color="$danger">
            {errorMessage}
          </Text>
        ) : null}

        <ShellActionButton
          borderRadius="$5"
          disabled={isSubmitting}
          label={submitLabel}
          onPress={() => void handleSubmit()}
        />

        {mode === "signUp" ? (
          <Text fontSize={12} color="$textMuted" textAlign="center">
            By creating an account, you agree to the terms of service.
          </Text>
        ) : null}
      </YStack>
    </ShellCard>
  );
};

export default AuthForm;
