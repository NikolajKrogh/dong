import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { Text, XStack, YStack, styled } from "tamagui";
import { ShellActionButton, ShellCard } from "../../components/ui";
import { useColors } from "../../styles/theme";

export type AuthMode = "signIn" | "signUp";

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
  minHeight: 44,
  borderWidth: 0,
  focusVisibleStyle: { outlineWidth: 2, outlineStyle: "solid", outlineColor: "$primaryFocus", outlineOffset: 2 },
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

export const AuthStatusCard = ({
  title,
  description,
  children,
}: AuthStatusCardProps) => (
  <ShellCard elevated>
    <YStack gap="$4">
      <YStack gap="$2">
        <Text {...(Platform.OS === "web" ? { role: "heading" as const, "aria-level": 2 } : { accessibilityRole: "header" as const })} fontSize={22} fontWeight="700" color="$color">
          {title}
        </Text>
        <Text fontSize={15} color="$colorSecondary">
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

export const SignupVerificationPanel = ({
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
          <Text fontWeight="600" color="$color">
            {email}
          </Text>
          . Enter it below to confirm your account.
        </>
      }
    >
      <YStack gap="$1">
        <Text fontSize={13} fontWeight="600" color="$colorMuted">
          Verification code
        </Text>
        <TextInput
          ref={otpInputRef}
          accessibilityLabel="Verification code"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          aria-describedby={errorMessage ? "auth-verification-error" : undefined}
          aria-invalid={Boolean(errorMessage)}
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
        <Text nativeID="auth-verification-error" role="alert" accessibilityLiveRegion="polite" fontSize={14} color="$danger">
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
        <ShellActionButton variant="surface" size="small" widthMode="fit"
          disabled={isSubmitting} label="Didn't receive it? Resend" onPress={onResend} />
        <ShellActionButton variant="surface" size="small" widthMode="fit"
          label="Use a different email?" onPress={onUseDifferentEmail} />
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
        <Text fontSize={13} fontWeight="600" color="$colorMuted">
          Display name
        </Text>
      </XStack>
      <TextInput
        ref={inputRef}
        accessibilityLabel="Display name"
        autoComplete="nickname"
        textContentType="nickname"
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
  mode,
  errorMessage,
  value,
  onChange,
  onSubmitEditing,
  inputRef,
  colors,
  inputStyle,
}: AuthFieldProps & {
  mode: AuthMode;
  errorMessage: string | null;
  value: string;
  onChange: (value: string) => void;
  onSubmitEditing: () => void;
  inputRef: AuthInputRef;
}) => (
  <YStack gap="$1">
    <XStack alignItems="center" gap="$1.5">
      <Ionicons name="mail-outline" size={15} color={colors.textMuted} />
      <Text fontSize={13} fontWeight="600" color="$colorMuted">
        Email address
      </Text>
    </XStack>
    <TextInput
      ref={inputRef}
      accessibilityLabel="Email address"
      autoComplete={mode === "signIn" ? "username" : "email"}
      textContentType={mode === "signIn" ? "username" : "emailAddress"}
      aria-describedby={errorMessage ? "auth-form-error" : undefined}
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
  errorMessage,
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
  errorMessage: string | null;
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
        <Text fontSize={13} fontWeight="600" color="$colorMuted">
          Password
        </Text>
      </XStack>
      {mode === "signIn" ? (
        <ShellActionButton variant="surface" size="small" widthMode="fit"
          label="Forgot yours?" onPress={onForgotPassword} />
      ) : null}
    </XStack>
    <XStack position="relative" alignItems="center">
      <TextInput
        ref={inputRef}
        accessibilityLabel="Password"
        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
        textContentType={mode === "signIn" ? "password" : "newPassword"}
        aria-describedby={errorMessage ? "auth-form-error" : undefined}
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
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        onPress={onToggleVisibility}
        style={{ position: "absolute", right: 0, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
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
  errorMessage,
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
  errorMessage: string | null;
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
        <Text fontSize={13} fontWeight="600" color="$colorMuted">
          Confirm password
        </Text>
      </XStack>
      <XStack position="relative" alignItems="center">
        <TextInput
          ref={inputRef}
          accessibilityLabel="Confirm password"
          autoComplete="new-password"
          textContentType="newPassword"
          aria-describedby={errorMessage ? "auth-form-error" : undefined}
          aria-invalid={errorMessage === "Passwords don't match."}
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
          accessibilityRole="button"
          accessibilityLabel={passwordVisible ? "Hide confirm password" : "Show confirm password"}
          onPress={onToggleVisibility}
          style={{ position: "absolute", right: 0, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
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
      <Text nativeID="auth-form-error" role="alert" accessibilityLiveRegion="polite" fontSize={14} color="$danger">
        {errorMessage}
      </Text>
    ) : null}
    {isSignUp ? (
      <Text fontSize={12} color="$colorMuted" textAlign="center">
        By creating an account, you agree to the terms of service.
      </Text>
    ) : null}
  </>
);

export const AuthCredentialsForm = ({
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
            {...(Platform.OS === "web" ? { render: "button", type: "button" } : {})}
            {...(Platform.OS === "web" ? { role: "button" as const } : { accessibilityRole: "button" as const })}
            aria-pressed={mode === "signIn"}
            active={mode === "signIn"}
            onPress={() => onModeChange("signIn")}
          >
            <Text
              fontSize={15}
              fontWeight={mode === "signIn" ? "700" : "500"}
              color={mode === "signIn" ? "$color" : "$colorMuted"}
            >
              Sign in
            </Text>
          </TabPill>
          <TabPill
            {...(Platform.OS === "web" ? { render: "button", type: "button" } : {})}
            {...(Platform.OS === "web" ? { role: "button" as const } : { accessibilityRole: "button" as const })}
            aria-pressed={mode === "signUp"}
            active={mode === "signUp"}
            onPress={() => onModeChange("signUp")}
          >
            <Text
              fontSize={15}
              fontWeight={mode === "signUp" ? "700" : "500"}
              color={mode === "signUp" ? "$color" : "$colorMuted"}
            >
              Create account
            </Text>
          </TabPill>
        </TabContainer>

        <Text fontSize={14} color={colors.primaryDark} textAlign="center" fontStyle="italic">
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
          mode={mode}
          errorMessage={errorMessage}
          value={email}
          onChange={setEmail}
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          inputRef={emailInputRef}
          colors={colors}
          inputStyle={inputStyles.input}
        />

        <PasswordField
          mode={mode}
          errorMessage={errorMessage}
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
          errorMessage={errorMessage}
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
