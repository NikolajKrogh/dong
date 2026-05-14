import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

import { ShellActionButton, ShellCard, ShellSection } from "../ui";
import {
  buildAccountAuthRoute,
  normalizeAccountFlowReturnTo,
  useAccountAuth,
} from "../../hooks/useAccountAuth";

const AccountSection = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { account, signOut, status } = useAccountAuth();
  const returnTo = normalizeAccountFlowReturnTo(pathname);

  const displayName = account?.preferredDisplayName?.trim() || null;
  const statusMessage = (() => {
    switch (status) {
      case "loading":
        return <Text>Loading account...</Text>;
      case "signedOut":
        return <Text>Sign in to create and manage multiplayer rooms.</Text>;
      default:
        return displayName ? (
          <Text>You are signed in as {displayName}.</Text>
        ) : (
          <Text>You are signed in.</Text>
        );
    }
  })();

  return (
    <ShellSection title="Account">
      <ShellCard compact testID="AccountSection">
        <View style={{ gap: 12 }}>
          {statusMessage}

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

          {status === "signedOut" ? (
            <ShellActionButton
              variant="surface"
              label="Sign in or create account"
              onPress={() => {
                router.push(buildAccountAuthRoute("/auth", returnTo) as never);
              }}
            />
          ) : (
            <ShellActionButton
              variant="danger"
              label="Sign out"
              onPress={() => {
                void signOut();
              }}
            />
          )}
        </View>
      </ShellCard>
    </ShellSection>
  );
};

export default AccountSection;