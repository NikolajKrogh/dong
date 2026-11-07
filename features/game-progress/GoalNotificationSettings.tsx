import { Ionicons } from "@expo/vector-icons";
import { Button, Switch, Text, XStack, YStack } from "tamagui";
import { ShellActionButton } from "../../components/ui";
import { useColors } from "../../styles/theme";
import type { useGoalNotifications } from "./useGoalNotifications";

type Controls = ReturnType<typeof useGoalNotifications>;

function BrowserControls({ controls }: { controls: Controls }) {
  const { availability, status, busy } = controls;
  const colors = useColors();
  if (availability.kind === "installation_required") {
    return <Text color="$color">On iPhone, use Share → Add to Home Screen. Open DONG from the new icon and sign in or rejoin your game there.</Text>;
  }
  if (availability.kind === "unsupported") {
    return <Text color="$color">Open DONG in a supported browser to set up notifications. You can keep playing here.</Text>;
  }
  switch (status) {
    case "ready":
      return (
        <>
          <XStack alignItems="center" gap="$3" marginBottom="$2">
            <YStack alignItems="center" backgroundColor="$primaryLight" borderRadius="$4" justifyContent="center" width={44} height={44}>
              <Ionicons color={colors.primaryDark} name="notifications-outline" size={24} accessible={false} aria-hidden />
            </YStack>
            <Text color="$color" flex={1} fontSize="$4">Get goal alerts even when DONG is closed.</Text>
          </XStack>
          <ShellActionButton label="Enable notifications" disabled={busy} onPress={controls.enable} />
        </>
      );
    case "denied":
      return <Text color="$color">Notifications are blocked. Allow notifications for DONG in your browser settings, then return here.</Text>;
    case "pending_stop":
      return (
        <>
          <Text color="$color">Notification stop pending.</Text>
          <ShellActionButton label="Retry notification stop" variant="surface" disabled={busy} onPress={controls.disable} />
        </>
      );
    case "registered":
      return <RegisteredControls controls={controls} />;
    case "repair_required":
    case "registration_unavailable":
      return (
        <>
          <Text color="$color">{status === "repair_required"
            ? "This browser’s subscription needs repair. Your registration is saved."
            : "Could not check notification registration. You can still turn it off."}</Text>
          {status === "repair_required" ? <ShellActionButton label="Repair notifications"
            disabled={busy} onPress={controls.repair} /> : null}
          <ShellActionButton label="Turn off notifications" variant="surface" disabled={busy} onPress={controls.disable} />
        </>
      );
    case "checking":
      return <Text color="$colorMuted" role="status">Checking notification availability…</Text>;
    case "unavailable":
      return <Text color="$colorMuted">Notifications are unavailable right now.</Text>;
  }
}

const matchChoices = [
  { scope: "assigned_and_common", label: "My matches", icon: "person-outline" },
  { scope: "all_room_matches", label: "All matches", icon: "football-outline" },
] as const;

function MatchesToFollow({ controls }: { controls: Controls }) {
  const colors = useColors();
  const scope = controls.binding?.scope;
  if (!scope) return null;
  return (
    <YStack gap="$2">
      <Text color="$color" fontSize="$4" fontWeight="700" fontFamily="system-ui">Matches to follow</Text>
      <XStack role="group" aria-label="Matches to follow" backgroundColor="$backgroundLight"
        borderColor="$borderColor" borderWidth={1} borderRadius={999} padding="$1">
        {matchChoices.map(choice => {
          const selected = scope === choice.scope;
          return (
            <Button key={choice.scope} unstyled flex={1} minWidth={0} minHeight={44} paddingHorizontal="$1"
              justifyContent="center" alignItems="center" gap="$1" flexDirection="row" borderRadius={999}
              backgroundColor={selected ? "$primaryLight" : "$surface"}
              aria-pressed={selected} aria-label={choice.label} disabled={controls.busy}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: "solid", outlineColor: "$primaryFocus" }}
              onPress={() => controls.changeScope(choice.scope)}>
              <Ionicons name={choice.icon} size={18} color={selected ? colors.primaryDark : colors.textMuted} aria-hidden />
              <Text color={selected ? "$primaryDark" : "$colorMuted"} flexShrink={1} fontSize="$3" fontWeight="600"
                fontFamily="system-ui">{choice.label}</Text>
            </Button>
          );
        })}
      </XStack>
      <Text color="$colorMuted" fontSize="$3" fontFamily="system-ui">
        {scope === "all_room_matches"
          ? "All eligible matches in this game."
          : controls.commonPreference ? "Your assigned matches and the common match." : "Your assigned matches."}
      </Text>
    </YStack>
  );
}

function RegisteredControls({ controls }: { controls: Controls }) {
  const colors = useColors();
  const { busy, disable } = controls;
  const label = "Alerts for this game";
  const enabled = controls.binding?.liveEnabled === true && !controls.needsBinding;
  return (
    <>
      <XStack alignItems="center" gap="$3" minHeight={48} paddingBottom="$2" borderBottomWidth={1} borderBottomColor="$borderColor">
        <Ionicons color={colors.primaryDark} name="notifications-outline" size={22} accessible={false} aria-hidden />
        <Text color="$color" flex={1} fontFamily="system-ui" fontSize="$4">{label}</Text>
        <Switch
          aria-label={label}
          checked={enabled}
          disabled={busy}
          size="$10"
          padding={0}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: "solid", outlineColor: "$primaryFocus" }}
          opacity={busy ? 0.55 : 1}
          borderWidth={2}
          borderColor="$primary"
          activeStyle={{ backgroundColor: "$primary" }}
          onCheckedChange={value => value ? controls.bindCurrentGame() : disable()}
        >
          <Switch.Thumb backgroundColor="$textLight" size="$8" />
        </Switch>
      </XStack>
      {controls.binding?.liveEnabled ? <MatchesToFollow controls={controls} /> : null}
      {controls.needsBinding ? <ShellActionButton label="Enable alerts for this game" variant="surface"
        onPress={controls.bindCurrentGame} disabled={busy} /> : null}
    </>
  );
}

export function GoalNotificationSettings({ controls }: { controls: Controls }) {
  return (
    <YStack gap="$2" testID="GoalNotificationSettings">
      <BrowserControls controls={controls} />
      <Text color="$color" role="status" aria-live="polite">{controls.message}</Text>
    </YStack>
  );
}
