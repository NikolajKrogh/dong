import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createUserPreferencesStyles } from "../../app/style/userPreferencesStyles";
import { useColors } from "../../app/style/theme";

/**
 * HeaderProps
 * @description Props for the Header component.
 */
interface HeaderProps {
  /** Header title text. */
  title: string;
  /** Callback when back button pressed. */
  onBack: () => void;
  /** Optional extra top padding. */
  paddingTop?: number;
}

/**
 * Header component.
 * @description Displays a surface-colored header bar with a title and back button.
 * @param {HeaderProps} props Component props.
 * @returns {JSX.Element} Header UI.
 */
const Header: React.FC<HeaderProps> = ({ title, onBack, paddingTop = 0 }) => {
  const colors = useColors();
  const { headerStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
  return (
    <View style={{ backgroundColor: colors.surface }}>
      {paddingTop ? <View style={{ height: paddingTop }} /> : null}
      <View style={headerStyles.header}>
        <TouchableOpacity onPress={onBack} style={headerStyles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={headerStyles.headerTitle}>{title}</Text>
      </View>
    </View>
  );
};

export default Header;
