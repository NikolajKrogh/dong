import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Text, XStack, YStack, useTheme } from "tamagui";

import type { GuestRoomSession } from "../../types/guestRoom";
import AppIcon from "../AppIcon";
import { ShellActionButton, ShellCard } from "../ui";
import { GuestJoinForm } from "./GuestJoinForm";
import { GuestJoinLobby } from "./GuestJoinLobby";

interface GuestJoinModalProps {
  visible: boolean;
  joinCode: string;
  guestName: string;
  session: GuestRoomSession | null;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onJoinCodeChange: (value: string) => void;
  onGuestNameChange: (value: string) => void;
  onSubmit: () => void;
  onLeaveRoom: () => void | Promise<void>;
  /** Submits the guest's complete next pick set in player-picked mode (#185). */
  onSetPicks?: (matchIds: string[]) => void | Promise<void>;
  /** True while a pick submission and its follow-up refresh are in flight. */
  isPickBusy?: boolean;
}

const createStyles = (isWideLayout: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    backdrop: {
      flex: 1,
      justifyContent: "center",
      padding: 16,
    },
    contentTouchable: {
      width: "100%",
      alignSelf: "center",
      maxWidth: isWideLayout ? 460 : 420,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
  });

export const GuestJoinModal: React.FC<GuestJoinModalProps> = ({
  visible,
  joinCode,
  guestName,
  session,
  error,
  isSubmitting,
  onClose,
  onJoinCodeChange,
  onGuestNameChange,
  onSubmit,
  onLeaveRoom,
  onSetPicks,
  isPickBusy,
}) => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1024;
  const styles = useMemo(() => createStyles(isWideLayout), [isWideLayout]);
  const submitLabel = error ? "Retry Join" : "Join Room";
  const retryMessage = error
    ? "Update the room code or guest name and try again."
    : null;
  const title = session ? "Guest Room Active" : "Join as a guest";
  const subtitle = session
    ? `Connected as ${session.grant.displayName}`
    : "Enter a room to play";
  const headerIconColor = session ? theme.success.val : theme.primary.val;
  const headerBackground = session
    ? theme.successLight.val
    : theme.primaryTransparentLight.val;
  const closeIconColor = theme.colorMuted.val;
  const backdropColor = theme.backgroundModalOverlay.val;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: backdropColor }]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={() => undefined}
              style={styles.contentTouchable}
            >
              <ShellCard
                elevated
                padding="$6"
                style={{ gap: 24, width: "100%" }}
              >
                <XStack
                  alignItems="center"
                  gap="$4"
                  justifyContent="space-between"
                >
                  <XStack alignItems="center" flex={1} gap="$4">
                    <YStack
                      alignItems="center"
                      backgroundColor={headerBackground}
                      borderRadius="$9"
                      height={48}
                      justifyContent="center"
                      width={48}
                    >
                      <AppIcon
                        color={headerIconColor}
                        name={session ? "people" : "people-outline"}
                        size={24}
                      />
                    </YStack>
                    <YStack flex={1} gap="$1">
                      <Text color="$color" fontSize={20} fontWeight="700">
                        {title}
                      </Text>
                      <Text color="$colorMuted" fontSize={14}>
                        {subtitle}
                      </Text>
                    </YStack>
                  </XStack>

                  <Pressable
                    accessibilityLabel="Close guest join modal"
                    onPress={onClose}
                  >
                    <YStack
                      alignItems="center"
                      backgroundColor="$backgroundLight"
                      borderRadius="$9"
                      height={36}
                      justifyContent="center"
                      width={36}
                    >
                      <AppIcon color={closeIconColor} name="close" size={20} />
                    </YStack>
                  </Pressable>
                </XStack>

                {session ? (
                  <YStack gap="$5">
                    <GuestJoinLobby
                      session={session}
                      onSetPicks={onSetPicks}
                      isBusy={isPickBusy}
                    />
                    <ShellActionButton
                      icon={
                        <AppIcon
                          color={theme.color.val}
                          name="close-circle-outline"
                          size={18}
                        />
                      }
                      label="Leave Guest Room"
                      onPress={() => {
                        void onLeaveRoom();
                      }}
                      variant="surface"
                    />
                  </YStack>
                ) : (
                  <GuestJoinForm
                    error={error}
                    guestName={guestName}
                    isSubmitting={isSubmitting}
                    joinCode={joinCode}
                    onGuestNameChange={onGuestNameChange}
                    onJoinCodeChange={onJoinCodeChange}
                    onSubmit={onSubmit}
                    retryMessage={retryMessage}
                    submitLabel={submitLabel}
                  />
                )}
              </ShellCard>
            </Pressable>
          </ScrollView>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
};
