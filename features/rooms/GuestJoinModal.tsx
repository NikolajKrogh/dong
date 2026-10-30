import React from "react";
import { Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";
import { ShellActionButton, ShellCard } from "../../components/ui";
import { GuestJoinForm } from "./GuestJoinForm";

interface GuestJoinModalProps {
  visible: boolean;
  joinCode: string;
  guestName: string;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onJoinCodeChange: (value: string) => void;
  onGuestNameChange: (value: string) => void;
  onSubmit: () => void;
}

export function GuestJoinModal(props: GuestJoinModalProps) {
  return <Modal animationType="none" transparent visible={props.visible} onRequestClose={props.onClose}>
    <YStack flex={1} backgroundColor="$backgroundModalOverlay">
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16 }} keyboardShouldPersistTaps="handled">
          <ShellCard padding="$5" width="100%" maxWidth={420} alignSelf="center" gap="$4">
            <XStack alignItems="center" justifyContent="space-between" gap="$2">
              <Text color="$color" fontSize={22} fontWeight="700" flex={1}>Join as a guest</Text>
              <ShellActionButton variant="text" widthMode="fit" label="Close" accessibilityLabel="Close guest join modal" onPress={props.onClose} />
            </XStack>
            <GuestJoinForm guestName={props.guestName} joinCode={props.joinCode} error={props.error}
              isSubmitting={props.isSubmitting} onGuestNameChange={props.onGuestNameChange}
              onJoinCodeChange={props.onJoinCodeChange} onSubmit={props.onSubmit}
              submitLabel={props.error ? "Retry Join" : "Join Room"}
              retryMessage={props.error ? "Check your invitation or try again." : null} />
          </ShellCard>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  </Modal>;
}
