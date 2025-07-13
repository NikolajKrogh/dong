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
import { colors } from "../../app/style/palette";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * @brief Interface defining the properties for the FooterButtons component.
 */
interface FooterButtonsProps {
  /** @brief Callback function executed when the "Back to Setup" action is triggered. */
  onBackToSetup: () => void;
  /** @brief Callback function executed when the "End Game" action is triggered. */
  onEndGame: () => void;
}

/**
 * @brief A component providing footer buttons for game progress actions.
 * - Includes a floating action button that expands into a menu with options like "Home", "Setup", and "End Game".
 * @param {FooterButtonsProps} props - The properties passed to the component.
 * @param {() => void} props.onBackToSetup - Function to call when the Setup button is pressed.
 * @param {() => void} props.onEndGame - Function to call when the End Game button is pressed.
 * @returns {React.ReactElement} The rendered footer buttons component.
 */
const FooterButtons: React.FC<FooterButtonsProps> = ({
  onBackToSetup,
  onEndGame,
}) => {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const rotation = useState(new Animated.Value(0))[0];

  /**
   * @brief Toggles the visibility of the expandable menu.
   * - Animates the rotation of the menu button.
   */
  const toggleMenu = () => {
    // Animate the button rotation
    Animated.timing(rotation, {
      toValue: menuVisible ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setMenuVisible(!menuVisible);
  };

  /**
   * @brief Closes the expandable menu.
   * - Animates the rotation of the menu button back to its original state.
   */
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

  /**
   * @brief Navigates the user to the home screen.
   * - Closes the menu after navigation.
   */
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

const styles = StyleSheet.create({
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
