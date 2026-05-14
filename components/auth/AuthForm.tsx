import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth as useAccountAuthState,
} from "../../hooks/useAccountAuth";
import { useColors } from "../../app/style/theme";
import { ShellActionButton, ShellCard } from "../ui";

type AuthMode = "signIn" | "signUp";

interface AuthFormProps {
  returnTo?: string | null;
}

const AuthForm = ({ returnTo }: AuthFormProps) => {
  const router = useRouter();
  const colors = useColors();
  const { account, signIn, signUp, status } = useAccountAuthState();
  const normalizedReturnTo = normalizeAccountFlowReturnTo(returnTo);
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: 16,
        },
        header: {
          gap: 8,
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
        row: {
          gap: 12,
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

  useEffect(() => {
    if (status === "ready") {
      router.replace(normalizedReturnTo ?? "/");
    }

    if (status === "needsDisplayName") {
      router.replace(
        buildAccountAuthRoute("/auth/onboarding", normalizedReturnTo) as never,
      );
    }
  }, [normalizedReturnTo, router, status]);

  const heading =
    mode === "signIn" ? "Welcome back" : "Create your account";
  const description =
    mode === "signIn"
      ? "Use your account to restore the same multiplayer identity on every device."
      : "Choose an email, password, and then finish your display name.";
  let submitLabel = mode === "signIn" ? "Sign in" : "Create account";

  if (isSubmitting) {
    submitLabel = "Please wait…";
  }
  const toggleLabel =
    mode === "signIn"
      ? "Need an account? Create one."
      : "Already have an account? Sign in.";

  const handleSubmit = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signIn") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to continue.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ShellCard elevated>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.subtitle}>{description}</Text>
        </View>

        <View style={styles.row}>
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
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {account?.preferredDisplayName ? (
          <Text style={styles.message}>
            Signed in as {account.preferredDisplayName}.
          </Text>
        ) : null}

        <ShellActionButton
          disabled={isSubmitting}
          label={submitLabel}
          onPress={() => {
            void handleSubmit();
          }}
        />

        <Pressable
          onPress={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setErrorMessage(null);
          }}
        >
          <Text style={styles.link}>{toggleLabel}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            router.push(
              buildAccountAuthRoute(
                "/auth/reset-password",
                normalizedReturnTo,
              ) as never,
            );
          }}
        >
          <Text style={styles.link}>Forgot your password?</Text>
        </Pressable>
      </View>
    </ShellCard>
  );
};

export default AuthForm;