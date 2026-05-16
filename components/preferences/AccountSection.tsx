import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Alert } from "react-native";
import { Text, XStack, YStack, styled } from "tamagui";

import { ShellActionButton, ShellCard, ShellSection } from "../ui";
import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth,
} from "../../hooks/useAccountAuth";

const AvatarCircle = styled(YStack, {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: "$primary",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

const SignedOutAccountContent = ({
  onSignIn,
  sessionNotice,
}: {
  onSignIn: () => void;
  sessionNotice: string | null;
}) => (
  <>
    {sessionNotice ? (
      <Text color="$danger" fontSize={14}>
        {sessionNotice}
      </Text>
    ) : null}
    <Text color="$textSecondary" fontSize={14}>
      Sign in to create and manage multiplayer rooms.
    </Text>
    <ShellActionButton
      variant="surface"
      label="Sign in or create account"
      onPress={onSignIn}
    />
  </>
);

const SignedInAccountContent = ({
  avatarLetter,
  displayName,
  isSignedIn,
  onChangePassword,
  onDelete,
  onFinishSetup,
  onSignOut,
  status,
}: {
  avatarLetter: string;
  displayName: string | null;
  isSignedIn: boolean;
  onChangePassword: () => void;
  onDelete: () => void;
  onFinishSetup: () => void;
  onSignOut: () => void;
  status: string;
}) => (
  <>
    <XStack gap="$3" alignItems="center">
      <AvatarCircle>
        <Text color="$textLight" fontSize={18} fontWeight="700">
          {avatarLetter}
        </Text>
      </AvatarCircle>
      <YStack gap="$0.5" flex={1}>
        {displayName ? (
          <Text
            color="$textPrimary"
            fontSize={16}
            fontWeight="600"
            numberOfLines={1}
          >
            {displayName}
          </Text>
        ) : null}
        <Text color="$textMuted" fontSize={13}>
          Signed in
        </Text>
      </YStack>
    </XStack>

    {status === "needsDisplayName" ? (
      <ShellActionButton
        variant="surface"
        label="Finish account setup"
        onPress={onFinishSetup}
      />
    ) : null}

    <ShellActionButton
      variant="surface"
      label="Sign out"
      onPress={onSignOut}
    />

    {isSignedIn ? (
      <ShellActionButton
        variant="surface"
        label="Change password"
        onPress={onChangePassword}
      />
    ) : null}

    <Text
      fontSize={13}
      color="$danger"
      textAlign="center"
      paddingVertical="$1"
      pressStyle={{ opacity: 0.7 }}
      onPress={onDelete}
    >
      Delete account
    </Text>
  </>
);

const AccountSection = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { account, deleteAccount, sessionNotice, signOut, status } =
    useAccountAuth();
  const returnTo = normalizeAccountFlowReturnTo(pathname);

  const displayName = account?.preferredDisplayName?.trim() || null;
  const avatarLetter = displayName ? displayName[0].toUpperCase() : "?";

  const handleDeleteWithConfirm = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => { void deleteAccount(); },
        },
      ],
    );
  };

  const isSignedIn = status !== "signedOut" && status !== "loading";
  let content: React.ReactNode;

  if (status === "loading") {
    content = (
      <Text color="$textMuted" fontSize={14}>
        Loading account...
      </Text>
    );
  } else if (status === "signedOut") {
    content = (
      <SignedOutAccountContent
        sessionNotice={sessionNotice}
        onSignIn={() => {
          router.push(buildAccountAuthRoute("/auth", returnTo) as never);
        }}
      />
    );
  } else {
    content = (
      <SignedInAccountContent
        avatarLetter={avatarLetter}
        displayName={displayName}
        isSignedIn={isSignedIn}
        onChangePassword={() => {
          router.push(
            buildAccountAuthRoute("/auth/change-password", returnTo) as never,
          );
        }}
        onDelete={handleDeleteWithConfirm}
        onFinishSetup={() => {
          router.push(
            buildAccountAuthRoute("/auth/onboarding", returnTo) as never,
          );
        }}
        onSignOut={() => {
          void signOut();
        }}
        status={status}
      />
    );
  }

  return (
    <ShellSection title="Account">
      <ShellCard compact testID="AccountSection">
        <YStack gap="$3">{content}</YStack>
      </ShellCard>
    </ShellSection>
  );
};

export default AccountSection;
