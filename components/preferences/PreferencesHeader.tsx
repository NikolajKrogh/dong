import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createUserPreferencesStyles } from "../../styles/userPreferencesStyles";
import { useColors } from "../../styles/theme";

/**
 * PreferencesHeaderProps
 * @description Props for the PreferencesHeader component.
 */
interface PreferencesHeaderProps {
  /** Header title text. */
  title: string;
  /** Callback when back button pressed. */
  onBack: () => void;
}

/**
 * PreferencesHeader component.
 * @description Displays a surface-colored header bar with a title and back button.
 * @param {PreferencesHeaderProps} props Component props.
 * @returns {JSX.Element} Header UI.
 */
const PreferencesHeader: React.FC<PreferencesHeaderProps> = ({ title, onBack }) => {
  const colors = useColors();
  const { headerStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
  return (
    <View style={{ backgroundColor: colors.surface }}>
      <View style={headerStyles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={headerStyles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={headerStyles.headerTitle}>{title}</Text>
      </View>
    </View>
  );
};

export default PreferencesHeader;
