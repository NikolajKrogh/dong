import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Animated, Platform } from "react-native";
import { Button, XStack, YStack } from "tamagui";
import { useColors } from "../../styles/theme";
import { androidElevationFallback, hexWithAlpha } from "../../styles/shadows";
import GameActionsSheet from "./GameActionsSheet";
import type { useGoalNotifications } from "./useGoalNotifications";
import { useReducedMotion } from "../../platform/animation/useReducedMotion";
import { TaskOverlay } from "../../platform/navigation/taskNavigation";

/**
 * Props for FooterButtons.
 * @interface
 */
interface FooterButtonsProps {
  /** Invoked before navigating Home without ending participation. */
  onHome?: () => void;
  /** Invoked when user selects Back to Setup. */
  onBackToSetup: () => void;
  configurationLabel?: string;
  /** Invoked when user selects End Game. */
  onEndGame: () => void;
  onLeaveGame?: () => void;
  showLeaveGame?: boolean;
  /** Only the current multiplayer host can use this action. */
  showEndGame?: boolean;
  goalNotifications?: ReturnType<typeof useGoalNotifications>;
}

/**
 * Floating action menu providing navigation (Home, Setup) and End Game trigger.
 * @component
 * @param {FooterButtonsProps} props Component props.
 * @returns {React.ReactElement} Footer menu UI.
 * @description Renders an animated FAB that rotates when expanded and delegates action-sheet behavior to GameActionsSheet.
 */
const FooterButtons: React.FC<FooterButtonsProps> = ({
  onHome,
  onBackToSetup,
  configurationLabel = "Setup",
  onEndGame,
  onLeaveGame,
  showLeaveGame = false,
  showEndGame = true,
  goalNotifications,
}) => {
  const router = useRouter();
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const [menuVisible, setMenuVisible] = useState(false);
  const [sheetPosition, setSheetPosition] = useState(0);
  const rotationRef = useRef<Animated.Value | null>(null);
  if (rotationRef.current === null) rotationRef.current = new Animated.Value(0);
  const rotation = rotationRef.current;

  /** Toggle menu visibility with rotation animation. */
  const toggleMenu = () => {
    const nextVisible = !menuVisible;

    Animated.timing(rotation, {
      toValue: nextVisible ? 1 : 0,
      duration: reduceMotion ? 0 : 300,
      useNativeDriver: true,
    }).start();

    if (nextVisible) setSheetPosition(0);
    setMenuVisible(nextVisible);
  };

  /** Close menu and reset rotation. */
  const closeMenu = () => {
    Animated.timing(rotation, {
      toValue: 0,
      duration: reduceMotion ? 0 : 300,
      useNativeDriver: true,
    }).start();

    setMenuVisible(false);
  };

  // Interpolate rotation value for the button animation
  // The ref is intentionally read here because Animated.View needs the stable
  // native animated node on every render.
  // eslint-disable-next-line react-hooks/refs
  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const renderToggle = (inSheet: boolean, onPress = toggleMenu) => (
    <Button
      unstyled
      testID={inSheet ? "GameProgressSheetMenuButton" : "GameProgressMenuButton"}
      width={50}
      height={50}
      borderRadius={32}
      backgroundColor={colors.primary}
      justifyContent="center"
      alignItems="center"
      boxShadow={`0px 2px 3px ${hexWithAlpha(colors.black, 0.2)}`}
      style={androidElevationFallback(3)}
      pressStyle={{ opacity: 0.2 }}
      focusVisibleStyle={{ outlineColor: "$primaryFocus", outlineWidth: 2, outlineStyle: "solid", outlineOffset: 2 }}
      onPress={onPress}
      {...(Platform.OS === "web"
        ? {
            "aria-label": inSheet ? "Close game actions" : "Open game actions",
            "aria-hidden": !inSheet && menuVisible,
          }
        : {
            accessibilityRole: "button",
            accessibilityLabel: inSheet ? "Close game actions" : "Open game actions",
            accessibilityElementsHidden: !inSheet && menuVisible,
            importantForAccessibility: !inSheet && menuVisible ? "no-hide-descendants" : "auto",
          })}
      disabled={!inSheet && menuVisible}
    >
      <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
        <Ionicons name="add" size={24} color={colors.white} />
      </Animated.View>
    </Button>
  );

  return (
    <YStack position="relative">
      <TaskOverlay open={menuVisible} onClose={closeMenu} fallbackHref="/gameProgress"
        returnFocusId="GameProgressMenuButton">
        {({ open, dismiss, runAfterDismiss }) => <GameActionsSheet
          onBackToSetup={() => runAfterDismiss(onBackToSetup)}
          configurationLabel={configurationLabel}
          onEndGame={() => runAfterDismiss(onEndGame)}
          onLeaveGame={onLeaveGame ? () => runAfterDismiss(onLeaveGame) : undefined}
          showLeaveGame={showLeaveGame}
          onHome={() => runAfterDismiss(() => {
            onHome?.();
            router.dismissTo("/");
          })}
          onOpenChange={(nextOpen: boolean) => { if (!nextOpen) dismiss(); }}
          onPositionChange={setSheetPosition}
          open={open}
          position={sheetPosition}
          showEndGame={showEndGame}
          goalNotifications={goalNotifications}
          floatingToggle={renderToggle(true, dismiss)}
        />}
      </TaskOverlay>

      <XStack paddingVertical={12} paddingHorizontal={24}>
        {renderToggle(false)}
      </XStack>
    </YStack>
  );
};

export default FooterButtons;
