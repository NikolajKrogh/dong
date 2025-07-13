import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  commonStyles,
  settingsStyles,
} from "../../app/style/userPreferencesStyles";
import { colors } from "../../app/style/palette";

/**
 * @interface OnboardingButtonProps
 * @brief Props for the OnboardingButton component.
 */
interface OnboardingButtonProps {
  /** @brief Function to call when the button is pressed. */
  onPress: () => void;
}

/**
 * @brief OnboardingButton component.
 *
 * Displays a button that, when pressed, navigates the user to the onboarding screen.
 *
 * @param {OnboardingButtonProps} props - The props for the component.
 * @returns {JSX.Element} The rendered OnboardingButton component.
 */
const OnboardingButton: React.FC<OnboardingButtonProps> = ({ onPress }) => {
  return (
    <View style={commonStyles.section}>
      <TouchableOpacity
        style={settingsStyles.onboardingButton}
        onPress={onPress}
      >
        <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
        <Text style={settingsStyles.onboardingButtonText}>View Onboarding</Text>
      </TouchableOpacity>
    </View>
  );
};

export default OnboardingButton;
