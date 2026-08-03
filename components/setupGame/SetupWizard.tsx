import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { isWideLayout } from "../../styles/responsive";
import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";
import AppIcon, { AppIconName } from "../AppIcon";

/**
 * One step of the wizard.
 * @property key Stable identifier; drives the React key and the step's testID.
 * @property name Label shown beside the icon in wide layout only.
 * @property icon Indicator icon.
 * @property content The step's panel.
 * @property canEnter Whether the step may be *entered* — it gates the indicator
 *   tap and the Next button. It deliberately does not force the user off a step
 *   they are already on: a caller whose data changes underneath them (a polled
 *   room snapshot, say) would otherwise yank them backwards mid-edit.
 */
export interface WizardStep {
  key: string;
  name: string;
  icon: AppIconName;
  content: React.ReactNode;
  canEnter: boolean;
}

/** A button in the wizard's bottom navigation bar. */
export interface WizardAction {
  label: string;
  icon: AppIconName;
  /** Defaults to "trailing" — Back/Home lead with their icon, Next/Start trail. */
  iconPosition?: "leading" | "trailing";
  onPress: () => void;
  disabled?: boolean;
  backgroundColor?: string;
  testID?: string;
}

/**
 * Props for the setup wizard.
 * @property steps The steps to render, in order.
 * @property firstSlotAction The left nav button shown on the first step, where
 *   there is nothing to go back to — "Home" in the solo flow, "Leave Room" in a
 *   room. Every later step shows Back instead.
 * @property finalAction The right nav button on the last step. `null` renders a
 *   disabled placeholder so the bar keeps both slots — a viewer who cannot
 *   finish the flow (a room member waiting on the host) still needs the layout.
 * @property onBeforeNext Runs before advancing. Return true to take
 *   responsibility for the advance yourself (the wizard defers a tick and then
 *   moves on); return false or omit for the normal immediate advance.
 */
interface SetupWizardProps {
  steps: WizardStep[];
  firstSlotAction: WizardAction;
  finalAction: WizardAction | null;
  onBeforeNext?: (currentIndex: number) => boolean;
}

/** The wizard defers this long after onBeforeNext claims the advance. */
const DEFERRED_ADVANCE_DELAY_MS = 50;

/**
 * Multi-step setup wizard: a step indicator, a bordered content panel, and a
 * bottom navigation bar.
 * @description Presentational and step-agnostic — it owns only the current step
 * index. Both the solo setup flow and the multiplayer room drive it, which is
 * why nothing here knows about players, matches or routes.
 * @param {SetupWizardProps} props Component props.
 * @returns {React.ReactElement} Wizard element.
 */
const SetupWizard: React.FC<SetupWizardProps> = ({
  steps,
  firstSlotAction,
  finalAction,
  onBeforeNext,
}) => {
  // Active step index. Deliberately uncontrolled: no caller needs to drive it,
  // and lifting it invites clamping the user off the step they are editing.
  const [currentStep, setCurrentStep] = useState(0);
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const wideLayout = isWideLayout(width);

  const lastStepIndex = Math.max(0, steps.length - 1);
  const canAdvanceFromCurrentStep = steps[currentStep + 1]?.canEnter ?? true;
  const isFirstStep = currentStep === 0;
  const isFinalStep = currentStep === lastStepIndex;
  const currentStepContent = steps[currentStep]?.content ?? null;

  const advance = () => {
    setCurrentStep((step) => Math.min(lastStepIndex, step + 1));
  };

  const handleNextPress = () => {
    if (onBeforeNext?.(currentStep)) {
      // The caller committed something on our behalf (the solo flow adds a
      // pending player here). Give its state write a tick to land before the
      // next step renders against it.
      setTimeout(advance, DEFERRED_ADVANCE_DELAY_MS);
      return;
    }

    advance();
  };

  /**
   * Renders a nav-bar button. Kept local so Home/Leave, Back, Next and
   * Start/placeholder all share one shape.
   */
  const renderAction = (action: WizardAction) => (
    <TouchableOpacity
      testID={action.testID}
      style={[
        styles.navButton,
        wideLayout && styles.navButtonWide,
        action.backgroundColor
          ? { backgroundColor: action.backgroundColor }
          : null,
        action.disabled ? { opacity: 0.5 } : null,
      ]}
      onPress={action.onPress}
      disabled={action.disabled}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {action.iconPosition === "leading" ? (
          <AppIcon
            name={action.icon}
            size={20}
            color={colors.textLight}
            style={{ marginRight: 8 }}
          />
        ) : null}
        <Text style={styles.navButtonText}>{action.label}</Text>
        {action.iconPosition === "leading" ? null : (
          <AppIcon
            name={action.icon}
            size={20}
            color={colors.textLight}
            style={{ marginLeft: 8 }}
          />
        )}
      </View>
    </TouchableOpacity>
  );

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
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <TouchableOpacity
              testID={`SetupWizardStep-${step.key}`}
              style={[
                styles.stepButton,
                wideLayout && styles.stepButtonWide,
                currentStep >= index && styles.activeStepButton,
              ]}
              onPress={() => {
                if (step.canEnter) {
                  setCurrentStep(index);
                }
              }}
              disabled={!step.canEnter}
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
            {index < lastStepIndex && (
              <View
                style={[
                  styles.stepConnector,
                  wideLayout && styles.stepConnectorWide,
                  currentStep > index && styles.activeStepConnector, // Connector color changes if the step is passed
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.wizardMainPanel}>
        {/* Step Content - Now scrollable */}
        <ScrollView
          style={styles.stepContentScroll}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
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
          {isFirstStep
            ? renderAction({ iconPosition: "leading", ...firstSlotAction })
            : renderAction({
                label: "Back",
                icon: "arrow-back",
                iconPosition: "leading",
                testID: "SetupWizardBack",
                onPress: () => setCurrentStep(Math.max(0, currentStep - 1)),
              })}

          {isFinalStep
            ? renderAction(
                finalAction ?? {
                  // No final action for this viewer — a room member cannot start
                  // the game. A disabled placeholder keeps the bar's two slots.
                  label: "Waiting for host",
                  icon: "time-outline",
                  testID: "SetupWizardFinalDisabled",
                  onPress: () => {},
                  disabled: true,
                  backgroundColor: colors.secondary,
                },
              )
            : renderAction({
                label: "Next",
                icon: "arrow-forward",
                testID: "SetupWizardNext",
                onPress: handleNextPress,
                disabled: !canAdvanceFromCurrentStep,
              })}
        </View>
      </View>
    </View>
  );
};

export default SetupWizard;
