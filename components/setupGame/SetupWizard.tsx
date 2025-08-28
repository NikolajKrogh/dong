import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

/**
 * Props for setup wizard.
 * @description Collection of render callbacks for each step, progression gating booleans, start handler and optional quick-add utility for the players step.
 * @property renderPlayersStep Renders the players entry step (add/remove players UI).
 * @property renderMatchesStep Renders the matches selection step.
 * @property renderCommonMatchStep Renders the common match selection step (shared matches across players).
 * @property renderAssignStep Renders the player-to-match assignment step.
 * @property handleStartGame Invoked when the final Start Game button is pressed (all validation passed).
 * @property canAdvanceToMatches Whether the wizard can move from Players -> Matches.
 * @property canAdvanceToCommonMatch Whether the wizard can move from Matches -> Common step.
 * @property canAdvanceToAssign Whether the wizard can move from Common -> Assign step.
 * @property canStartGame Whether the game can be started (final validation for Assign step).
 * @property newPlayerName Optional current text input value for a new player (used for auto-add before advancing).
 * @property handleAddPlayer Optional helper to append `newPlayerName` before navigating forward from Players.
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
  newPlayerName?: string;
  handleAddPlayer?: () => void;
}

/**
 * Game setup wizard.
 * @description Multi-step flow (players -> matches -> common -> assign) with progress indicator.
 * @param {SetupWizardProps} props Component props.
 * @returns {React.ReactElement} Wizard element.
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
  newPlayerName,
  handleAddPlayer,
}) => {
  // Active step index
  const [currentStep, setCurrentStep] = useState(0);
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);

  // Step meta (label + icon)
  const steps: {
    name: string;
    icon:
      | "person-add-outline"
      | "game-controller-outline"
      | "tv-outline"
      | "git-network";
  }[] = [
    { name: "Players", icon: "person-add-outline" },
    { name: "Matches", icon: "game-controller-outline" },
    { name: "Common", icon: "tv-outline" },
    { name: "Assign", icon: "git-network" },
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
                color={
                  currentStep >= index ? colors.textLight : colors.textMuted
                }
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
            onPress={() => {
              // If we're on the players step and there's a player name in the input, add it first
              if (
                currentStep === 0 &&
                newPlayerName?.trim() &&
                handleAddPlayer
              ) {
                handleAddPlayer();
                // Small delay before advancing to ensure the player is added
                setTimeout(() => {
                  setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
                }, 50);
              } else {
                // Otherwise, just advance to the next step
                setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
              }
            }}
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
