import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createUserPreferencesStyles } from "../../app/style/userPreferencesStyles";
import { useColors } from "../../app/style/theme";

/**
 * Props for onboarding button.
 * @description Provides press handler.
 */
interface OnboardingButtonProps {
  /** Called when pressed. */
  onPress: () => void;
}

/**
 * Onboarding button.
 * @description Triggers onboarding flow display when pressed.
 * @param {OnboardingButtonProps} props Component props.
 * @returns {JSX.Element} Button element.
 */
const OnboardingButton: React.FC<OnboardingButtonProps> = ({ onPress }) => {
  const colors = useColors();
  const { commonStyles, settingsStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
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
