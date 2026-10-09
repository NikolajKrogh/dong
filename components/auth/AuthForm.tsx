import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { Text, XStack, YStack, styled } from "tamagui";

import { useColors } from "../../styles/theme";
import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth as useAccountAuthState,
} from "../../hooks/useAccountAuth";
import { getSupabaseClient } from "../../lib/supabase";
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

interface AuthStatusCardProps {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}

const AuthStatusCard = ({
  title,
  description,
  children,
}: AuthStatusCardProps) => (
  <ShellCard elevated>
    <YStack gap="$4">
      <YStack gap="$2">
        <Text fontSize={22} fontWeight="700" color="$textPrimary">
          {title}
        </Text>
        <Text fontSize={15} color="$textSecondary">
          {description}
        </Text>
      </YStack>
      {children}
    </YStack>
  </ShellCard>
);

interface SignupVerificationPanelProps {
  email: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  otpCode: string;
  setOtpCode: (value: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onUseDifferentEmail: () => void;
}

const SignupVerificationPanel = ({
  email,
  errorMessage,
  isSubmitting,
  otpCode,
  setOtpCode,
  onVerify,
  onResend,
  onUseDifferentEmail,
}: SignupVerificationPanelProps) => {
  const colors = useColors();
  const otpInputRef = useRef<TextInput>(null);
  const otpInputStyle = StyleSheet.create({
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
  }).otpInput;

  return (
    <AuthStatusCard
      title="Check your inbox"
      description={
        <>
          We sent a 6-digit code to{" "}
          <Text fontWeight="600" color="$textPrimary">
            {email}
          </Text>
          . Enter it below to confirm your account.
        </>
      }
    >
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
          style={otpInputStyle}
          value={otpCode}
          onChangeText={setOtpCode}
          onSubmitEditing={onVerify}
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
        onPress={onVerify}
      />

      <YStack gap="$2" alignItems="center">
        <Text
          fontSize={14}
          color="$primary"
          fontWeight="600"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => {
            if (!isSubmitting) onResend();
          }}
        >
          Didn&apos;t receive it? Resend
        </Text>
        <Text
          fontSize={14}
          color="$primary"
          fontWeight="600"
          pressStyle={{ opacity: 0.7 }}
          onPress={onUseDifferentEmail}
        >
          Use a different email?
        </Text>
      </YStack>
    </AuthStatusCard>
  );
};

interface AuthCredentialsFormProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  showConfirmPassword: boolean;
  setShowConfirmPassword: React.Dispatch<React.SetStateAction<boolean>>;
  errorMessage: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onForgotPassword: () => void;
}

type AuthInputRef = React.RefObject<TextInput | null>;

interface AuthFieldProps {
  colors: ReturnType<typeof useColors>;
  inputStyle: StyleProp<TextStyle>;
}

const DisplayNameField = ({
  visible,
  value,
  onChange,
  onSubmitEditing,
  inputRef,
  colors,
  inputStyle,
}: AuthFieldProps & {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmitEditing: () => void;
  inputRef: AuthInputRef;
}) => {
  if (!visible) return null;

  return (
    <YStack gap="$1">
      <XStack alignItems="center" gap="$1.5">
        <Ionicons name="person-outline" size={15} color={colors.textMuted} />
        <Text fontSize={13} fontWeight="600" color="$textMuted">
          Display name
        </Text>
      </XStack>
      <TextInput
        ref={inputRef}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="Your name"
        placeholderTextColor={colors.textMuted}
        returnKeyType="next"
        style={inputStyle}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmitEditing}
      />
    </YStack>
  );
};

const EmailAddressField = ({
  value,
  onChange,
  onSubmitEditing,
  inputRef,
  colors,
  inputStyle,
}: AuthFieldProps & {
  value: string;
  onChange: (value: string) => void;
  onSubmitEditing: () => void;
  inputRef: AuthInputRef;
}) => (
  <YStack gap="$1">
    <XStack alignItems="center" gap="$1.5">
      <Ionicons name="mail-outline" size={15} color={colors.textMuted} />
      <Text fontSize={13} fontWeight="600" color="$textMuted">
        Email address
      </Text>
    </XStack>
    <TextInput
      ref={inputRef}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="email-address"
      placeholder="you@example.com"
      placeholderTextColor={colors.textMuted}
      returnKeyType="next"
      style={inputStyle}
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmitEditing}
    />
  </YStack>
);

const PasswordField = ({
  mode,
  value,
  onChange,
  visible,
  onToggleVisibility,
  onForgotPassword,
  focusConfirmPassword,
  onSubmit,
  inputRef,
  colors,
  inputStyle,
}: AuthFieldProps & {
  mode: AuthMode;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  onForgotPassword: () => void;
  focusConfirmPassword: () => void;
  onSubmit: () => void;
  inputRef: AuthInputRef;
}) => (
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
          onPress={onForgotPassword}
        >
          Forgot yours?
        </Text>
      ) : null}
    </XStack>
    <XStack position="relative" alignItems="center">
      <TextInput
        ref={inputRef}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={mode === "signUp" ? "Create a password" : "Enter your password"}
        placeholderTextColor={colors.textMuted}
        returnKeyType={mode === "signUp" ? "next" : "done"}
        secureTextEntry={!visible}
        style={[inputStyle, { flex: 1, paddingRight: 44 }]}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={() => {
          if (mode === "signUp") {
            focusConfirmPassword();
          } else {
            onSubmit();
          }
        }}
      />
      <Pressable
        onPress={onToggleVisibility}
        style={{ position: "absolute", right: 12 }}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>
    </XStack>
  </YStack>
);

const ConfirmPasswordField = ({
  visible,
  value,
  onChange,
  passwordVisible,
  onToggleVisibility,
  onSubmit,
  inputRef,
  colors,
  inputStyle,
}: AuthFieldProps & {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  passwordVisible: boolean;
  onToggleVisibility: () => void;
  onSubmit: () => void;
  inputRef: AuthInputRef;
}) => {
  if (!visible) return null;

  return (
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
          ref={inputRef}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Re-enter password"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          secureTextEntry={!passwordVisible}
          style={[inputStyle, { flex: 1, paddingRight: 44 }]}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
        />
        <Pressable
          onPress={onToggleVisibility}
          style={{ position: "absolute", right: 12 }}
        >
          <Ionicons
            name={passwordVisible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      </XStack>
    </YStack>
  );
};

const AuthFormFeedback = ({
  errorMessage,
  isSignUp,
}: {
  errorMessage: string | null;
  isSignUp: boolean;
}) => (
  <>
    {errorMessage ? (
      <Text fontSize={14} color="$danger">
        {errorMessage}
      </Text>
    ) : null}
    {isSignUp ? (
      <Text fontSize={12} color="$textMuted" textAlign="center">
        By creating an account, you agree to the terms of service.
      </Text>
    ) : null}
  </>
);

const AuthCredentialsForm = ({
  mode,
  onModeChange,
  displayName,
  setDisplayName,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  errorMessage,
  isSubmitting,
  onSubmit,
  onForgotPassword,
}: AuthCredentialsFormProps) => {
  const colors = useColors();
  const displayNameRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
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
  });
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
        <TabContainer>
          <TabPill
            active={mode === "signIn"}
            onPress={() => onModeChange("signIn")}
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
            onPress={() => onModeChange("signUp")}
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

        <DisplayNameField
          visible={mode === "signUp"}
          value={displayName}
          onChange={setDisplayName}
          onSubmitEditing={() => emailInputRef.current?.focus()}
          inputRef={displayNameRef}
          colors={colors}
          inputStyle={inputStyles.input}
        />

        <EmailAddressField
          value={email}
          onChange={setEmail}
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          inputRef={emailInputRef}
          colors={colors}
          inputStyle={inputStyles.input}
        />

        <PasswordField
          mode={mode}
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggleVisibility={() => setShowPassword((value) => !value)}
          onForgotPassword={onForgotPassword}
          focusConfirmPassword={() => confirmPasswordRef.current?.focus()}
          onSubmit={onSubmit}
          inputRef={passwordInputRef}
          colors={colors}
          inputStyle={inputStyles.input}
        />

        <ConfirmPasswordField
          visible={mode === "signUp"}
          value={confirmPassword}
          onChange={setConfirmPassword}
          passwordVisible={showConfirmPassword}
          onToggleVisibility={() =>
            setShowConfirmPassword((value) => !value)
          }
          onSubmit={onSubmit}
          inputRef={confirmPasswordRef}
          colors={colors}
          inputStyle={inputStyles.input}
        />

        <AuthFormFeedback
          errorMessage={errorMessage}
          isSignUp={mode === "signUp"}
        />

        <ShellActionButton
          borderRadius="$5"
          disabled={isSubmitting}
          label={submitLabel}
          onPress={onSubmit}
        />

      </YStack>
    </ShellCard>
  );
};

const AuthForm = ({ returnTo, confirmationCode }: AuthFormProps) => {
  const router = useRouter();
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

  useEffect(() => {
    if (status === "ready") {
      router.replace((normalizedReturnTo ?? "/") as Href);
    }
    if (status === "needsUsername") {
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
      status === "needsUsername" ||
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
      <AuthStatusCard
        title="Confirming your account"
        description="Opening your confirmation link and preparing the account."
      >
        <Text fontSize={14} color="$textSecondary">
          Please wait while we finish the sign-up confirmation.
        </Text>
      </AuthStatusCard>
    );
  }

  if (signUpEmailSent) {
    return (
      <SignupVerificationPanel
        email={email}
        errorMessage={errorMessage}
        isSubmitting={isSubmitting}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        onVerify={() => void handleVerifyOtp()}
        onResend={() => void handleResend()}
        onUseDifferentEmail={() => {
          setSignUpEmailSent(false);
          setOtpCode("");
          setErrorMessage(null);
        }}
      />
    );
  }

  return (
    <AuthCredentialsForm
      mode={mode}
      onModeChange={(nextMode) => {
        setMode(nextMode);
        setErrorMessage(null);
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
      }}
      displayName={displayName}
      setDisplayName={setDisplayName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
      onForgotPassword={() => {
        router.push(
          buildAccountAuthRoute(
            "/auth/reset-password",
            normalizedReturnTo,
          ) as never,
        );
      }}
    />
  );
};

export default AuthForm;
