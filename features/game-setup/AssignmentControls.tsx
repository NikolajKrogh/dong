import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { XStack, YStack } from "tamagui";
import { ShellActionButton } from "../../components/ui/ShellActionButton";

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
  compact = false,
  grouped = false,
}: {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  testID?: string;
  compact?: boolean;
  grouped?: boolean;
}): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const buttonStyle = [styles.counterButton, grouped && styles.groupedCounterButton];
  const iconColor = grouped ? colors.primaryDark : colors.textLight;
  return (
    <View style={compact ? { flexDirection: "row", alignItems: "center" } : styles.matchCounterContainer}>
      {!compact ? <View style={styles.assignmentCounterLabel}>
        <Text style={styles.matchCountLabel}>{label}</Text>
        {description ? (
          <Text style={styles.assignmentDescription}>{description}</Text>
        ) : null}
      </View> : null}
      <View style={[styles.counter, grouped && styles.groupedCounter]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          hitSlop={4}
          testID={testID ? `${testID}-decrement` : undefined}
          style={[buttonStyle, { opacity: disabled || value <= min ? 0.45 : 1 }]}
          disabled={disabled || value <= min}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Ionicons
            name="remove-outline"
            size={20}
            color={iconColor}
          />
        </TouchableOpacity>
        <Text
          testID={testID ? `${testID}-value` : undefined}
          style={[styles.counterValue, grouped && styles.groupedCounterValue]}
        >
          {value}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          hitSlop={4}
          testID={testID ? `${testID}-increment` : undefined}
          style={[buttonStyle, { opacity: disabled || value >= max ? 0.45 : 1 }]}
          disabled={disabled || value >= max}
          onPress={() => onChange(Math.min(max, value + 1))}
        >
          <Ionicons name="add-outline" size={20} color={iconColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function AssignmentRandomizer({ value, max = 100, disabled, hasAssignments, onChange, onRandomize, testID }:
  { value: number; max?: number; disabled?: boolean; hasAssignments?: boolean; onChange: (count: number) => void; onRandomize: () => void; testID?: string }) {
  const colors = useColors();
  return <AssignmentPanel title="Random Assignment" testID={testID}><YStack gap="$3">
    <AssignmentDefaultCount value={value} max={max} disabled={disabled} onChange={onChange}
      testID={testID ? "lobby-matches-per-player" : undefined} />
    <ShellActionButton disabled={disabled} onPress={onRandomize}
      label={hasAssignments ? "Randomize Again" : "Randomize Matches"}
      icon={<Ionicons name="shuffle" size={20} color={colors.textLight} />} />
  </YStack></AssignmentPanel>;
}

export function AssignmentDefaultCount({ value, max = 100, disabled, onChange, testID }:
  { value: number; max?: number; disabled?: boolean; onChange: (count: number) => void; testID?: string }) {
  const colors = useColors();
  return <XStack alignItems="center" justifyContent="space-between" gap="$2">
    <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "500", flexShrink: 1 }}>Matches per player:</Text>
    <AssignmentCounter compact label="Default matches per player" value={value} max={max} disabled={disabled}
      testID={testID} onChange={onChange} />
  </XStack>;
}
