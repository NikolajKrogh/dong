import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createUserPreferencesStyles } from "../../app/style/userPreferencesStyles";
import { useColors } from "../../app/style/theme";
import { ShellSection } from "../ui";

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
  const { settingsStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors]
  );
  return (
    <ShellSection marginBottom={0}>
      <TouchableOpacity
        style={settingsStyles.onboardingButton}
        onPress={onPress}
      >
        <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
        <Text style={settingsStyles.onboardingButtonText}>View Onboarding</Text>
      </TouchableOpacity>
    </ShellSection>
  );
};

export default OnboardingButton;
