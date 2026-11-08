import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../styles/theme";
import { AssignmentCounter } from "./AssignmentControls";
import { MatchSelectionCard } from "./MatchSelectionCard";
import type { SelectableMatch } from "./SelectableMatchList";

export function AssignmentPlayerCard({ target, defaultCount, selectedMatches = [], onSetCount, usesDefault = true, disabled, ...props }:
  React.ComponentProps<typeof MatchSelectionCard> & {
    target: number; onSetCount?: (count: number | null) => void;
    usesDefault?: boolean; disabled?: boolean;
    defaultCount?: number; selectedMatches?: SelectableMatch[];
  }) {
  const colors = useColors();
  const remaining = target - props.selectedCount;
  const status = remaining === 0 ? `${props.selectedCount} selected` : remaining > 0 ? `${remaining} left` : `${-remaining} too many`;
  return <MatchSelectionCard {...props} flat statusLabel={props.badgeLabel ? undefined : status}
    summary={selectedMatches.map(match => `${match.homeTeam}–${match.awayTeam}`).join(" · ")}
    style={[props.style, { padding: 0, borderWidth: 0, borderRadius: 0, borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingVertical: 10, marginBottom: 0 }]}
    headerAction={onSetCount ? <View>
    <AssignmentCounter compact label={`${props.title}'s additional matches`} value={target} max={100}
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
