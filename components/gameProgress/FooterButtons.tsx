import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "../../app/style/theme";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Props for FooterButtons.
 * @interface
 */
interface FooterButtonsProps {
  /** Invoked when user selects Back to Setup. */
  onBackToSetup: () => void;
  /** Invoked when user selects End Game. */
  onEndGame: () => void;
}

/**
 * Floating action menu providing navigation (Home, Setup) and End Game trigger.
 * @component
 * @param {FooterButtonsProps} props Component props.
 * @returns {React.ReactElement} Footer menu UI.
 * @description Renders an animated FAB that rotates when expanded; displays a modal overlay containing actionable menu items. Delegates navigation & end-game logic to parent callbacks.
 */
const FooterButtons: React.FC<FooterButtonsProps> = ({
  onBackToSetup,
  onEndGame,
}) => {
  const router = useRouter();
  const colors = useColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [menuVisible, setMenuVisible] = useState(false);
  const rotation = useState(new Animated.Value(0))[0];

  /** Toggle expandable menu visibility with rotation animation. */
  const toggleMenu = () => {
    // Animate the button rotation
    Animated.timing(rotation, {
      toValue: menuVisible ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setMenuVisible(!menuVisible);
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
  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  /** Navigate to home then close menu. */
  const goToHome = () => {
    router.push("/");
    closeMenu();
  };

  return (
    <View style={styles.container}>
      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          {/* Menu content */}
          <View
            style={[
              styles.menuContainer,
              {
                left: SCREEN_WIDTH * 0.05,
                bottom: SCREEN_HEIGHT * 0.1,
              },
            ]}
          >
            <View style={styles.expandableMenu}>
              <TouchableOpacity style={styles.menuItem} onPress={goToHome}>
                <Ionicons
                  name="home-outline"
                  size={22}
                  color={colors.textMuted}
                />
                <Text style={styles.menuItemText}>Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onBackToSetup();
                  closeMenu();
                }}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.textMuted}
                />
                <Text style={styles.menuItemText}>Setup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onEndGame();
                  closeMenu();
                }}
              >
                <Ionicons name="flag-outline" size={22} color={colors.danger} />
                <Text style={[styles.menuItemText, { color: colors.danger }]}>
                  End Game
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Menu toggle button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.menuButton} onPress={toggleMenu}>
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <Ionicons name="add" size={24} color={colors.white} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      position: "relative",
    },
    modalOverlay: {
      flex: 1,
    },
    menuContainer: {
      position: "absolute",
    },
    expandableMenu: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 4,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 5,
      width: 160,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginVertical: 4,
    },
    menuItemText: {
      fontSize: 16,
      marginLeft: 16,
      color: colors.textMuted,
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
