import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Text as TText, XStack, YStack } from "tamagui";

import OnboardingScreen from "../components/OnboardingScreen";
import AccountAvatar from "../components/preferences/AccountAvatar";
import SettingsMenuRow from "../components/preferences/SettingsMenuRow";
import SettingsPage from "../components/preferences/SettingsPage";
import { ShellActionButton, ShellCard, ShellSection } from "../components/ui";
import { buildAccountAuthRoute, useAccountAuth } from "../hooks/useAccountAuth";
import { useGameStore } from "../store/store";

type SettingsAccountContentProps = Pick<
  ReturnType<typeof useAccountAuth>,
  "account" | "status" | "sessionNotice"
>;

function SettingsAccountContent({ account, status, sessionNotice }: SettingsAccountContentProps) {
  const router = useRouter();
  const displayName = account?.username?.trim();

  if (status === "loading") {
    return <TText color="$textMuted">Loading account...</TText>;
  }
  if (status === "signedOut") {
    return (
      <>
        {sessionNotice ? <TText color="$danger">{sessionNotice}</TText> : null}
        <TText color="$textSecondary">Sign in to create and manage multiplayer rooms.</TText>
        <ShellActionButton variant="surface" label="Sign in or create account" onPress={() => router.push(buildAccountAuthRoute("/auth", "/userPreferences") as never)} />
      </>
    );
  }

  return (
    <>
      <XStack gap="$3" alignItems="center">
        <AccountAvatar letter={displayName?.[0]?.toUpperCase() ?? "?"} />
        <YStack>
          <TText color="$textPrimary" fontWeight="600" fontSize={16}>{displayName ?? "Account"}</TText>
          <TText color="$textMuted" fontSize={13}>Signed in</TText>
        </YStack>
      </XStack>
      {status === "ready" ? <SettingsMenuRow label="Profile & username" icon="person-outline" last onPress={() => router.push("/userPreferences/profile")} /> : null}
      {status === "needsUsername" ? (
        <ShellActionButton variant="surface" label="Finish account setup" onPress={() => router.push(buildAccountAuthRoute("/auth/onboarding", "/userPreferences") as never)} />
      ) : null}
    </>
  );
}

export default function UserPreferencesScreen() {
  const router = useRouter();
  const { account, signOut, sessionNotice, status } = useAccountAuth();
  const theme = useGameStore((state) => state.theme);
  const configuredLeagues = useGameStore((state) => state.configuredLeagues);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const signedIn = status !== "signedOut" && status !== "loading";

  if (showOnboarding) {
    return <OnboardingScreen onFinish={() => setShowOnboarding(false)} />;
  }

  return (
    <SettingsPage title="Settings">
      <ShellSection title="Account" marginBottom="$0">
        <ShellCard compact testID="AccountSection">
          <YStack gap="$3">
            <SettingsAccountContent account={account} status={status} sessionNotice={sessionNotice} />
          </YStack>
        </ShellCard>
      </ShellSection>

      <ShellSection title="Preferences" marginBottom="$0">
        <ShellCard compact>
          <SettingsMenuRow label="Appearance" icon="moon-outline" value={theme === "dark" ? "Dark" : "Light"} onPress={() => router.push("/userPreferences/appearance")} />
          <SettingsMenuRow label="Sound & notifications" icon="volume-high-outline" onPress={() => router.push("/userPreferences/sound")} />
          <SettingsMenuRow label="Leagues" icon="football-outline" value={`${configuredLeagues.length} leagues`} last onPress={() => router.push("/userPreferences/leagues")} />
        </ShellCard>
      </ShellSection>

      {signedIn ? <ShellActionButton variant="surface" label="Sign out" onPress={() => { void signOut(); }} /> : null}
      <ShellActionButton variant="surface" label="View onboarding" onPress={() => setShowOnboarding(true)} />
    </SettingsPage>
  );
}
