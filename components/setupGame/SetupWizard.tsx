import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
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
interface WizardAction {
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
  activeStepKey?: string;
  onStepChange?: (key: string) => void;
  /** Distinguish task Back from selecting a new step/history entry. */
  onStepBack?: (key: string) => void;
}

/** The wizard defers this long after onBeforeNext claims the advance. */
const DEFERRED_ADVANCE_DELAY_MS = 50;

/**
 * Multi-step setup wizard: a step indicator, a bordered content panel, and a
 * bottom navigation bar.
 * @description Presentational and step-agnostic; callers may control the stable step key. Both the solo setup flow and the multiplayer room drive it, which is
 * why nothing here knows about players, matches or routes.
 * @param {SetupWizardProps} props Component props.
 * @returns {React.ReactElement} Wizard element.
 */
const SetupWizard: React.FC<SetupWizardProps> = ({
  steps,
  firstSlotAction,
  finalAction,
  onBeforeNext,
  activeStepKey,
  onStepChange,
  onStepBack,
}) => {
  const { currentStep, setCurrentStep, handleNextPress, handleBackPress, canAdvanceFromCurrentStep } = useWizardSteps({
    steps, activeStepKey, onStepChange, onStepBack, onBeforeNext,
  });
  const { width, height } = useWindowDimensions();
  const { pageFrameRef, pageTop, viewportTop, measurePageTop, scrollsAsPage } = useWizardViewport(width, height);
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const wideLayout = isWideLayout(width);

  const lastStepIndex = Math.max(0, steps.length - 1);
  const isFirstStep = currentStep === 0;
  const isFinalStep = currentStep === lastStepIndex;
  const currentStepContent = steps[currentStep]?.content;

  const renderAction = (action: WizardAction) => (
    <WizardActionButton action={action} styles={styles} colors={colors} wideLayout={wideLayout} />
  );

  const wizard = (
    <View
      testID="SetupWizardRoot"
      style={[styles.wizardContainer, wideLayout && styles.wizardWideLayout, scrollsAsPage && { flex: 0, flexGrow: 1 }]}
    >
      <WizardStepIndicator steps={steps} currentStep={currentStep} setCurrentStep={setCurrentStep}
        styles={styles} colors={colors} wideLayout={wideLayout} />

      <View style={[styles.wizardMainPanel, scrollsAsPage && { flex: 0, flexGrow: 1 }]}>
        {/* Step Content - Now scrollable */}
        <ScrollView
          testID="SetupWizardContent"
          style={[styles.stepContentScroll, scrollsAsPage && { flexGrow: 0, flexShrink: 0, flexBasis: "auto", overflow: "visible" }]}
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
                onPress: handleBackPress,
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
  // Keep input ancestry stable when a web keyboard shrinks the viewport.
  // Only the active scroll owner changes; switching wrappers would blur/remount it.
  return Platform.OS === "web" ? (
    <View ref={pageFrameRef} onLayout={measurePageTop} style={{ flex: 1 }}>
      <ScrollView
        testID="SetupWizardPageScroll"
        style={[
          { flex: 1 },
          scrollsAsPage && {
            marginTop: Math.max(0, viewportTop - pageTop),
            maxHeight: Math.max(0, height - Math.max(0, pageTop - viewportTop)),
          },
          !scrollsAsPage && { overflow: "hidden" },
        ]}
        contentContainerStyle={scrollsAsPage ? { flexGrow: 1 } : { flex: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {wizard}
      </ScrollView>
    </View>
  ) : wizard;
};

function useWizardSteps({ steps, activeStepKey, onStepChange, onStepBack, onBeforeNext }: Pick<SetupWizardProps,
  "steps" | "activeStepKey" | "onStepChange" | "onStepBack" | "onBeforeNext">) {
  const [localStep, setLocalStep] = useState(0);
  const controlled = activeStepKey !== undefined && onStepChange !== undefined;
  const currentStep = controlled ? Math.max(0, steps.findIndex(step => step.key === activeStepKey)) : localStep;
  const pendingAdvance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ steps, currentStep, controlled, onStepChange });
  useEffect(() => { latest.current = { steps, currentStep, controlled, onStepChange }; });
  useEffect(() => () => { if (pendingAdvance.current !== null) clearTimeout(pendingAdvance.current); }, []);
  const setCurrentStep = (index: number) => {
    if (index === currentStep || !steps[index]?.canEnter) return;
    if (controlled) onStepChange(steps[index].key);
    else setLocalStep(index);
  };
  const canAdvanceFromCurrentStep = steps[currentStep + 1]?.canEnter ?? true;
  const handleNextPress = React.useCallback(() => {
    if (pendingAdvance.current !== null) return;
    const startKey = steps[currentStep]?.key;
    const advance = () => {
      pendingAdvance.current = null;
      const value = latest.current;
      if (value.steps[value.currentStep]?.key !== startKey) return;
      const nextIndex = Math.min(value.steps.length - 1, value.currentStep + 1);
      if (!value.steps[nextIndex]?.canEnter) return;
      if (value.controlled) value.onStepChange?.(value.steps[nextIndex].key);
      else setLocalStep(nextIndex);
    };
    if (onBeforeNext?.(currentStep)) {
      pendingAdvance.current = setTimeout(advance, DEFERRED_ADVANCE_DELAY_MS);
    } else if (canAdvanceFromCurrentStep) advance();
  }, [steps, currentStep, onBeforeNext, canAdvanceFromCurrentStep]);

  const handleBackPress = () => {
    const previous = Math.max(0, currentStep - 1);
    if (controlled && onStepBack) onStepBack(steps[previous].key);
    else setCurrentStep(previous);
  };
  return { currentStep, setCurrentStep, handleNextPress, handleBackPress, canAdvanceFromCurrentStep };
}

function WizardStepIndicator({ steps, currentStep, setCurrentStep, styles, colors, wideLayout }: {
  steps: WizardStep[];
  currentStep: number;
  setCurrentStep: (index: number) => void;
  styles: ReturnType<typeof createSetupGameStyles>;
  colors: ReturnType<typeof useColors>;
  wideLayout: boolean;
}): React.ReactElement {
  const lastStepIndex = Math.max(0, steps.length - 1);
  return (
      <View
        accessibilityRole="tablist"
        testID="SetupWizardSteps"
        style={[
          styles.stepIndicatorContainer,
          wideLayout && styles.stepIndicatorWide,
        ]}
      >
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityLabel={`${step.name}, step ${index + 1} of ${steps.length}`}
              accessibilityState={{ selected: currentStep === index, disabled: !step.canEnter }}
              {...(Platform.OS === "web" ? { "aria-current": currentStep === index ? "step" as const : undefined, "aria-selected": currentStep === index, "aria-disabled": !step.canEnter } : {})}
              testID={`SetupWizardStep-${step.key}`}
              style={[
                styles.stepButton,
                wideLayout && styles.stepButtonWide,
                currentStep >= index && styles.activeStepButton,
              ]}
              onPress={() => setCurrentStep(index)}
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

  );
}

function WizardActionButton({ action, styles, colors, wideLayout }: {
  action: WizardAction;
  styles: ReturnType<typeof createSetupGameStyles>;
  colors: ReturnType<typeof useColors>;
  wideLayout: boolean;
}): React.ReactElement {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: !!action.disabled }}
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
}

function useWizardViewport(width: number, height: number) {
  const pageFrameRef = useRef<View>(null);
  const [pageTop, setPageTop] = useState(0);
  const [viewportTop, setViewportTop] = useState(0);
  const measurePageTop = React.useCallback(() => {
    pageFrameRef.current?.measureInWindow((_x, y) => setPageTop(y));
  }, []);
  useEffect(() => {
    if (Platform.OS === "web") measurePageTop();
  }, [height, width, measurePageTop]);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const updateOrigin = () => setViewportTop(Math.max(0, viewport.offsetTop));
    updateOrigin();
    viewport.addEventListener("resize", updateOrigin);
    viewport.addEventListener("scroll", updateOrigin);
    return () => {
      viewport.removeEventListener("resize", updateOrigin);
      viewport.removeEventListener("scroll", updateOrigin);
    };
  }, []);
  return { pageFrameRef, pageTop, viewportTop, measurePageTop, scrollsAsPage: Platform.OS === "web" && height < 480 };
}

export default SetupWizard;
