import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import createSetupGameStyles from "./setupGameStyles";
import { useColors } from "../../styles/theme";

interface MatchSelectionCardProps {
  /** Heading — a player's name in the solo flow, "Your picks" on a pick surface. */
  title: string;
  /**
   * Badge numerator and denominator.
   *
   * Both are props on purpose: the solo setup flow shows progress against the
   * **pool size**, while a player-picked surface shows it against the **per-player
   * cap**. Baking either one in would silently change the other's display
   * (specs/022-player-picked-mode/research.md R15).
   */
  selectedCount: number;
  totalCount: number;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  badgeLabel?: string;
  compact?: boolean;
  flat?: boolean;
  children?: React.ReactNode;
  headerAction?: React.ReactNode;
  /**
   * Applied to the outer container so callers keep their own layout styles.
   * Named `style` rather than `containerStyle` deliberately: callers' existing
   * tests inspect `props.style` on the node carrying `testID`, and that holds for
   * both this composite element and the host `View` it renders.
   */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  badgeTestID?: string;
}

const flatContainerStyle = { gap: 8 };
const flatHeaderStyle = {
  backgroundColor: "transparent",
  borderWidth: 0,
  padding: 0,
  marginBottom: 0,
} as const;
const headerButtonStyle = {
  flex: 1,
  minWidth: 0,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
} as const;

/**
 * A collapsible card wrapping a match-selection list, with a count badge.
 *
 * Extracted from `components/setupGame/AssignmentSection.tsx`'s per-player card
 * so the solo flow and the multiplayer pick surfaces share one shell. Collapse
 * state is owned by the caller, which lets the solo flow keep its
 * one-map-for-all-players behaviour unchanged.
 */
export function MatchSelectionCard({
  title,
  selectedCount,
  totalCount,
  collapsed,
  onToggleCollapsed,
  children,
  headerAction,
  style,
  testID,
  badgeTestID,
  badgeLabel,
  compact = false,
  flat = false,
}: MatchSelectionCardProps): React.JSX.Element {
  const colors = useColors();
  const styles = React.useMemo(() => createSetupGameStyles(colors), [colors]);
  const defaultStyle = flat ? flatContainerStyle : [styles.assignmentContainer, styles.playerContainer];
  const cardStyle = style ?? defaultStyle;
  let headerIcon: "person-outline" | "chevron-forward" | "chevron-down" =
    "person-outline";
  if (onToggleCollapsed)
    headerIcon = collapsed ? "chevron-forward" : "chevron-down";

  return (
    <View
      testID={testID}
      style={compact ? [cardStyle, styles.compactAssignmentPlayer] : cardStyle}
    >
      <View style={[styles.playerHeader, flat && flatHeaderStyle]}>
        <TouchableOpacity
          accessibilityRole={onToggleCollapsed ? "button" : undefined}
          accessibilityState={
            onToggleCollapsed ? { expanded: !collapsed } : undefined
          }
          disabled={!onToggleCollapsed}
          style={headerButtonStyle}
          onPress={onToggleCollapsed}
          activeOpacity={0.7}
        >
          <View style={styles.playerHeaderLeft}>
            {!flat ? <Ionicons
              name={headerIcon}
              size={18}
              color={colors.primary}
              style={styles.chevronIcon}
            /> : null}
            <Text style={styles.playerAssignmentName}>{title}</Text>
          </View>
          {badgeLabel ? (
            <Text testID={badgeTestID} style={styles.assignmentPendingLabel}>
              {badgeLabel}
            </Text>
          ) : (
            <View style={styles.playerBadge}>
              <Text testID={badgeTestID} style={styles.playerBadgeText}>
                {selectedCount}/{totalCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {headerAction}
      </View>
      {collapsed ? null : children}
    </View>
  );
}
