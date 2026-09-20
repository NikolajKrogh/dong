import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { useColors } from "../../styles/theme";
import GameActionsSheet from "./GameActionsSheet";

/**
 * Props for FooterButtons.
 * @interface
 */
interface FooterButtonsProps {
  /** Invoked before navigating Home so active multiplayer context is cleared. */
  onHome?: () => void;
  /** Invoked when user selects Back to Setup. */
  onBackToSetup: () => void;
  /** Invoked when user selects End Game. */
  onEndGame: () => void;
  /** Only the current multiplayer host can use this action. */
  showEndGame?: boolean;
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
  onEndGame,
  showEndGame = true,
}) => {
  const router = useRouter();
  const colors = useColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
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
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (nextVisible) setSheetPosition(0);
    setMenuVisible(nextVisible);
  };

  /** Close menu and reset rotation. */
  const closeMenu = () => {
    Animated.timing(rotation, {
      toValue: 0,
      duration: 300,
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

  const runAction = (action: () => void) => {
    closeMenu();
    action();
  };

  /** Navigate to home after closing the sheet. */
  const goToHome = () => {
    runAction(() => {
      onHome?.();
      router.push("/");
    });
  };

  const goToSetup = () => runAction(onBackToSetup);
  const endGame = () => runAction(onEndGame);

  const renderToggle = (inSheet: boolean) => (
    <TouchableOpacity
      testID={inSheet ? "GameProgressSheetMenuButton" : "GameProgressMenuButton"}
      style={styles.menuButton}
      onPress={toggleMenu}
      accessibilityRole="button"
      accessibilityLabel={inSheet ? "Close game actions" : "Open game actions"}
      accessibilityElementsHidden={!inSheet && menuVisible}
      importantForAccessibility={!inSheet && menuVisible ? "no-hide-descendants" : "auto"}
      disabled={!inSheet && menuVisible}
    >
      <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
        <Ionicons name="add" size={24} color={colors.white} />
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <GameActionsSheet
        onBackToSetup={goToSetup}
        onEndGame={endGame}
        onHome={goToHome}
        onOpenChange={(open: boolean) =>
          open ? setMenuVisible(true) : closeMenu()
        }
        onPositionChange={setSheetPosition}
        open={menuVisible}
        position={sheetPosition}
        showEndGame={showEndGame}
        floatingToggle={renderToggle(true)}
      />

      {/* Menu toggle button */}
      <View style={styles.footer}>
        {renderToggle(false)}
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      position: "relative",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "flex-start",
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    menuButton: {
      width: 50,
      height: 50,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
  });

export default FooterButtons;
