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

const AccountSection = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { account, deleteAccount, signOut, status } = useAccountAuth();
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

  return (
    <ShellSection title="Account">
      <ShellCard compact testID="AccountSection">
        <YStack gap="$3">
          {status === "loading" ? (
            <Text color="$textMuted" fontSize={14}>
              Loading account...
            </Text>
          ) : status === "signedOut" ? (
            <>
              <Text color="$textSecondary" fontSize={14}>
                Sign in to create and manage multiplayer rooms.
              </Text>
              <ShellActionButton
                variant="surface"
                label="Sign in or create account"
                onPress={() => {
                  router.push(buildAccountAuthRoute("/auth", returnTo) as never);
                }}
              />
            </>
          ) : (
            <>
              {/* User identity row */}
              <XStack gap="$3" alignItems="center">
                <AvatarCircle>
                  <Text
                    color="$textLight"
                    fontSize={18}
                    fontWeight="700"
                  >
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
                  onPress={() => {
                    router.push(
                      buildAccountAuthRoute("/auth/onboarding", returnTo) as never,
                    );
                  }}
                />
              ) : null}

              <ShellActionButton
                variant="surface"
                label="Sign out"
                onPress={() => { void signOut(); }}
              />

              {isSignedIn ? (
                <ShellActionButton
                  variant="surface"
                  label="Change password"
                  onPress={() => {
                    router.push(
                      buildAccountAuthRoute("/auth/change-password", returnTo) as never,
                    );
                  }}
                />
              ) : null}

              <Text
                fontSize={13}
                color="$danger"
                textAlign="center"
                paddingVertical="$1"
                pressStyle={{ opacity: 0.7 }}
                onPress={handleDeleteWithConfirm}
              >
                Delete account
              </Text>
            </>
          )}
        </YStack>
      </ShellCard>
    </ShellSection>
  );
};

export default AccountSection;
