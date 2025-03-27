import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FooterButtonsProps {
  onBackToSetup: () => void;
  onEndGame: () => void;
}

const FooterButtons: React.FC<FooterButtonsProps> = ({
  onBackToSetup,
  onEndGame,
}) => {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const rotation = useState(new Animated.Value(0))[0];
  
  const toggleMenu = () => {
    // Animate the button rotation
    Animated.timing(rotation, {
      toValue: menuVisible ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    setMenuVisible(!menuVisible);
  };
  
  const closeMenu = () => {
    Animated.timing(rotation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    setMenuVisible(false);
  };
  
  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });
  
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
            style={[styles.menuContainer, { left: 20, bottom: 75 }]}
          >
            <View style={styles.expandableMenu}>
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={goToHome}
              >
                <Ionicons name="home-outline" size={22} color="#555" />
                <Text style={styles.menuItemText}>Home</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => {
                  onBackToSetup();
                  closeMenu();
                }}
              >
                <Ionicons name="settings-outline" size={22} color="#555" />
                <Text style={styles.menuItemText}>Setup</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => {
                  onEndGame();
                  closeMenu();
                }}
              >
                <Ionicons name="flag-outline" size={22} color="#dc3545" />
                <Text style={[styles.menuItemText, { color: "#dc3545" }]}>
                  End Game
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* Menu toggle button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.menuButton} 
          onPress={toggleMenu}
        >
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <Ionicons name="add" size={24} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative'
  },
  modalOverlay: {
    flex: 1,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuContainer: {
    position: 'absolute',
  },
  expandableMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    width: 160,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 16,
    color: '#555',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  menuButton: {
    width: 50,
    height: 50,
    borderRadius: 32,
    backgroundColor: '#0275d8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  }
});

export default FooterButtons;


/*
const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  overlay: {
    position: "absolute",
    top: -1000,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
  },
  menuContainer: {
    position: "absolute",
    bottom: 70,
    left: 20,
    zIndex: 10,
  },
  expandableMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
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
    color: "#555",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  menuButton: {
    width: 54,
    height: 54,
    borderRadius: 32,
    backgroundColor: "#0275d8",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
*/