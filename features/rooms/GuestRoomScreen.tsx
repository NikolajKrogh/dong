import React, { useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Modal, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";

import { ShellActionButton, ShellCard, ShellScreen } from "../../components/ui";
import { GuestRoomContent } from "./GuestRoomContent";
import { roomSnapshotToActiveRoster } from "./roomSnapshotAdapter";
import { useGuestRoomSession, type UseGuestRoomSessionResult } from "./useGuestRoomSession";

type GuestRoomTab = "matches" | "room";

interface GuestRoomTabsProps {
  tab: GuestRoomTab;
  participantCount: number;
  onSelect: (tab: GuestRoomTab) => void;
}

function GuestRoomTabs({ tab, participantCount, onSelect }: GuestRoomTabsProps): React.JSX.Element {
  const buttons = useRef<Partial<Record<GuestRoomTab, HTMLButtonElement>>>({});

  function handleKeyDown(event: React.KeyboardEvent, name: GuestRoomTab): void {
    let next: GuestRoomTab;
    switch (event.key) {
      case "Home":
        next = "matches";
        break;
      case "End":
        next = "room";
        break;
      case "ArrowLeft":
      case "ArrowRight":
        next = name === "matches" ? "room" : "matches";
        break;
      default:
        return;
    }
    event.preventDefault();
    onSelect(next);
    buttons.current[next]?.focus();
  }

  function renderTab(name: GuestRoomTab, label: string): React.JSX.Element {
    const selected = tab === name;
    return (
      <ShellActionButton
        label={label}
        role="tab"
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        {...(Platform.OS === "web" ? {
          ref: (node: HTMLButtonElement | null) => {
            if (node) buttons.current[name] = node;
          },
          id: `guest-tab-${name}`,
          "aria-controls": `guest-panel-${name}`,
          tabIndex: selected ? 0 : -1,
          onKeyDown: (event: React.KeyboardEvent) => handleKeyDown(event, name),
        } : {})}
        variant={selected ? "primary" : "surface"}
        flex={1}
        widthMode="fit"
        alignSelf="stretch"
        paddingHorizontal="$2"
        onPress={() => onSelect(name)}
      />
    );
  }

  return (
    <XStack gap="$2" paddingBottom="$3" role="tablist" accessibilityRole="tablist" accessibilityLabel="Guest room sections">
      {renderTab("matches", "Matches")}
      {renderTab("room", `Room · ${participantCount} players`)}
    </XStack>
  );
}

function getGuestRoomStatusMessage({ session, status, isBusy }: UseGuestRoomSessionResult): string {
  if (isBusy) return "Saving picks…";
  if (status === "renewing") return "Renewing guest access… Room actions are paused.";
  if (status === "pending_leave") return "Departure pending. We will retry when connected.";
  if (session?.snapshot.finalOnly || session?.snapshot.state === "completed") {
    return "Final results only. Room actions are no longer available.";
  }
  if (session?.snapshot.state === "in_progress") return "The game is in progress";
  if (session) return "Waiting for the host to start";
  if (status === "refreshing") return "Loading your room…";
  return "No active guest room";
}

export function GuestRoomScreen(): React.JSX.Element {
  const guest = useGuestRoomSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = params.tab === "room" ? "room" : "matches";
  const [isLeaveConfirmationVisible, setLeaveConfirmationVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const { session, status, error, isBusy } = guest;
  const participantCount = session ? roomSnapshotToActiveRoster(session.snapshot).length : 0;
  const areRoomActionsPaused = status === "renewing" || status === "pending_leave" || leaving;
  const showRecovery = !session && !["refreshing", "renewing", "pending_leave", "ended"].includes(status);

  function selectTab(next: GuestRoomTab): void {
    router.setParams({ tab: next });
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function leave(): Promise<void> {
    setLeaving(true);
    try {
      if (await guest.leaveRoom()) setLeaveConfirmationVisible(false);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <ShellScreen padded={false} centerContent contentMaxWidth={960}>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} paddingHorizontal="$4">
          <YStack gap="$2" paddingBottom="$4">
            <XStack gap="$2" alignItems="center" justifyContent="space-between">
              <ShellActionButton label="Home" variant="text" widthMode="fit" onPress={() => router.dismissTo("/")} />
              {session ? (
                <ShellActionButton
                  label="Leave room"
                  variant="text"
                  widthMode="fit"
                  disabled={isBusy || areRoomActionsPaused}
                  onPress={() => setLeaveConfirmationVisible(true)}
                />
              ) : null}
            </XStack>
            <YStack gap="$1">
              <Text color="$color" fontSize={20} fontWeight="700" accessibilityRole="header">
                {session ? `Room ${session.snapshot.joinCode}` : "Guest room"}
              </Text>
              {session ? <Text color="$colorMuted" fontSize={14}>{session.grant.displayName} · Guest</Text> : null}
            </YStack>
          </YStack>
          {session ? <GuestRoomTabs tab={tab} participantCount={participantCount} onSelect={selectTab} /> : null}
          <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <YStack gap="$4">
              <Text color="$colorMuted" fontSize={14} accessibilityLiveRegion="polite">{getGuestRoomStatusMessage(guest)}</Text>
              {error ? <Text nativeID="guest-join-error" color="$danger" accessibilityRole="alert">{error}</Text> : null}
              {session && !areRoomActionsPaused ? (
                <YStack>
                  <GuestRoomContent session={session} tab={tab} onSetPicks={guest.setMyPicks} isBusy={isBusy} />
                </YStack>
              ) : null}
              {status === "pending_leave" ? (
                <ShellActionButton label="Retry departure" variant="surface" disabled={leaving} onPress={() => { void leave(); }} />
              ) : null}
              {showRecovery ? (
                <>
                  <Text color="$colorMuted">
                    {status === "expired"
                      ? "Your guest access expired. Ask the host for a fresh invitation."
                      : "No guest room is available on this device."}
                  </Text>
                  <ShellActionButton label="Return Home" href="/" />
                  {status === "failed" ? (
                    <ShellActionButton label="Retry connection" variant="surface" onPress={() => { void guest.refreshRoom(); }} />
                  ) : null}
                </>
              ) : null}
              {session?.snapshot.state === "in_progress" ? <ShellActionButton label="Return to game" href="/gameProgress" /> : null}
            </YStack>
          </ScrollView>
        </YStack>
        <Modal visible={isLeaveConfirmationVisible && !areRoomActionsPaused} transparent animationType="fade" onRequestClose={() => setLeaveConfirmationVisible(false)}>
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$4" backgroundColor="$backgroundModalOverlay">
            <ShellCard padding="$5" gap="$4" width="100%" maxWidth={420}>
              <Text color="$color" fontSize={20} fontWeight="700">Leave this room?</Text>
              <Text color="$colorMuted">You may need a fresh invitation to join again.</Text>
              <ShellActionButton label="Leave room" variant="danger" onPress={() => { void leave(); }} />
              <ShellActionButton label="Stay in room" variant="surface" onPress={() => setLeaveConfirmationVisible(false)} />
            </ShellCard>
          </YStack>
        </Modal>
      </SafeAreaView>
    </ShellScreen>
  );
}
