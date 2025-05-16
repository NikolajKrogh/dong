import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { headerStyles } from "../../app/style/userPreferencesStyles";
import { colors } from "../../app/style/userPreferencesStyles";

/**
 * @interface HeaderProps
 * @brief Props for the Header component.
 */
interface HeaderProps {
  /** @brief The title of the header. */
  title: string;
  /** @brief Function to call when the back button is pressed. */
  onBack: () => void;
  /** @brief Optional top padding for the header. */
  paddingTop?: number;
}

/**
 * @brief Header component.
 *
 * Displays a header with a title and a back button.
 *
 * @param {HeaderProps} props - The props for the component.
 * @returns {JSX.Element} The rendered Header component.
 */
const Header: React.FC<HeaderProps> = ({ title, onBack, paddingTop = 0 }) => {
  return (
    <View
      style={[headerStyles.header, { paddingTop: Math.max(paddingTop, 8) }]}
    >
      <TouchableOpacity onPress={onBack} style={headerStyles.backButton}>
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </TouchableOpacity>
      <Text style={headerStyles.headerTitle}>{title}</Text>
    </View>
  );
};

export default Header;