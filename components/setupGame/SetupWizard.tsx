import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { isWideLayout } from "../../app/style/responsive";
import createSetupGameStyles from "../../app/style/setupGameStyles";
import { useColors } from "../../app/style/theme";
import AppIcon, { AppIconName } from "../AppIcon";

const STEP_DEFINITIONS: { name: string; icon: AppIconName }[] = [
  { name: "Players", icon: "add-circle" },
  { name: "Matches", icon: "game-controller-outline" },
  { name: "Common", icon: "tv-outline" },
  { name: "Assign", icon: "git-network" },
];

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
  playersStep: React.ReactNode;
  matchesStep: React.ReactNode;
  commonMatchStep: React.ReactNode;
  assignStep: React.ReactNode;
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
  playersStep,
  matchesStep,
  commonMatchStep,
  assignStep,
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
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const wideLayout = isWideLayout(width);
  const router = useRouter();

  const stepAvailability = [
    true,
    canAdvanceToMatches,
    canAdvanceToCommonMatch,
    canAdvanceToAssign,
  ];
  const stepPanels = [playersStep, matchesStep, commonMatchStep, assignStep];
  const canAdvanceFromCurrentStep = stepAvailability[currentStep + 1] ?? true;
  const isFirstStep = currentStep === 0;
  const isFinalStep = currentStep === STEP_DEFINITIONS.length - 1;
  const currentStepContent = stepPanels[currentStep] ?? null;

  const handleNextPress = () => {
    if (currentStep === 0 && newPlayerName?.trim() && handleAddPlayer) {
      handleAddPlayer();
      setTimeout(() => {
        setCurrentStep(Math.min(STEP_DEFINITIONS.length - 1, currentStep + 1));
      }, 50);
      return;
    }

    setCurrentStep(Math.min(STEP_DEFINITIONS.length - 1, currentStep + 1));
  };

  return (
    <View
      testID="SetupWizardRoot"
      style={[styles.wizardContainer, wideLayout && styles.wizardWideLayout]}
    >
      {/* Progress Indicator */}
      <View
        testID="SetupWizardSteps"
        style={[
          styles.stepIndicatorContainer,
          wideLayout && styles.stepIndicatorWide,
        ]}
      >
        {STEP_DEFINITIONS.map((step, index) => {
          const canNavigateToStep = stepAvailability[index] ?? false;

          return (
            <React.Fragment key={step.name}>
              <TouchableOpacity
                style={[
                  styles.stepButton,
                  wideLayout && styles.stepButtonWide,
                  currentStep >= index && styles.activeStepButton,
                ]}
                onPress={() => {
                  if (canNavigateToStep) {
                    setCurrentStep(index);
                  }
                }}
                disabled={!canNavigateToStep}
              >
                <AppIcon
                  name={step.icon}
                  size={24}
                  color={
                    currentStep >= index ? colors.textLight : colors.textMuted
                  }
                />
                {wideLayout ? (
                  <Text
                    style={[
                      styles.stepButtonLabel,
                      currentStep >= index && styles.stepButtonLabelActive,
                    ]}
                  >
                    {step.name}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* Render connector lines between steps */}
              {index < STEP_DEFINITIONS.length - 1 && (
                <View
                  style={[
                    styles.stepConnector,
                    wideLayout && styles.stepConnectorWide,
                    currentStep > index && styles.activeStepConnector, // Connector color changes if the step is passed
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.wizardMainPanel}>
        {/* Step Content - Now scrollable */}
        <ScrollView
          style={styles.stepContentScroll}
          showsVerticalScrollIndicator={true}
        >
          {currentStepContent}
        </ScrollView>

        {/* Navigation Buttons */}
        <View
          testID="SetupWizardNavigation"
          style={[
            styles.wizardNavigation,
            wideLayout && styles.wizardNavigationWide,
          ]}
        >
          {/* Back/Home button */}
          {isFirstStep ? (
            // Home button on the first step
            <TouchableOpacity
              style={[
                styles.navButton,
                wideLayout && styles.navButtonWide,
                { backgroundColor: colors.secondary },
              ]}
              onPress={() => router.push("./")}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <AppIcon
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
              style={[styles.navButton, wideLayout && styles.navButtonWide]}
              onPress={() => setCurrentStep(Math.max(0, currentStep - 1))} // Go to the previous step
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <AppIcon
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
          {isFinalStep ? (
            // Start Game button on the last step
            <TouchableOpacity
              style={[
                styles.navButton,
                wideLayout && styles.navButtonWide,
                { backgroundColor: colors.success },
                !canStartGame && { opacity: 0.5 }, // Apply opacity if game cannot be started
              ]}
              onPress={handleStartGame} // Call the start game handler
              disabled={!canStartGame} // Disable if game cannot be started
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.navButtonText}>Start Game</Text>
                <AppIcon
                  name="play"
                  size={20}
                  color={colors.textLight}
                  style={{ marginLeft: 8 }}
                />
              </View>
            </TouchableOpacity>
          ) : (
            // Next button if not on the last step
            <TouchableOpacity
              style={[
                styles.navButton,
                wideLayout && styles.navButtonWide,
                !canAdvanceFromCurrentStep && {
                  opacity: 0.5,
                },
              ]}
              onPress={handleNextPress}
              disabled={!canAdvanceFromCurrentStep}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.navButtonText}>Next</Text>
                <AppIcon
                  name="arrow-forward"
                  size={20}
                  color={colors.textLight}
                  style={{ marginLeft: 8 }}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default SetupWizard;
