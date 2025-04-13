import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import styles from "../../app/style/setupGameStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface SetupWizardProps {
  renderPlayersStep: () => React.ReactNode;
  renderMatchesStep: () => React.ReactNode;
  renderAssignStep: () => React.ReactNode;
  handleStartGame: () => void;
  canAdvanceToMatches: boolean;
  canAdvanceToAssign: boolean;
  canStartGame: boolean;
}

const SetupWizard: React.FC<SetupWizardProps> = ({
  renderPlayersStep,
  renderMatchesStep,
  renderAssignStep,
  handleStartGame,
  canAdvanceToMatches,
  canAdvanceToAssign,
  canStartGame,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = ["Players", "Matches", "Assignments"];
  const router = useRouter();

  return (
    <View style={styles.wizardContainer}>
      {/* Progress Indicator */}
      <View style={styles.stepIndicatorContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <TouchableOpacity
              style={[
                styles.stepButton,
                currentStep >= index && styles.activeStepButton,
              ]}
              onPress={() => {
                if (
                  (index === 1 && canAdvanceToMatches) ||
                  (index === 2 && canAdvanceToAssign) ||
                  index === 0
                ) {
                  setCurrentStep(index);
                }
              }}
              disabled={
                (index === 1 && !canAdvanceToMatches) ||
                (index === 2 && !canAdvanceToAssign)
              }
            >
              <Text
                style={[
                  styles.stepText,
                  currentStep >= index && styles.activeStepText,
                ]}
              >
                {step}
              </Text>
            </TouchableOpacity>

            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  currentStep > index && styles.activeStepConnector,
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
        {currentStep === 0 && renderPlayersStep()}
        {currentStep === 1 && renderMatchesStep()}
        {currentStep === 2 && renderAssignStep()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.wizardNavigation}>
        {currentStep === 0 ? (
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: "#6c757d" }]}
            onPress={() => router.push("../")}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="home"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.navButtonText}>Home</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setCurrentStep(Math.max(0, currentStep - 1))}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="arrow-back"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.navButtonText}>Back</Text>
            </View>
          </TouchableOpacity>
        )}

        {currentStep < steps.length - 1 ? (
          <TouchableOpacity
            style={[
              styles.navButton,
              ((currentStep === 0 && !canAdvanceToMatches) ||
                (currentStep === 1 && !canAdvanceToAssign)) && { opacity: 0.5 },
            ]}
            onPress={() =>
              setCurrentStep(Math.min(steps.length - 1, currentStep + 1))
            }
            disabled={
              (currentStep === 0 && !canAdvanceToMatches) ||
              (currentStep === 1 && !canAdvanceToAssign)
            }
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.navButtonText}>Next</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.navButton,
              { backgroundColor: "#28a745" },
              !canStartGame && { opacity: 0.5 },
            ]}
            onPress={handleStartGame}
            disabled={!canStartGame}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.navButtonText}>Start Game</Text>
              <Ionicons
                name="play"
                size={20}
                color="#fff"
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
