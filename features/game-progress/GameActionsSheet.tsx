import { Ionicons } from "@expo/vector-icons";
import React, { useLayoutEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet, Button, Text, XStack, YStack } from "tamagui";

import { useColors } from "../../styles/theme";
import { GoalNotificationSettings } from "./GoalNotificationSettings";
import type { useGoalNotifications } from "./useGoalNotifications";

interface GameActionsSheetProps {
  open: boolean;
  position: number;
  onPositionChange: (position: number) => void;
  onOpenChange: (open: boolean) => void;
  onHome: () => void;
  onBackToSetup: () => void;
  configurationLabel?: string;
  onEndGame: () => void;
  onLeaveGame?: () => void;
  showLeaveGame?: boolean;
  showEndGame: boolean;
  floatingToggle: React.ReactNode;
  goalNotifications?: ReturnType<typeof useGoalNotifications>;
}

interface ActionRowProps {
  testID: string;
  label: string;
  icon: "home-outline" | "settings-outline" | "flag-outline" | "exit-outline" | "notifications-outline";
  iconColor: string;
  accessory?: React.ReactNode;
  descriptionId?: string;
  buttonRef?: React.Ref<React.ComponentRef<typeof Button>>;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

const ActionRow: React.FC<ActionRowProps> = ({
  testID,
  label,
  icon,
  iconColor,
  accessory,
  descriptionId,
  buttonRef,
  danger = false,
  disabled = false,
  onPress,
}) => (
  <Button
    {...(Platform.OS === "web" ? { "aria-label": label, "aria-describedby": descriptionId } : { accessibilityRole: "button", accessibilityLabel: label })}
    backgroundColor={danger ? "$dangerLight" : "$backgroundLight"}
    borderRadius="$4"
    borderWidth={0}
    disabled={disabled}
    minHeight="$12"
    onPress={disabled ? undefined : onPress}
    paddingHorizontal="$4"
    pressStyle={{ opacity: 0.82 }}
    ref={buttonRef}
    testID={testID}
    unstyled
    width="100%"
  >
    <XStack alignItems="center" flex={1} gap="$4">
      <Ionicons color={iconColor} name={icon} size={24} accessible={false} aria-hidden />
      <Text
        color={danger && !disabled ? "$dangerForeground" : "$color"}
        flex={1}
        fontSize="$4"
        fontWeight="600"
      >
        {label}
      </Text>
      {accessory}
    </XStack>
  </Button>
);

type GameActionRowsProps = Pick<GameActionsSheetProps,
  "configurationLabel" | "onBackToSetup" | "onEndGame" | "onHome" | "onLeaveGame" | "showEndGame" | "showLeaveGame"
> & { notificationAction: React.ReactNode };

function GameActionRows({
  configurationLabel = "Setup",
  notificationAction,
  onBackToSetup,
  onEndGame,
  onHome,
  onLeaveGame,
  showEndGame,
  showLeaveGame,
}: GameActionRowsProps) {
  const colors = useColors();
  return (
    <>
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
        label={configurationLabel}
        onPress={onBackToSetup}
        testID="FooterSetupButton"
      />
      {notificationAction}
      {showLeaveGame && onLeaveGame ? (
        <ActionRow
          danger
          icon="exit-outline"
          iconColor={colors.dangerForeground}
          label="Leave Game"
          onPress={onLeaveGame}
          testID="FooterLeaveGameButton"
        />
      ) : null}
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
    </>
  );
}

const GameActionsSheet: React.FC<GameActionsSheetProps> = ({
  open,
  position,
  onPositionChange,
  onOpenChange,
  floatingToggle,
  goalNotifications,
  ...actionProps
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [showNotifications, setShowNotifications] = useState(false);
  const backButton = useRef<React.ComponentRef<typeof Button>>(null);
  const notificationRow = useRef<React.ComponentRef<typeof Button>>(null);
  const returnFocusToRow = useRef(false);
  const activeNotifications = showNotifications ? goalNotifications : undefined;
  const notificationsOpen = Boolean(activeNotifications);
  const notificationStatus = goalNotifications?.status === "registered" ? "Test only"
    : goalNotifications?.status === "ready" ? "Off"
    : undefined;

  useLayoutEffect(() => {
    if (Platform.OS !== "web") return;
    if (notificationsOpen) {
      backButton.current?.focus();
    } else if (returnFocusToRow.current) {
      returnFocusToRow.current = false;
      notificationRow.current?.focus();
    }
  }, [notificationsOpen]);
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
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              {notificationsOpen && (
                <Button
                  ref={backButton}
                  aria-label="Back to game actions"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="$3"
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: "solid", outlineColor: "$primaryFocus" }}
                  height={44}
                  onPress={() => {
                    returnFocusToRow.current = true;
                    setShowNotifications(false);
                  }}
                  pressStyle={{ opacity: 0.82 }}
                  unstyled
                  width={44}
                >
                  <Ionicons color={colors.primaryDark} name="arrow-back" size={24} accessible={false} aria-hidden />
                </Button>
              )}
              <Text
                color="$color"
                flexShrink={1}
                fontFamily={notificationsOpen ? "system-ui" : undefined}
                fontSize="$5"
                fontWeight="700"
                {...(Platform.OS === "web" ? { role: "heading", "aria-level": 1 } : { accessibilityRole: "header" })}
                testID="GameActionsSheetTitle"
              >
                {notificationsOpen ? "Goal notifications" : "Game actions"}
              </Text>
            </XStack>
            {activeNotifications ? (
              <GoalNotificationSettings controls={activeNotifications} />
            ) : (
              <GameActionRows
                {...actionProps}
                notificationAction={
                  goalNotifications && (
                    <ActionRow
                      accessory={
                        <XStack alignItems="center" gap="$2">
                          {notificationStatus && <Text id="game-notification-status" color="$textMuted" fontSize="$2">{notificationStatus}</Text>}
                          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} accessible={false} aria-hidden />
                        </XStack>
                      }
                      buttonRef={notificationRow}
                      descriptionId={notificationStatus ? "game-notification-status" : undefined}
                      icon="notifications-outline"
                      iconColor={colors.textMuted}
                      label="Goal notifications"
                      onPress={() => {
                        goalNotifications.openSettings();
                        setShowNotifications(true);
                      }}
                      testID="FooterGoalNotificationsButton"
                    />
                  )
                }
              />
            )}
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
};

export default GameActionsSheet;
