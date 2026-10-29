import React, { useRef } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack } from "tamagui";

import AppIcon, { type AppIconName } from "../../components/ui/AppIcon";
import createStyles from "./homeStyles";
import { useColors } from "../../styles/theme";

interface StartGameSheetProps {
  visible: boolean;
  busy: boolean;
  error: string | null;
  signedIn: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onLocal: () => void;
  onHost: () => void;
  onJoin: () => void;
}

export function StartGameSheet({ visible, busy, error, signedIn, onClose, onDismiss, onLocal, onHost, onJoin }: StartGameSheetProps): React.ReactElement {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const closeButton = useRef<View>(null);
  const options: { label: string; description: string; icon: AppIconName; testID: string; onPress: () => void }[] = [
    { label: "Play on this device", description: "Everyone plays together on one device", icon: "people", testID: "home-play-local", onPress: onLocal },
    { label: busy ? "Creating Room…" : "Host a room", description: signedIn ? "Invite others to play on their phones" : "Sign in to invite others to play", icon: "git-network", testID: "home-create-room-button", onPress: onHost },
    { label: "Join a room", description: "Enter a room code", icon: "exit-outline", testID: signedIn ? "home-join-registered-button" : "home-join-room-button", onPress: onJoin },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose} onDismiss={onDismiss}
      onShow={() => closeButton.current?.focus()}>
      <View style={styles.sheetOverlay}>
        <Pressable accessible={false} tabIndex={-1} disabled={busy}
          onPress={onClose} style={styles.sheetBackdrop} />
        <YStack width="100%" maxWidth={560} maxHeight="90%" paddingHorizontal="$4"
          paddingBottom={Math.max(insets.bottom, 16)} backgroundColor="$surface"
          borderTopLeftRadius="$8" borderTopRightRadius="$8"
          testID="home-start-game-sheet"
          {...(Platform.OS === "web" ? { role: "dialog", "aria-modal": true, "aria-label": "Start New Game" } : { accessibilityViewIsModal: true })}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" style={styles.sessionTitle}>Start New Game</Text>
            <Pressable ref={closeButton} accessibilityRole="button" accessibilityLabel="Close game choices" disabled={busy}
              onPress={onClose} style={styles.sheetClose}>
              <AppIcon name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.gameChoices}>
            {options.map(option => (
              <Pressable key={option.testID} testID={option.testID} accessibilityRole="button"
                accessibilityLabel={option.label} accessibilityHint={option.description}
                accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={option.onPress}
                style={({ pressed }) => [styles.gameChoice, pressed && { opacity: 0.75 }]}>
                <AppIcon name={option.icon} size={26} color={colors.primary} />
                <View style={styles.gameChoiceCopy}>
                  <Text style={styles.gameChoiceTitle}>{option.label}</Text>
                  <Text style={styles.gameChoiceDescription}>{option.description}</Text>
                </View>
                <AppIcon name="chevron-forward" size={22} color={colors.primary} />
              </Pressable>
            ))}
            {error ? <Text accessibilityRole="alert" style={styles.createRoomError}>{error}</Text> : null}
          </ScrollView>
        </YStack>
      </View>
    </Modal>
  );
}
