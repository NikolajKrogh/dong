import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

import createSetupGameStyles from "./setupGameStyles";
import { useColors } from "../../styles/theme";

export function AssignmentInfoModal({
  visible,
  message,
  onClose,
  styles,
}: {
  visible: boolean;
  message: string;
  onClose: () => void;
  styles: ReturnType<typeof createSetupGameStyles>;
}): React.JSX.Element {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalText}>{message}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.button, styles.buttonCancel]}
            onPress={onClose}
          >
            <Text style={styles.textStyle}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function AssignmentPanel({
  title,
  help,
  children,
  testID,
  compact = false,
}: {
  title?: string;
  help?: string;
  children: React.ReactNode;
  testID?: string;
  compact?: boolean;
}): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const [showHelp, setShowHelp] = useState(false);
  return (
    <View
      testID={testID}
      style={[
        styles.assignmentSection,
        compact && styles.compactAssignmentSection,
      ]}
    >
      {title ? (
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              compact && styles.compactAssignmentTitle,
            ]}
          >
            {title}
          </Text>
          {help ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`About ${title.toLowerCase()}`}
              hitSlop={10}
              onPress={() => setShowHelp(true)}
            >
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {help ? (
        <AssignmentInfoModal
          visible={showHelp}
          message={help}
          onClose={() => setShowHelp(false)}
          styles={styles}
        />
      ) : null}
      <View
        style={[
          styles.randomizeContainer,
          compact && styles.compactAssignmentSection,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function AssignmentCounter({
  label,
  description,
  value,
  min = 0,
  max = Infinity,
  disabled = false,
  onChange,
  testID,
}: {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  testID?: string;
}): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  return (
    <View style={styles.matchCounterContainer}>
      <View style={styles.assignmentCounterLabel}>
        <Text style={styles.matchCountLabel}>{label}</Text>
        {description ? (
          <Text style={styles.assignmentDescription}>{description}</Text>
        ) : null}
      </View>
      <View style={styles.counter}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          hitSlop={4}
          testID={testID ? `${testID}-decrement` : undefined}
          style={styles.counterButton}
          disabled={disabled || value <= min}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Ionicons
            name="remove-outline"
            size={20}
            color={colors.primaryLight}
          />
        </TouchableOpacity>
        <Text
          testID={testID ? `${testID}-value` : undefined}
          style={styles.counterValue}
        >
          {value}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          hitSlop={4}
          testID={testID ? `${testID}-increment` : undefined}
          style={styles.counterButton}
          disabled={disabled || value >= max}
          onPress={() => onChange(Math.min(max, value + 1))}
        >
          <Ionicons name="add-outline" size={20} color={colors.primaryLight} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
