import React from "react";
import { Platform } from "react-native";
import { Button, Text, YStack, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { ShellActionButton } from "../../components/ui/ShellActionButton";
import { MAX_ASSIGNMENT_COUNT } from "../../shared/assignments/types";
import { AssignmentCounter } from "./AssignmentControls";
import { MatchSelectionCard } from "./MatchSelectionCard";

export function AssignmentPlayerCard({ target, defaultCount, onSetCount, usesDefault = true, disabled, ...props }:
  React.ComponentProps<typeof MatchSelectionCard> & {
    target: number; onSetCount?: (count: number | null) => void;
    usesDefault?: boolean; disabled?: boolean;
    defaultCount?: number;
  }) {
  const remaining = target - props.selectedCount;
  const status = remaining === 0 ? `${props.selectedCount} selected` : remaining > 0 ? `${remaining} left` : `${-remaining} too many`;
  return <MatchSelectionCard {...props} appearance="player" statusLabel={props.badgeLabel ? undefined : status}
    renderBadge={onSetCount ? badge => <YStack>
    <AssignmentCounter compact subtle valueContent={badge} label={`${props.title}'s additional matches`} value={target} max={MAX_ASSIGNMENT_COUNT}
      disabled={disabled} onChange={onSetCount} />
    {!usesDefault ? <Button unstyled alignSelf="center" disabled={disabled} paddingVertical="$1.5" paddingHorizontal={0}
      {...(Platform.OS === "web" ? { "aria-label": `Use default count for ${props.title}` } : { accessibilityLabel: `Use default count for ${props.title}` })} onPress={() => onSetCount(null)}
      pressStyle={{ opacity: 0.7 }} focusVisibleStyle={{ outlineWidth: 2, outlineColor: "$primaryFocus", outlineStyle: "solid", outlineOffset: 3 }}
      >
      <Text color="$primaryDark" textAlign="center" fontSize={12}>Use default{defaultCount === undefined ? "" : ` (${defaultCount})`}</Text>
    </Button> : null}
  </YStack> : undefined} />;
}

export function AssignmentLayoutToggle({ grid, onToggle }: { grid: boolean; onToggle: () => void }) {
  const theme = useTheme();
  return <ShellActionButton variant="text" widthMode="fit" padding={0}
    accessibilityLabel={grid ? "Switch to match list" : "Switch to match grid"} onPress={onToggle}
    icon={<Ionicons name={grid ? "list" : "grid"} size={22} color={theme.primary.get()} />} />;
}
