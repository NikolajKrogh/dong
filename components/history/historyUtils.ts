import {
  GameSession,
  Match,
  Player,
  PlayerStat,
  HeadToHeadStats,
} from "./historyTypes";
import { getHistoryTimestamp } from "../../features/history/historyDate";

export type PlayerStatsSession = Pick<GameSession, "id" | "date" | "players">;

/**
 * Calculate total goals (home + away) across matches.
 * @description Sums home and away goals for every match in the array; undefined goals are treated as 0.
 * @param {Match[]} matches Array of match objects.
 * @returns {number} Total goals across all matches.
 */
export const calculateTotalGoals = (matches: Match[]): number => {
  return matches.reduce(
    (sum, match) => sum + ((match.homeGoals || 0) + (match.awayGoals || 0)),
    0
  );
};

/**
 * Calculate total drinks consumed by players.
 * @description Aggregates drinksTaken for each player, treating undefined as 0.
 * @param {Player[]} players Array of player objects.
 * @returns {number} Total drinks consumed.
 */
export const calculateTotalDrinks = (players: Player[]): number => {
  return players.reduce((sum, player) => sum + (player.drinksTaken || 0), 0);
};

/**
 * Find top drinkers.
 * @description Returns player(s) with the highest drinksTaken value; empty array if list empty.
 * @param {Player[]} players Player collection.
 * @returns {Player[]} Array of players with most drinks (multiple if tied).
 */
export const findTopDrinker = (players: Player[]): Player[] => {
  if (players.length === 0) return [];
  
  const sortedPlayers = [...players].sort(
    (a, b) => (b.drinksTaken || 0) - (a.drinksTaken || 0)
  );
  
  const highestDrinks = sortedPlayers[0].drinksTaken || 0;
  
  return sortedPlayers.filter(
    player => (player.drinksTaken || 0) === highestDrinks
  );
};

const isIdentityTopDrinker = (
  game: GameSession,
  identityKey: string,
): boolean => {
  const highestDrinks = Math.max(
    ...game.players.map((player) => player.drinksTaken ?? 0),
  );
  return game.players.some(
    (player, position) =>
      getPlayerIdentityKey(player, game.id, position) === identityKey &&
      (player.drinksTaken ?? 0) === highestDrinks,
  );
};

/**
 * Format date for list item.
 * @description Produces a short month/day/year localized date string for history lists.
 * @param {string} dateString ISO date string.
 * @returns {string} Localized short date string.
 */
export const formatHistoryDate = (dateString: string): string => {
  const timestamp = getHistoryTimestamp(dateString);
  if (timestamp === null) return "Completion date unknown";

  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format date for modal title.
 * @description Full verbose date with weekday and time for detailed modal display.
 * @param {string} dateString ISO date string.
 * @returns {string} Localized verbose date/time string.
 */
export const formatModalDate = (dateString: string): string => {
  const timestamp = getHistoryTimestamp(dateString);
  if (timestamp === null) return "Completion date unknown";

  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Returns the canonical key used to group a participant in history.
 * Registered cloud participants are grouped by account. Guests and local
 * players are scoped to a session so a reused display name or participant id
 * cannot join unrelated people.
 */
export const getPlayerIdentityKey = (
  player: Player,
  sessionId: string,
  position: number,
): string => {
  const accountId = player.accountId?.trim();
  if (player.membershipType === "registered" && accountId) {
    return JSON.stringify(["account", accountId]);
  }

  const participantId = player.id?.trim();
  if (participantId) {
    return JSON.stringify(["session", sessionId, "participant", participantId]);
  }

  return JSON.stringify(["session", sessionId, "position", position]);
};

/** Resolves a player from one game using the same key as lifetime stats. */
export const findPlayerByIdentityKey = (
  game: Pick<GameSession, "id" | "players">,
  identityKey: string,
): Player | undefined =>
  game.players.find(
    (player, position) =>
      getPlayerIdentityKey(player, game.id, position) === identityKey,
  );

type NameCandidate = {
  name: string;
  date: string;
  timestamp: number | null;
  sessionId: string;
  participantId: string;
  position: number;
};

type IdentityAggregate = {
  identityKey: string;
  name: string;
  totalDrinks: number;
  gamesPlayed: number;
  isRegisteredAccount: boolean;
  latestName: NameCandidate;
  context: {
    sessionId: string;
    date: string;
    isGuest: boolean;
    position: number;
    participantId: string;
  };
};

const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const getDateTimestamp = (date: string): number | null => {
  if (!date) return null;
  const timestamp = new Date(date).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const shouldPreferNameCandidate = (
  candidate: NameCandidate,
  current: NameCandidate,
): boolean => {
  if (candidate.timestamp !== current.timestamp) {
    if (candidate.timestamp === null) return false;
    if (current.timestamp === null) return true;
    return candidate.timestamp > current.timestamp;
  }

  // Equal or unknown dates use stable data fields, independent of input order.
  const sessionOrder = compareStrings(candidate.sessionId, current.sessionId);
  if (sessionOrder !== 0) return sessionOrder < 0;

  const participantOrder = compareStrings(
    candidate.participantId,
    current.participantId,
  );
  if (participantOrder !== 0) return participantOrder < 0;
  if (candidate.position !== current.position) {
    return candidate.position < current.position;
  }
  return compareStrings(candidate.name, current.name) < 0;
};

const normalizePlayerName = (name: string): string =>
  name.trim().normalize("NFKC").toLowerCase();

const formatContextDate = (date: string): string => {
  return formatHistoryDate(date);
};

/**
 * Calculate lifetime player stats.
 * @description Aggregates registered cloud players by account and all other players by session identity.
 * @param {GameSession[]} history Game session history.
 * @returns {PlayerStat[]} Array of lifetime player stats sorted by totalDrinks desc.
 */
export const calculateLifetimePlayerStats = (
  history: readonly PlayerStatsSession[],
): PlayerStat[] => {
  if (history.length === 0) return [];

  const playerMap = new Map<string, IdentityAggregate>();

  history.forEach((game) => {
    game.players.forEach((player, position) => {
      const identityKey = getPlayerIdentityKey(player, game.id, position);
      const nameCandidate: NameCandidate = {
        name: player.name.trim() || "Player",
        date: game.date,
        timestamp: getDateTimestamp(game.date),
        sessionId: game.id,
        participantId: player.id,
        position,
      };
      const current = playerMap.get(identityKey);

      if (current) {
        current.totalDrinks += player.drinksTaken ?? 0;
        current.gamesPlayed += 1;
        if (shouldPreferNameCandidate(nameCandidate, current.latestName)) {
          current.latestName = nameCandidate;
          current.name = nameCandidate.name;
        }
      } else {
        playerMap.set(identityKey, {
          identityKey,
          name: nameCandidate.name,
          totalDrinks: player.drinksTaken ?? 0,
          gamesPlayed: 1,
          isRegisteredAccount:
            player.membershipType === "registered" &&
            Boolean(player.accountId?.trim()),
          latestName: nameCandidate,
          context: {
            sessionId: game.id,
            date: game.date,
            isGuest: player.membershipType === "guest",
            position,
            participantId: player.id,
          },
        });
      }
    });
  });

  const aggregates = Array.from(playerMap.values());
  const nameCounts = new Map<string, number>();
  aggregates.forEach((aggregate) => {
    const normalizedName = normalizePlayerName(aggregate.name);
    nameCounts.set(normalizedName, (nameCounts.get(normalizedName) ?? 0) + 1);
  });

  const duplicateGroups = new Map<string, IdentityAggregate[]>();
  aggregates.forEach((aggregate) => {
    const normalizedName = normalizePlayerName(aggregate.name);
    if ((nameCounts.get(normalizedName) ?? 0) < 2) return;
    const group = duplicateGroups.get(normalizedName) ?? [];
    group.push(aggregate);
    duplicateGroups.set(normalizedName, group);
  });

  const contextLabels = new Map<string, string>();
  duplicateGroups.forEach((group) => {
    group.sort((left, right) =>
      compareStrings(left.identityKey, right.identityKey),
    );
    const registeredAccounts = group.filter(
      (aggregate) => aggregate.isRegisteredAccount,
    );
    const scopedParticipants = group.filter(
      (aggregate) => !aggregate.isRegisteredAccount,
    );

    group.forEach((aggregate) => {
      if (aggregate.isRegisteredAccount) {
        const accountIndex = registeredAccounts.findIndex(
          (candidate) => candidate.identityKey === aggregate.identityKey,
        );
        contextLabels.set(
          aggregate.identityKey,
          `Account ${accountIndex + 1} · ${formatContextDate(aggregate.latestName.date)}`,
        );
        return;
      }

      const scopedIndex = scopedParticipants.findIndex(
        (candidate) => candidate.identityKey === aggregate.identityKey,
      );
      const sameSessionCount = scopedParticipants.filter(
        (candidate) => candidate.context.sessionId === aggregate.context.sessionId,
      ).length;
      const participantSuffix =
        sameSessionCount > 1
          ? ` · Player ${aggregate.context.position + 1}`
          : "";
      const sourceLabel = aggregate.context.isGuest ? "Guest" : "Local game";
      contextLabels.set(
        aggregate.identityKey,
        `${sourceLabel} · ${formatContextDate(aggregate.context.date)} · Game ${scopedIndex + 1}${participantSuffix}`,
      );
    });
  });

  const statsArray: PlayerStat[] = aggregates.map((aggregate) => ({
    identityKey: aggregate.identityKey,
    name: aggregate.name,
    contextLabel: contextLabels.get(aggregate.identityKey) ?? null,
    totalDrinks: aggregate.totalDrinks,
    gamesPlayed: aggregate.gamesPlayed,
    averagePerGame:
      aggregate.gamesPlayed > 0
        ? aggregate.totalDrinks / aggregate.gamesPlayed
        : 0,
  }));

  statsArray.sort(
    (a, b) =>
      b.totalDrinks - a.totalDrinks ||
      compareStrings(a.name, b.name) ||
      compareStrings(a.identityKey, b.identityKey),
  );
  return statsArray;
};

/**
 * Get head-to-head stats.
 * @description Produces comparative metrics between two players including wins, efficiencies, maxima, and timeline trends.
 * @param {GameSession[]} history Game session history.
 * @param {Pick<PlayerStat, "identityKey" | "name">} player1 First player's identity and display name.
 * @param {Pick<PlayerStat, "identityKey" | "name">} player2 Second player's identity and display name.
 * @returns {HeadToHeadStats} Aggregated comparison object.
 */
export const getPlayerHeadToHeadStats = (
  history: readonly GameSession[],
  player1: Pick<PlayerStat, "identityKey" | "name">,
  player2: Pick<PlayerStat, "identityKey" | "name">,
): HeadToHeadStats => {
  // Initialize the stats object with default values
  const stats: HeadToHeadStats = {
    player1: {
      name: player1.name,
      gamesPlayed: 0,
      totalDrinks: 0,
      averagePerGame: 0,
    },
    player2: {
      name: player2.name,
      gamesPlayed: 0,
      totalDrinks: 0,
      averagePerGame: 0,
    },
    gamesPlayedTogether: 0,
    player1WinsCount: 0,
    player2WinsCount: 0,
    tiedGamesCount: 0,
    player1MaxInAGame: 0,
    player2MaxInAGame: 0,
    player1CommonMatchCount: 0,
    player2CommonMatchCount: 0,
    player1Efficiency: 0,
    player2Efficiency: 0,
    player1TopDrinkerCount: 0,
    player2TopDrinkerCount: 0,
    player1AvgWithPlayer2: 0,
    player1AvgWithoutPlayer2: 0,
    player2AvgWithPlayer1: 0,
    player2AvgWithoutPlayer1: 0,
    timelineData: [],
  };

  // Games where each player participated
  const player1Games = history.flatMap((game) => {
    const found = findPlayerByIdentityKey(game, player1.identityKey);
    return found ? [{ game, player: found }] : [];
  });
  const player2Games = history.flatMap((game) => {
    const found = findPlayerByIdentityKey(game, player2.identityKey);
    return found ? [{ game, player: found }] : [];
  });
  const gamesPlayedTogether = history.flatMap((game) => {
    const player1InGame = findPlayerByIdentityKey(game, player1.identityKey);
    const player2InGame = findPlayerByIdentityKey(game, player2.identityKey);
    return player1InGame && player2InGame
      ? [{ game, player1: player1InGame, player2: player2InGame }]
      : [];
  });

  // Basic stats
  stats.player1.gamesPlayed = player1Games.length;
  stats.player2.gamesPlayed = player2Games.length;
  stats.gamesPlayedTogether = gamesPlayedTogether.length;

  // Calculate total drinks
  stats.player1.totalDrinks = player1Games.reduce(
    (total, occurrence) => total + (occurrence.player.drinksTaken ?? 0),
    0,
  );
  stats.player2.totalDrinks = player2Games.reduce(
    (total, occurrence) => total + (occurrence.player.drinksTaken ?? 0),
    0,
  );

  stats.player1MaxInAGame = player1Games.reduce(
    (max, occurrence) =>
      Math.max(max, occurrence.player.drinksTaken ?? 0),
    0,
  );
  stats.player2MaxInAGame = player2Games.reduce(
    (max, occurrence) =>
      Math.max(max, occurrence.player.drinksTaken ?? 0),
    0,
  );

  // Calculate averages
  stats.player1.averagePerGame =
    stats.player1.gamesPlayed > 0
      ? stats.player1.totalDrinks / stats.player1.gamesPlayed
      : 0;

  stats.player2.averagePerGame =
    stats.player2.gamesPlayed > 0
      ? stats.player2.totalDrinks / stats.player2.gamesPlayed
      : 0;

  // Head-to-head analysis in games played together
  gamesPlayedTogether.forEach(({ game, player1: player1InGame, player2: player2InGame }) => {
    const player1Drinks = player1InGame.drinksTaken ?? 0;
    const player2Drinks = player2InGame.drinksTaken ?? 0;

    // Track who drank more in each game
    if (player1Drinks > player2Drinks) {
      stats.player1WinsCount++;
    } else if (player2Drinks > player1Drinks) {
      stats.player2WinsCount++;
    } else {
      stats.tiedGamesCount++;
    }

    // Add timeline data for trend visualization
    stats.timelineData.push({
      date: game.date,
      player1Drinks: player1Drinks,
      player2Drinks: player2Drinks,
    });
  });

  // Sort timeline data by date
  stats.timelineData.sort((left, right) => {
    const leftTimestamp = getDateTimestamp(left.date);
    const rightTimestamp = getDateTimestamp(right.date);
    if (leftTimestamp === null && rightTimestamp === null) return 0;
    if (leftTimestamp === null) return 1;
    if (rightTimestamp === null) return -1;
    return leftTimestamp - rightTimestamp;
  });

  // Common match participation
  player1Games.forEach(({ game }) => {
    if (game.matches.some((m) => m.id === game.commonMatchId)) {
      stats.player1CommonMatchCount++;
    }
  });

  player2Games.forEach(({ game }) => {
    if (game.matches.some((m) => m.id === game.commonMatchId)) {
      stats.player2CommonMatchCount++;
    }
  });

  // Calculate efficiency (drinks per match)
  const player1TotalMatches = player1Games.reduce(
    (total, occurrence) => total + occurrence.game.matches.length,
    0
  );

  const player2TotalMatches = player2Games.reduce(
    (total, occurrence) => total + occurrence.game.matches.length,
    0
  );

  stats.player1Efficiency =
    player1TotalMatches > 0
      ? stats.player1.totalDrinks / player1TotalMatches
      : 0;

  stats.player2Efficiency =
    player2TotalMatches > 0
      ? stats.player2.totalDrinks / player2TotalMatches
      : 0;

  // Top drinker frequency
  player1Games.forEach(({ game }) => {
    if (isIdentityTopDrinker(game, player1.identityKey)) {
      stats.player1TopDrinkerCount++;
    }
  });

  player2Games.forEach(({ game }) => {
    if (isIdentityTopDrinker(game, player2.identityKey)) {
      stats.player2TopDrinkerCount++;
    }
  });

  // Calculate drinking influence - player1 with vs without player2
  if (stats.gamesPlayedTogether > 0) {
    const player1DrinksWithPlayer2 = gamesPlayedTogether.reduce(
      (total, occurrence) => total + (occurrence.player1.drinksTaken ?? 0),
      0
    );

    stats.player1AvgWithPlayer2 =
      player1DrinksWithPlayer2 / stats.gamesPlayedTogether;
  }

  const player1GamesWithoutPlayer2 = player1Games.filter(
    ({ game }) => !findPlayerByIdentityKey(game, player2.identityKey)
  );

  if (player1GamesWithoutPlayer2.length > 0) {
    const player1DrinksWithoutPlayer2 = player1GamesWithoutPlayer2.reduce(
      (total, occurrence) => total + (occurrence.player.drinksTaken ?? 0),
      0
    );

    stats.player1AvgWithoutPlayer2 =
      player1DrinksWithoutPlayer2 / player1GamesWithoutPlayer2.length;
  }

  // Calculate drinking influence - player2 with vs without player1
  if (stats.gamesPlayedTogether > 0) {
    const player2DrinksWithPlayer1 = gamesPlayedTogether.reduce(
      (total, occurrence) => total + (occurrence.player2.drinksTaken ?? 0),
      0
    );

    stats.player2AvgWithPlayer1 =
      player2DrinksWithPlayer1 / stats.gamesPlayedTogether;
  }

  const player2GamesWithoutPlayer1 = player2Games.filter(
    ({ game }) => !findPlayerByIdentityKey(game, player1.identityKey)
  );

  if (player2GamesWithoutPlayer1.length > 0) {
    const player2DrinksWithoutPlayer1 = player2GamesWithoutPlayer1.reduce(
      (total, occurrence) => total + (occurrence.player.drinksTaken ?? 0),
      0
    );

    stats.player2AvgWithoutPlayer1 =
      player2DrinksWithoutPlayer1 / player2GamesWithoutPlayer1.length;
  }

  return stats;
};
