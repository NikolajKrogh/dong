import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../styles/theme";
import { AssignmentCounter } from "./AssignmentControls";
import { MatchSelectionCard } from "./MatchSelectionCard";

export function AssignmentPlayerCard({ target, defaultCount, onSetCount, usesDefault = true, disabled, ...props }:
  React.ComponentProps<typeof MatchSelectionCard> & {
    target: number; onSetCount?: (count: number | null) => void;
    usesDefault?: boolean; disabled?: boolean;
    defaultCount?: number;
  }) {
  const colors = useColors();
  const remaining = target - props.selectedCount;
  const status = remaining === 0 ? `${props.selectedCount} selected` : remaining > 0 ? `${remaining} left` : `${-remaining} too many`;
  return <MatchSelectionCard {...props} statusLabel={props.badgeLabel ? undefined : status}
    style={[{ backgroundColor: colors.surface, borderRadius: 8, padding: 16, marginBottom: 16,
      boxShadow: `0px 2px 3px ${colors.border}`, }, props.style]}
    headerAction={onSetCount ? <View>
    <AssignmentCounter compact grouped label={`${props.title}'s additional matches`} value={target} max={100}
      disabled={disabled} onChange={onSetCount} />
    {!usesDefault ? <TouchableOpacity accessibilityRole="button" disabled={disabled}
      accessibilityLabel={`Use default count for ${props.title}`} onPress={() => onSetCount(null)}>
      <Text style={{ color: colors.primaryDark, textAlign: "center", fontSize: 12, paddingVertical: 6 }}>Use default{defaultCount === undefined ? "" : ` (${defaultCount})`}</Text>
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
