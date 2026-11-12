import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import { Button, Text, XStack, YStack, useTheme } from "tamagui";
import { ShellCard } from "../../components/ui/ShellCard";
import { hexWithAlpha } from "../../styles/shadows";

interface MatchSelectionCardProps {
  title: string;
  selectedCount: number;
  totalCount: number;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  badgeLabel?: string;
  statusLabel?: string;
  summary?: string;
  compact?: boolean;
  flat?: boolean;
  appearance?: "default" | "player";
  children?: React.ReactNode;
  headerAction?: React.ReactNode;
  renderBadge?: (badge: React.ReactNode) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  badgeTestID?: string;
}

/** Shared disclosure and count badge; callers own selections and expansion. */
export function MatchSelectionCard({ title, selectedCount, totalCount, collapsed, onToggleCollapsed,
  children, headerAction, renderBadge, style, testID, badgeTestID, badgeLabel, statusLabel, summary,
  compact = false, flat = false, appearance = "default" }: MatchSelectionCardProps): React.JSX.Element {
  const theme = useTheme();
  const shadow = appearance === "player" ? `0px 2px 3px ${theme.borderColor.get()}` :
    `0px 1px 2px ${hexWithAlpha(theme.color.val, 0.15)}`;
  const cardLayout = getCardLayout(flat, compact, appearance, shadow);
  return <ShellCard testID={testID} style={style} width="auto" {...cardLayout}>
    <MatchSelectionCardHeader
      title={title}
      selectedCount={selectedCount}
      totalCount={totalCount}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      badgeLabel={badgeLabel}
      statusLabel={statusLabel}
      badgeTestID={badgeTestID}
      headerAction={headerAction}
      renderBadge={renderBadge}
      flat={flat}
      theme={theme}
    />
    {collapsed && summary ? <Text numberOfLines={1} color="$colorMuted" fontSize={13} marginTop="$1" marginLeft={26}>{summary}</Text> : null}
    {collapsed ? null : children}
  </ShellCard>;
}

function getCardLayout(flat: boolean, compact: boolean, appearance: "default" | "player", shadow: string) {
  return {
    backgroundColor: flat ? "transparent" : "$surface",
    borderWidth: flat || appearance === "player" ? 0 : 1,
    padding: flat ? 0 : "$4",
    paddingBottom: flat ? 0 : appearance === "player" ? "$4" : "$2",
    gap: flat ? "$2" : 0,
    marginTop: flat || compact ? 0 : "$3",
    marginBottom: compact ? "$2" : flat ? 0 : "$4",
    boxShadow: flat ? "none" : shadow,
    elevation: flat ? 0 : 2,
  } as const;
}

type MatchSelectionCardHeaderProps = Pick<MatchSelectionCardProps,
  "title" | "selectedCount" | "totalCount" | "collapsed" | "onToggleCollapsed" | "badgeLabel" | "statusLabel" |
  "badgeTestID" | "headerAction" | "renderBadge" | "flat"> & { theme: ReturnType<typeof useTheme> };

function MatchSelectionCardHeader({ title, selectedCount, totalCount, collapsed, onToggleCollapsed, badgeLabel,
  statusLabel, badgeTestID, headerAction, renderBadge, flat, theme }: MatchSelectionCardHeaderProps): React.JSX.Element {
  const headerIcon = onToggleCollapsed ? collapsed ? "chevron-forward" : "chevron-down" : "person-outline";
  const badge = badgeLabel ? <Text testID={badgeTestID} color="$colorMuted" fontSize={13}>{badgeLabel}</Text> :
    <XStack backgroundColor="$primary" paddingHorizontal="$2" paddingVertical={3} borderRadius="$5">
      <Text testID={badgeTestID} {...(Platform.OS === "web" ? { "aria-label": statusLabel, "aria-live": "polite" as const } : { accessibilityLabel: statusLabel, accessibilityLiveRegion: "polite" as const })}
        color="$colorLight" fontSize={12} fontWeight="bold">{selectedCount}/{totalCount}</Text>
    </XStack>;
  return <XStack gap="$2" alignItems="center" justifyContent="space-between" paddingVertical={flat ? 0 : "$2.5"}
      paddingHorizontal={flat ? 0 : "$3"} backgroundColor={flat ? "transparent" : "$backgroundLight"}
      borderRadius={flat ? 0 : "$3"} marginBottom={flat ? 0 : "$2"} borderWidth={flat ? 0 : 1} borderColor="$borderColorLight">
      <Button unstyled flex={1} minWidth={0} flexDirection="row" alignItems="center" justifyContent="space-between"
        padding={0} borderWidth={0} backgroundColor="transparent" cursor={onToggleCollapsed ? "pointer" : "default"}
        {...(Platform.OS === "web" ? { "aria-expanded": onToggleCollapsed ? !collapsed : undefined, "aria-label": `${title}, ${selectedCount} of ${totalCount} matches` } : {
          accessibilityRole: "button" as const, accessibilityLabel: `${title}, ${selectedCount} of ${totalCount} matches`,
          accessibilityState: { expanded: onToggleCollapsed ? !collapsed : undefined, disabled: !onToggleCollapsed },
        })}
        disabled={!onToggleCollapsed} onPress={onToggleCollapsed} pressStyle={{ opacity: 0.7 }}
        focusVisibleStyle={{ outlineWidth: 2, outlineColor: "$primaryFocus", outlineStyle: "solid", outlineOffset: 3 }}>
        <XStack flex={1} minWidth={0} marginRight="$2" alignItems="center">
          {!flat || onToggleCollapsed ? <YStack marginRight="$2"><Ionicons name={headerIcon} size={18} color={theme.primary.get()} /></YStack> : null}
          <Text flex={1} minWidth={0} textAlign="left" numberOfLines={2} color="$color" fontSize={16} fontWeight="500">{title}</Text>
        </XStack>
        {renderBadge ? null : badge}
      </Button>
      {renderBadge?.(badge)}
      {headerAction}
    </XStack>;
}
