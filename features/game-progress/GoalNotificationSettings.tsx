import { useState } from "react";
import { Input, Label, Text, YStack } from "tamagui";
import { ShellActionButton } from "../../components/ui";
import type { useGoalNotifications } from "./useGoalNotifications";

type Controls = ReturnType<typeof useGoalNotifications>;

function AccessCode({ controls }: { controls: Controls }) {
  const [grant, setGrant] = useState("");
  return (
    <>
      {controls.status === "awaiting_device_verification" &&
        <Text color="$color">iPhone notifications are awaiting device verification.</Text>}
      <Label htmlFor="goal-notification-access-code" color="$color">Notification access code</Label>
      <Input id="goal-notification-access-code" accessibilityLabel="Notification access code"
        value={grant} onChangeText={setGrant} autoCapitalize="none" autoComplete="off" secureTextEntry maxLength={64} />
      <ShellActionButton label="Check access" variant="surface" disabled={controls.busy || !grant.trim()}
        onPress={() => controls.checkAccess(grant.trim())} />
    </>
  );
}

function BrowserControls({ controls }: { controls: Controls }) {
  const { availability, status, busy } = controls;
  if (availability.kind === "installation_required") {
    return <Text color="$color">On iPhone, use Share → Add to Home Screen. Open DONG from the new icon and sign in or rejoin your game there.</Text>;
  }
  if (availability.kind === "unsupported") {
    return <Text color="$color">Open DONG in a supported browser to set up notifications. You can keep playing here.</Text>;
  }
  switch (status) {
    case "ready":
      return <ShellActionButton label="Enable notifications" disabled={busy} onPress={controls.enable} />;
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
    case "repair_required":
    case "registration_unavailable":
      return <RegisteredControls controls={controls} />;
    default:
      return <AccessCode controls={controls} />;
  }
}

function RegisteredControls({ controls }: { controls: Controls }) {
  const { status, busy } = controls;
  return (
    <>
      {status === "registered" && (
        <>
          <Text color="$color">Browser registered for test alerts.</Text>
          <ShellActionButton label="Send test notification" variant="surface" disabled={busy} onPress={controls.sendTest} />
        </>
      )}
      {status === "repair_required" && <Text color="$color">This browser’s subscription needs repair. Your registration is saved.</Text>}
      {status === "registration_unavailable" && <Text color="$color">Could not check notification registration. You can still turn it off.</Text>}
      <ShellActionButton label="Turn off notifications" variant="surface" disabled={busy} onPress={controls.disable} />
    </>
  );
}

export function GoalNotificationSettings({ controls }: { controls: Controls }) {
  if (controls.availability.kind === "native") return null;
  return (
    <YStack gap="$2" padding="$3" testID="GoalNotificationSettings">
      <Text color="$color" fontWeight="700">Goal notifications</Text>
      <BrowserControls controls={controls} />
      <Text color="$color" role="status" aria-live="polite">{controls.message}</Text>
    </YStack>
  );
}
