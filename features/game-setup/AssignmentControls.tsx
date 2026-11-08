import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal } from "react-native";
import { Text, XStack, YStack, useTheme } from "tamagui";
import { ShellActionButton } from "../../components/ui/ShellActionButton";
import { ShellCard } from "../../components/ui/ShellCard";
import { hexWithAlpha } from "../../styles/shadows";

export function AssignmentInfoModal({ visible, message, onClose }:
  { visible: boolean; message: string; onClose: () => void }): React.JSX.Element {
  return <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
    <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$backgroundModalOverlay">
      <ShellCard margin="$5" width="85%" maxWidth={400} padding={25} borderRadius="$8" alignItems="center">
        <Text color="$colorSecondary" fontSize={14} marginBottom={15} textAlign="center">{message}</Text>
        <ShellActionButton label="Close" variant="secondary" widthMode="fit" borderRadius="$8" paddingVertical="$2.5" paddingHorizontal="$5" onPress={onClose} />
      </ShellCard>
    </YStack>
  </Modal>;
}

export function AssignmentPanel({ title, help, children, testID, compact = false }:
  { title?: string; help?: string; children: React.ReactNode; testID?: string; compact?: boolean }): React.JSX.Element {
  const theme = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  return <YStack testID={testID} marginBottom={compact ? 0 : "$6"}>
    {title ? <XStack alignItems="center" justifyContent="space-between" marginBottom="$2">
      <Text color="$color" fontSize={16} fontWeight="bold" marginTop={compact ? 0 : "$3"} marginBottom={compact ? 0 : "$2"}>{title}</Text>
      {help ? <ShellActionButton variant="text" widthMode="fit" padding={0}
        accessibilityLabel={`About ${title.toLowerCase()}`} onPress={() => setShowHelp(true)}
        icon={<Ionicons name="information-circle-outline" size={24} color={theme.primary.get()} />} /> : null}
    </XStack> : null}
    {help ? <AssignmentInfoModal visible={showHelp} message={help} onClose={() => setShowHelp(false)} /> : null}
    <ShellCard borderColor="$borderColorSubtle" marginHorizontal="$2" marginBottom={compact ? 0 : "$4"}
      width="auto" boxShadow={`0px 2px 3px ${hexWithAlpha(theme.color.val, 0.15)}`} elevation={3}>
      {children}
    </ShellCard>
  </YStack>;
}

export function AssignmentCounter({ label, description, value, min = 0, max = Infinity, disabled = false,
  onChange, testID, compact = false, subtle = false, valueContent }:
  { label: string; description?: string; value: number; min?: number; max?: number; disabled?: boolean;
    onChange: (value: number) => void; testID?: string; compact?: boolean; subtle?: boolean; valueContent?: React.ReactNode }): React.JSX.Element {
  const theme = useTheme();
  const iconColor = subtle ? theme.colorMuted.get() : theme.colorLight.get();
  const iconSize = subtle ? 16 : 20;
  return <XStack alignItems="center" justifyContent="space-between" marginBottom={compact ? 0 : "$4"}>
    {!compact ? <YStack flex={1} marginRight="$2">
      <Text color="$colorSecondary" fontSize={16} fontWeight="500">{label}</Text>
      {description ? <Text color="$colorMuted" fontSize={13} marginTop="$1">{description}</Text> : null}
    </YStack> : null}
    <XStack alignItems="center">
      <ShellActionButton variant={subtle ? "text" : "primary"} widthMode="fit" width={44} height={44} padding={0}
        borderRadius={subtle ? "$3" : 22} accessibilityLabel={`Decrease ${label.toLowerCase()}`}
        testID={testID ? `${testID}-decrement` : undefined} disabled={disabled || value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        icon={<Ionicons name="remove-outline" size={iconSize} color={iconColor} />} />
      {valueContent ?? <Text testID={testID ? `${testID}-value` : undefined}
        color="$color" fontSize={16} fontWeight="bold" marginHorizontal="$2.5">{value}</Text>}
      <ShellActionButton variant={subtle ? "text" : "primary"} widthMode="fit" width={44} height={44} padding={0}
        borderRadius={subtle ? "$3" : 22} accessibilityLabel={`Increase ${label.toLowerCase()}`}
        testID={testID ? `${testID}-increment` : undefined} disabled={disabled || value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        icon={<Ionicons name="add-outline" size={iconSize} color={iconColor} />} />
    </XStack>
  </XStack>;
}

export function AssignmentRandomizer({ value, max = 100, disabled, hasAssignments, onChange, onRandomize, testID }:
  { value: number; max?: number; disabled?: boolean; hasAssignments?: boolean; onChange: (count: number) => void; onRandomize: () => void; testID?: string }) {
  const theme = useTheme();
  return <AssignmentPanel title="Random Assignment" testID={testID}><YStack gap="$3">
    <AssignmentDefaultCount value={value} max={max} disabled={disabled} onChange={onChange}
      testID={testID ? "lobby-matches-per-player" : undefined} />
    <ShellActionButton disabled={disabled} onPress={onRandomize}
      label={hasAssignments ? "Randomize Again" : "Randomize Matches"}
      icon={<Ionicons name="shuffle" size={20} color={theme.colorLight.get()} />} />
  </YStack></AssignmentPanel>;
}

export function AssignmentDefaultCount({ value, max = 100, disabled, onChange, testID }:
  { value: number; max?: number; disabled?: boolean; onChange: (count: number) => void; testID?: string }) {
  return <XStack alignItems="center" justifyContent="space-between" gap="$2">
    <Text color="$colorSecondary" fontSize={16} fontWeight="500" flexShrink={1}>Matches per player:</Text>
    <AssignmentCounter compact label="Default matches per player" value={value} max={max} disabled={disabled}
      testID={testID} onChange={onChange} />
  </XStack>;
}
