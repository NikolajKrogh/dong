import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet, Button, Text, XStack, YStack } from "tamagui";

import { useColors } from "../../styles/theme";

interface GameActionsSheetProps {
  open: boolean;
  position: number;
  onPositionChange: (position: number) => void;
  onOpenChange: (open: boolean) => void;
  onHome: () => void;
  onBackToSetup: () => void;
  onEndGame: () => void;
  showEndGame: boolean;
  floatingToggle: React.ReactNode;
}

interface ActionRowProps {
  testID: string;
  label: string;
  icon: "home-outline" | "settings-outline" | "flag-outline";
  iconColor: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

const ActionRow: React.FC<ActionRowProps> = ({
  testID,
  label,
  icon,
  iconColor,
  danger = false,
  disabled = false,
  onPress,
}) => (
  <Button
    backgroundColor={danger ? "$dangerLight" : "$backgroundLight"}
    borderRadius="$4"
    borderWidth={0}
    disabled={disabled}
    minHeight="$12"
    onPress={disabled ? undefined : onPress}
    paddingHorizontal="$4"
    pressStyle={{ opacity: 0.82 }}
    testID={testID}
    unstyled
    width="100%"
  >
    <XStack alignItems="center" flex={1} gap="$4">
      <Ionicons color={iconColor} name={icon} size={24} />
      <Text
        color={danger && !disabled ? "$dangerForeground" : "$color"}
        fontSize="$4"
        fontWeight="600"
      >
        {label}
      </Text>
    </XStack>
  </Button>
);

const GameActionsSheet: React.FC<GameActionsSheetProps> = ({
  open,
  position,
  onPositionChange,
  onOpenChange,
  onHome,
  onBackToSetup,
  onEndGame,
  showEndGame,
  floatingToggle,
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding =
    Math.max(insets.bottom, Platform.OS === "android" ? 24 : 0) + 16;

  return (
    <Sheet
      dismissOnOverlayPress
      dismissOnSnapToBottom
      modal
      onOpenChange={onOpenChange}
      onPositionChange={onPositionChange}
      open={open}
      position={position}
      snapPointsMode="fit"
    >
      <Sheet.Overlay backgroundColor={colors.backgroundModalOverlay} />
      <XStack
        justifyContent="flex-end"
        paddingHorizontal="$4"
        paddingBottom="$2"
        pointerEvents="auto"
      >
        {floatingToggle}
      </XStack>
      <Sheet.Handle />
      <Sheet.Frame
        alignItems="stretch"
        backgroundColor="$surface"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
        testID="GameActionsSheetFrame"
        width="100%"
      >
        <Sheet.ScrollView
          showsVerticalScrollIndicator={false}
          width="100%"
        >
          <YStack
            alignSelf="center"
            gap="$2"
            maxWidth={560}
            paddingBottom={bottomPadding}
            paddingHorizontal="$4"
            paddingTop="$2"
            testID="GameActionsSheetContent"
            width="100%"
          >
            <Text
              color="$color"
              fontSize="$5"
              fontWeight="700"
              marginBottom="$2"
              testID="GameActionsSheetTitle"
            >
              Game actions
            </Text>

            <ActionRow
              icon="home-outline"
              iconColor={colors.textMuted}
              label="Home"
              onPress={onHome}
              testID="FooterHomeButton"
            />
            <ActionRow
              icon="settings-outline"
              iconColor={colors.textMuted}
              label="Setup"
              onPress={onBackToSetup}
              testID="FooterSetupButton"
            />
            <ActionRow
              danger
              disabled={!showEndGame}
              icon="flag-outline"
              iconColor={showEndGame ? colors.dangerForeground : colors.textMuted}
              label="End Game"
              onPress={onEndGame}
              testID="FooterEndGameButton"
            />
            {!showEndGame ? (
              <Text
                color="$color"
                fontSize="$2"
                opacity={0.7}
                testID="GameActionsEndGameHint"
              >
                Only the host of an active, synced game can end it.
              </Text>
            ) : null}
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
};

export default GameActionsSheet;
