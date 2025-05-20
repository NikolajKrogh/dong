import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import styles, { colors } from "../../app/style/setupGameStyles"; // Import colors
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

/**
 * @interface SetupWizardProps
 * @brief Props for the SetupWizard component.
 * @property {() => React.ReactNode} renderPlayersStep - Function to render the content for the players setup step.
 * @property {() => React.ReactNode} renderMatchesStep - Function to render the content for the matches setup step.
 * @property {() => React.ReactNode} renderCommonMatchStep - Function to render the content for the common match selection step.
 * @property {() => React.ReactNode} renderAssignStep - Function to render the content for the match assignment step.
 * @property {() => void} handleStartGame - Callback function to execute when the game setup is complete and the game should start.
 * @property {boolean} canAdvanceToMatches - Flag indicating if the user can proceed from the players step to the matches step.
 * @property {boolean} canAdvanceToCommonMatch - Flag indicating if the user can proceed from the matches step to the common match step.
 * @property {boolean} canAdvanceToAssign - Flag indicating if the user can proceed from the common match step to the assignment step.
 * @property {boolean} canStartGame - Flag indicating if all conditions are met to start the game.
 */
interface SetupWizardProps {
  renderPlayersStep: () => React.ReactNode;
  renderMatchesStep: () => React.ReactNode;
  renderCommonMatchStep: () => React.ReactNode;
  renderAssignStep: () => React.ReactNode;
  handleStartGame: () => void;
  canAdvanceToMatches: boolean;
  canAdvanceToCommonMatch: boolean;
  canAdvanceToAssign: boolean;
  canStartGame: boolean;
}

/**
 * @brief A multi-step wizard component for setting up a game.
 *
 * This component guides the user through several steps: adding players, selecting matches,
 * choosing a common match, and assigning matches to players. It features a progress indicator
 * and navigation buttons to move between steps or start the game.
 *
 * @param {SetupWizardProps} props - The props for the component.
 * @returns {React.ReactNode} The rendered wizard component.
 */
const SetupWizard: React.FC<SetupWizardProps> = ({
  renderPlayersStep,
  renderMatchesStep,
  renderCommonMatchStep,
  renderAssignStep,
  handleStartGame,
  canAdvanceToMatches,
  canAdvanceToCommonMatch,
  canAdvanceToAssign,
  canStartGame,
}) => {
  /**
   * @brief State hook for managing the current active step in the wizard.
   * Initializes to the first step (index 0).
   */
  const [currentStep, setCurrentStep] = useState(0);

  /**
   * @const {Array<{name: string, icon: string}>} steps
   * @brief Configuration for the wizard steps, including their names and associated icons.
   * The icon names correspond to Ionicons.
   */
  const steps: { name: string; icon: "person-add-outline" | "game-controller-outline" | "tv-outline" | "git-network" }[] = [
    { name: "Players", icon: "person-add-outline"},
    { name: "Matches", icon: "game-controller-outline"},
    { name: "Common", icon: "tv-outline"},
    { name: "Assign", icon: "git-network"},
  ];
  const router = useRouter();

  return (
    <View style={styles.wizardContainer}>
      {/* Progress Indicator */}
      <View style={styles.stepIndicatorContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={step.name}>
            <TouchableOpacity
              style={[
                styles.stepButton,
                currentStep >= index && styles.activeStepButton,
              ]}
              onPress={() => {
                // Logic to allow navigation to a step if prerequisites are met
                if (
                  (index === 1 && canAdvanceToMatches) ||
                  (index === 2 && canAdvanceToCommonMatch) ||
                  (index === 3 && canAdvanceToAssign) ||
                  index === 0 // Always allow navigation to the first step
                ) {
                  setCurrentStep(index);
                }
              }}
              disabled={
                // Disable step buttons if prerequisites are not met
                (index === 1 && !canAdvanceToMatches) ||
                (index === 2 && !canAdvanceToCommonMatch) ||
                (index === 3 && !canAdvanceToAssign)
              }
            >
              <Ionicons
                name={step.icon}
                size={24}
                color={currentStep >= index ? colors.textLight : colors.textMuted} // Icon color changes based on active/inactive state
              />
            </TouchableOpacity>

            {/* Render connector lines between steps */}
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  currentStep > index && styles.activeStepConnector, // Connector color changes if the step is passed
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Step Content - Now scrollable */}
      <ScrollView
        style={styles.stepContentScroll}
        showsVerticalScrollIndicator={true}
      >
        {/* Conditionally render the content for the current step */}
        {currentStep === 0 && renderPlayersStep()}
        {currentStep === 1 && renderMatchesStep()}
        {currentStep === 2 && renderCommonMatchStep()}
        {currentStep === 3 && renderAssignStep()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.wizardNavigation}>
        {/* Back/Home button */}
        {currentStep === 0 ? (
          // Home button on the first step
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.secondary }]}
            onPress={() => router.push("./")}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="home"
                size={20}
                color={colors.textLight}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.navButtonText}>Home</Text>
            </View>
          </TouchableOpacity>
        ) : (
          // Back button on subsequent steps
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setCurrentStep(Math.max(0, currentStep - 1))} // Go to the previous step
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.textLight}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.navButtonText}>Back</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Next/Start Game button */}
        {currentStep < steps.length - 1 ? (
          // Next button if not on the last step
          <TouchableOpacity
            style={[
              styles.navButton,
              // Apply opacity if advancement to the next step is not allowed
              ((currentStep === 0 && !canAdvanceToMatches) ||
                (currentStep === 1 && !canAdvanceToCommonMatch) ||
                (currentStep === 2 && !canAdvanceToAssign)) && { opacity: 0.5 },
            ]}
            onPress={() =>
              setCurrentStep(Math.min(steps.length - 1, currentStep + 1)) // Go to the next step
            }
            disabled={
              // Disable next button if advancement conditions are not met
              (currentStep === 0 && !canAdvanceToMatches) ||
              (currentStep === 1 && !canAdvanceToCommonMatch) ||
              (currentStep === 2 && !canAdvanceToAssign)
            }
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.navButtonText}>Next</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={colors.textLight}
                style={{ marginLeft: 8 }}
              />
            </View>
          </TouchableOpacity>
        ) : (
          // Start Game button on the last step
          <TouchableOpacity
            style={[
              styles.navButton,
              { backgroundColor: colors.success },
              !canStartGame && { opacity: 0.5 }, // Apply opacity if game cannot be started
            ]}
            onPress={handleStartGame} // Call the start game handler
            disabled={!canStartGame} // Disable if game cannot be started
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.navButtonText}>Start Game</Text>
              <Ionicons
                name="play"
                size={20}
                color={colors.textLight}
                style={{ marginLeft: 8 }}
              />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default SetupWizard;