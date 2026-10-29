import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "tamagui";
import { AuthCredentialsForm, AuthMode, AuthStatusCard, SignupVerificationPanel } from "./AuthFormViews";

import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth as useAccountAuthState,
} from ".";
import { exchangeAccountAuthCode } from "./exchangeAccountAuthCode";

interface AuthFormProps {
  returnTo?: string | null;
  confirmationCode?: string | null;
}

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
      router.dismissTo((normalizedReturnTo ?? "/") as Href);
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
        const { error } = await exchangeAccountAuthCode(
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
        <Text fontSize={14} color="$colorSecondary">
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
