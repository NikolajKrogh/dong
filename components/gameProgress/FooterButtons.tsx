import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router"; // Import usePathname
import styles from "../../app/style/gameProgressStyles";

interface FooterButtonsProps {
  onBackToSetup: () => void;
  onEndGame: () => void;
}

const FooterButtons: React.FC<FooterButtonsProps> = ({
  onBackToSetup,
  onEndGame,
}) => {
  const router = useRouter();
  const pathname = usePathname(); // Get current path
  
  const handleGoHome = () => {
    router.push("/");
  };

  const handleSetup = () => {
    // Don't navigate if we're already on the setup page
    if (pathname !== "/setupGame") {
      onBackToSetup();
    }
  };

  return (
    <View style={styles.footerContainer}>
      <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
        <Ionicons name="home-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[
          styles.setupButton,
          pathname === "/setupGame" ? styles.disabledButton : null
        ]} 
        onPress={handleSetup}
      >
        <Ionicons 
          name="settings-outline" 
          size={20} 
          color={pathname === "/setupGame" ? "#aaa" : "#fff"} 
        />
        <Text style={[
          styles.buttonText,
          pathname === "/setupGame" ? { color: "#aaa" } : null
        ]}>
          Setup
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.endButton} onPress={onEndGame}>
        <Ionicons name="flag-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>End</Text>
      </TouchableOpacity>
    </View>
  );
};

export default FooterButtons;