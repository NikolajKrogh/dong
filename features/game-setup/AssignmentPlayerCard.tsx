import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../styles/theme";
import { AssignmentCounter } from "./AssignmentControls";
import { MatchSelectionCard } from "./MatchSelectionCard";

export function AssignmentPlayerCard({ target, onSetCount, usesDefault = true, disabled, ...props }:
  React.ComponentProps<typeof MatchSelectionCard> & {
    target: number; onSetCount?: (count: number | null) => void;
    usesDefault?: boolean; disabled?: boolean;
  }) {
  const colors = useColors();
  return <MatchSelectionCard {...props} headerAction={onSetCount ? <View>
    <AssignmentCounter compact label={`${props.title}'s additional matches`} value={target} max={100}
      disabled={disabled} onChange={onSetCount} />
    {!usesDefault ? <TouchableOpacity accessibilityRole="button" disabled={disabled}
      accessibilityLabel={`Use default count for ${props.title}`} onPress={() => onSetCount(null)}>
      <Text style={{ color: colors.primary, textAlign: "center" }}>Use default</Text>
    </TouchableOpacity> : null}
  </View> : undefined} />;
}

export function AssignmentLayoutToggle({ grid, onToggle }: { grid: boolean; onToggle: () => void }) {
  const colors = useColors();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={grid ? "Switch to match list" : "Switch to match grid"}
    onPress={onToggle} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
    <Ionicons name={grid ? "list" : "grid"} size={22} color={colors.primary} />
  </TouchableOpacity>;
}
