import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, YStack } from "tamagui";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import { useNavigationReady } from "../../platform/navigation/useNavigationReady";
import { useGameStore } from "../../store/gameStore";
import { invokeGoalNotification, readNotificationIdentity } from "./goalNotificationClient";

const deliveryIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const subscribeHydration = useGameStore.persist.onFinishHydration;

export default function GoalNotificationScreen() {
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId?: string }>();
  const [unavailable, setUnavailable] = useState(false);
  const ready = useNavigationReady();
  const hydrated = useSyncExternalStore(subscribeHydration, useGameStore.persist.hasHydrated, () => false);

  useEffect(() => {
    if (!ready || !hydrated) return;
    let isCurrent = true;

    async function openActiveGame() {
      try {
        if (typeof deliveryId !== "string" || !deliveryIdPattern.test(deliveryId)) throw new Error("invalid_alert");
        const identity = await readNotificationIdentity();
        if (!identity) throw new Error("missing_game");
        const outcome = await invokeGoalNotification<{ status: string }>({
          operation: "resolve", deliveryId, proof: identity.proof,
        }, identity.bearer);
        const latest = await readNotificationIdentity();
        if (outcome.status !== "active" || latest?.owner !== identity.owner ||
          JSON.stringify(latest.proof) !== JSON.stringify(identity.proof)) throw new Error("unavailable");
        if (isCurrent) router.replace("/gameProgress");
      } catch {
        if (isCurrent) setUnavailable(true);
      }
    }

    void openActiveGame();
    return () => { isCurrent = false; };
  }, [deliveryId, hydrated, ready, router]);

  return (
    <ShellScreen centerContent>
      <YStack padding="$4" gap="$3">
        <Text role="status" color="$color">
          {unavailable ? "This alert’s game is no longer available." : "Opening game…"}
        </Text>
        {unavailable ? <ShellActionButton label="Back to DONG" onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/");
        }} /> : null}
      </YStack>
    </ShellScreen>
  );
}
