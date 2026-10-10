import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GameSession, Player } from "./historyTypes";
import { useColors } from "../../styles/theme";
import {
  formatModalDate,
  calculateTotalGoals,
  calculateTotalDrinks,
  getPlayerIdentityKey,
} from "./historyUtils";
import MatchCard from "./MatchCard";
import HistoryModalFrame from "./HistoryModalFrame";
import { ShellActionButton } from "../ui/ShellActionButton";
import type { Person } from "../../features/friends";

interface GameDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  game: GameSession | null;
  socialPeople?: Person[];
  onOpenShared?: (accountId: string) => void;
}

interface GameDetailsLayout {
  contentWidth: number;
  fontScale: number;
  isDesktop: boolean;
}

type GameDetailsColors = ReturnType<typeof useColors>;

const createGameDetailsStyles = (
  colors: GameDetailsColors,
  columns: number,
  isDesktop: boolean,
) => StyleSheet.create({
  date: {
    marginBottom: 14,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  summaryCard: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.backgroundLight,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  stat: {
    width: columns === 1 ? "100%" : columns === 4 ? "23.5%" : "48.5%",
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  statText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  sections: { flexDirection: isDesktop ? "row" : "column", gap: 18 },
  section: {
    flex: isDesktop ? 1 : undefined,
    minWidth: 0,
    marginBottom: 20,
  },
  assignments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  assignment: {
    maxWidth: "100%",
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  assignmentText: {
    color: colors.textSecondary,
    fontSize: 13,
    flexShrink: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    marginLeft: 7,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  playerCard: {
    flexDirection: columns === 1 ? "column" : "row",
    gap: 8,
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.backgroundLight,
  },
  playerInfo: {
    flex: columns === 1 ? undefined : 1,
    width: columns === 1 ? "100%" : undefined,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    marginRight: 10,
  },
  playerAvatar: {
    minWidth: 34,
    minHeight: 34,
    padding: 6,
    marginRight: 9,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  playerAvatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  playerDetails: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    marginBottom: 3,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  playerMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  drinkBadge: {
    minWidth: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  drinkCount: {
    marginLeft: 4,
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  matchCard: {
    marginBottom: 8,
  },
  empty: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    color: colors.textMuted,
    fontSize: 13,
  },
});

type GameDetailsStyles = ReturnType<typeof createGameDetailsStyles>;

const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  visible,
  onClose,
  game,
  socialPeople,
  onOpenShared,
}) => {
  const renderContent = useCallback(
    (layout: GameDetailsLayout) => game
      ? <GameDetailsContent game={game} {...layout} socialPeople={socialPeople} onOpenShared={onOpenShared} />
      : null,
    [game,socialPeople,onOpenShared],
  );

  if (!game) return null;

  return (
    <HistoryModalFrame
      visible={visible}
      onClose={onClose}
      title="Game details"
      closeLabel="Close game details"
      testID="GameDetailsModalView"
    >
      {renderContent}
    </HistoryModalFrame>
  );
};

interface GameDetailsContentProps extends GameDetailsLayout {
  game: GameSession;
  socialPeople?: Person[];
  onOpenShared?: (accountId: string) => void;
}

function GameDetailsContent({
  game,
  contentWidth,
  fontScale,
  isDesktop,
  socialPeople,
  onOpenShared,
}: GameDetailsContentProps) {
  const colors = useColors();
  let columns = 2;
  if (contentWidth < 360 || fontScale >= 1.5) columns = 1;
  else if (isDesktop) columns = 4;
  const styles = useMemo(
    () => createGameDetailsStyles(colors, columns, isDesktop),
    [colors, columns, isDesktop],
  );
  const sharedFriends = onOpenShared
    ? socialPeople?.filter((person) => person.relationship === 'friends'
      && game.players.some((player) => player.membershipType === 'registered' && player.accountId === person.account_id)) ?? []
    : [];

  return (
    <>
      <Text style={styles.date}>{formatModalDate(game.date)}</Text>
      <GameSummarySection game={game} styles={styles} colors={colors} />
      {sharedFriends.map((person) => (
        <ShellActionButton
          key={person.account_id}
          role="button"
          variant="surface"
          widthMode="fit"
          label={`You & ${person.username}`}
          onPress={() => onOpenShared?.(person.account_id)}
        />
      ))}
      <View testID="GameDetailsSections" style={styles.sections}>
        <GamePlayersSection game={game} styles={styles} colors={colors} />
        <GameMatchesSection game={game} styles={styles} colors={colors} />
      </View>
    </>
  );
}

interface GameDetailsSectionProps {
  game: GameSession;
  styles: GameDetailsStyles;
  colors: GameDetailsColors;
}

function GameSummarySection({ game, styles, colors }: GameDetailsSectionProps) {
  const summaryItems = [
    { icon: "beer", label: "Total drinks", value: calculateTotalDrinks(game.players).toFixed(1) },
    { icon: "football", label: "Total goals", value: calculateTotalGoals(game.matches) },
    { icon: "people", label: "Players", value: game.players.length },
    { icon: "trophy", label: "Matches", value: game.matches.length },
  ] as const;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryGrid}>
        {summaryItems.map((item) => (
          <StatItem
            key={item.label}
            {...item}
            styles={styles}
            color={colors.primary}
          />
        ))}
      </View>
    </View>
  );
}

function GamePlayersSection({ game, styles, colors }: GameDetailsSectionProps) {
  const sortedPlayers = useMemo(
    () => game.players
      .map((player, index) => ({ player, index }))
      .sort(({ player: left }, { player: right }) =>
        (right.drinksTaken || 0) - (left.drinksTaken || 0)),
    [game.players],
  );

  return (
    <View style={styles.section}>
      <SectionHeader title="Players" icon="people-outline" color={colors.textSecondary} styles={styles} />
      {sortedPlayers.length === 0 ? (
        <Text style={styles.empty}>No players recorded</Text>
      ) : (
        sortedPlayers.map(({ player, index }) => {
          const assignedMatches = game.matches.filter((match) =>
            game.playerAssignments?.[player.id]?.includes(match.id),
          );

          return (
            <GamePlayerCard
              key={getPlayerIdentityKey(player, game.id, index)}
              player={player}
              assignedMatches={assignedMatches}
              styles={styles}
              drinkBadgeIconColor={colors.white}
            />
          );
        })
      )}
    </View>
  );
}

interface GamePlayerCardProps {
  player: Player;
  assignedMatches: GameSession["matches"];
  styles: GameDetailsStyles;
  drinkBadgeIconColor: string;
}

function GamePlayerCard({ player, assignedMatches, styles, drinkBadgeIconColor }: GamePlayerCardProps) {
  const initial = player.name.trim().slice(0, 1).toLocaleUpperCase() || "?";

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerInfo}>
        <View style={styles.playerAvatar} accessible={false}>
          <Text style={styles.playerAvatarText}>{initial}</Text>
        </View>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{player.name}</Text>
          {player.leftAt && <Text style={styles.playerMeta}>Left early</Text>}
          <Text style={styles.playerMeta}>Final assignments</Text>
          <View style={styles.assignments}>
            {assignedMatches.length === 0 ? (
              <Text style={styles.playerMeta}>No assignments</Text>
            ) : (
              assignedMatches.map((match) => (
                <View key={match.id} style={styles.assignment}>
                  <Text style={styles.assignmentText}>
                    {match.homeTeam + " vs " + match.awayTeam}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
      <View style={styles.drinkBadge}>
        <Ionicons name="beer-outline" size={15} color={drinkBadgeIconColor} />
        <Text style={styles.drinkCount}>{player.drinksTaken || 0}</Text>
      </View>
    </View>
  );
}

function GameMatchesSection({ game, styles, colors }: GameDetailsSectionProps) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Final scores"
        icon="football-outline"
        color={colors.textSecondary}
        styles={styles}
      />
      {game.matches.length === 0 ? (
        <Text style={styles.empty}>No matches recorded</Text>
      ) : (
        game.matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            isCommon={game.commonMatchId === match.id}
            style={styles.matchCard}
          />
        ))
      )}
    </View>
  );
}

const StatItem: React.FC<{
  icon: "beer" | "football" | "people" | "trophy";
  label: string;
  value: number | string;
  color: string;
  styles: Pick<GameDetailsStyles, "stat" | "statText" | "statValue" | "statLabel">;
}> = ({ icon, label, value, color, styles }) => (
  <View style={styles.stat}>
    <Ionicons name={icon} size={20} color={color} />
    <View style={styles.statText}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
);

const SectionHeader: React.FC<{
  title: string;
  icon: "people-outline" | "football-outline";
  color: string;
  styles: Pick<GameDetailsStyles, "sectionHeader" | "sectionTitle">;
}> = ({ title, icon, color, styles }) => (
  <View style={styles.sectionHeader}>
    <Ionicons name={icon} size={19} color={color} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

export default GameDetailsModal;
