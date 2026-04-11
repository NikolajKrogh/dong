import { Match, Player } from "../store/store";

type PlayerAssignments = Record<string, string[]>;
type PairSharedMatches = Record<string, string[]>;

const compareIds = (left: string, right: string) => left.localeCompare(right);

const getPairKey = (playerIds: string[]) => {
  return [...playerIds].sort(compareIds).join("-");
};

const shuffle = <T>(values: T[]) => {
  return [...values].sort(() => Math.random() - 0.5);
};

const createAssignmentsWithCommonMatch = (
  players: Player[],
  commonMatchId: string,
): PlayerAssignments => {
  return players.reduce<PlayerAssignments>((assignments, player) => {
    assignments[player.id] = [commonMatchId];
    return assignments;
  }, {});
};

const buildPlayerPairs = (players: Player[], commonMatchId: string) => {
  const playerPairs: [string, string][] = [];
  const pairSharedMatches: PairSharedMatches = {};

  players.forEach((player, index) => {
    players.slice(index + 1).forEach((otherPlayer) => {
      const pair: [string, string] = [player.id, otherPlayer.id];
      playerPairs.push(pair);
      pairSharedMatches[getPairKey(pair)] = [commonMatchId];
    });
  });

  return { playerPairs, pairSharedMatches };
};

const findNextUnusedMatchIndex = (
  usedMatchIndices: Set<number>,
  totalMatches: number,
) => {
  let matchIndex = 0;

  while (matchIndex < totalMatches && usedMatchIndices.has(matchIndex)) {
    matchIndex += 1;
  }

  return matchIndex < totalMatches ? matchIndex : -1;
};

const assignPairMatches = ({
  shuffledPairs,
  shuffledMatches,
  assignments,
  pairSharedMatches,
}: {
  shuffledPairs: [string, string][];
  shuffledMatches: Match[];
  assignments: PlayerAssignments;
  pairSharedMatches: PairSharedMatches;
}) => {
  const usedMatchIndices = new Set<number>();

  for (const pair of shuffledPairs) {
    const matchIndex = findNextUnusedMatchIndex(
      usedMatchIndices,
      shuffledMatches.length,
    );

    if (matchIndex === -1) {
      throw new Error("Not enough unique matches for all player pairs");
    }

    const match = shuffledMatches[matchIndex];
    const pairKey = getPairKey(pair);

    assignments[pair[0]].push(match.id);
    assignments[pair[1]].push(match.id);
    pairSharedMatches[pairKey].push(match.id);
    usedMatchIndices.add(matchIndex);
  }

  return usedMatchIndices;
};

const getCompatiblePairKeys = ({
  player,
  matchId,
  players,
  assignments,
  pairSharedMatches,
}: {
  player: Player;
  matchId: string;
  players: Player[];
  assignments: PlayerAssignments;
  pairSharedMatches: PairSharedMatches;
}) => {
  const pairKeysToUpdate: string[] = [];

  for (const otherPlayer of players) {
    if (otherPlayer.id === player.id) {
      continue;
    }

    if (!assignments[otherPlayer.id].includes(matchId)) {
      continue;
    }

    const pairKey = getPairKey([player.id, otherPlayer.id]);

    if (pairSharedMatches[pairKey].length >= 2) {
      return null;
    }

    pairKeysToUpdate.push(pairKey);
  }

  return pairKeysToUpdate;
};

const tryAssignExtraMatch = ({
  player,
  match,
  players,
  assignments,
  pairSharedMatches,
}: {
  player: Player;
  match: Match;
  players: Player[];
  assignments: PlayerAssignments;
  pairSharedMatches: PairSharedMatches;
}) => {
  if (assignments[player.id].includes(match.id)) {
    return false;
  }

  const pairKeysToUpdate = getCompatiblePairKeys({
    player,
    matchId: match.id,
    players,
    assignments,
    pairSharedMatches,
  });

  if (!pairKeysToUpdate) {
    return false;
  }

  assignments[player.id].push(match.id);
  pairKeysToUpdate.forEach((pairKey) => {
    pairSharedMatches[pairKey].push(match.id);
  });

  return true;
};

const assertPlayerMatchCount = ({
  player,
  assignments,
  totalMatchesPerPlayer,
}: {
  player: Player;
  assignments: PlayerAssignments;
  totalMatchesPerPlayer: number;
}) => {
  if (assignments[player.id].length < totalMatchesPerPlayer) {
    throw new Error(
      `Could only assign ${assignments[player.id].length}/${totalMatchesPerPlayer} matches to ${player.name}. Need more matches.`,
    );
  }
};

const assignExtraMatches = ({
  players,
  shuffledMatches,
  usedMatchIndices,
  assignments,
  pairSharedMatches,
  totalMatchesPerPlayer,
}: {
  players: Player[];
  shuffledMatches: Match[];
  usedMatchIndices: Set<number>;
  assignments: PlayerAssignments;
  pairSharedMatches: PairSharedMatches;
  totalMatchesPerPlayer: number;
}) => {
  const remainingMatches = shuffledMatches.filter(
    (_, index) => !usedMatchIndices.has(index),
  );

  for (const player of players) {
    const neededCount = totalMatchesPerPlayer - assignments[player.id].length;

    if (neededCount <= 0) {
      continue;
    }

    let assignedThisRound = 0;

    for (const match of remainingMatches) {
      if (assignedThisRound >= neededCount) {
        break;
      }

      const assigned = tryAssignExtraMatch({
        player,
        match,
        players,
        assignments,
        pairSharedMatches,
      });

      if (assigned) {
        assignedThisRound += 1;
      }
    }

    assertPlayerMatchCount({ player, assignments, totalMatchesPerPlayer });
  }
};

const verifyFinalAssignments = (
  players: Player[],
  assignments: PlayerAssignments,
  commonMatchId: string,
  totalMatchesPerPlayer: number,
) => {
  const allHaveExactMatches = players.every(
    (player) => assignments[player.id].length === totalMatchesPerPlayer,
  );

  if (!allHaveExactMatches) {
    throw new Error(
      `Could not assign exactly ${totalMatchesPerPlayer} matches to each player.`,
    );
  }

  const allHaveCommonMatch = players.every((player) =>
    assignments[player.id].includes(commonMatchId),
  );

  if (!allHaveCommonMatch) {
    throw new Error("Not all players have the common match");
  }

  for (let i = 0; i < players.length - 1; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const playerOneAssignments = assignments[players[i].id];
      const playerTwoAssignments = assignments[players[j].id];
      const sharedMatches = playerOneAssignments.filter((matchId) =>
        playerTwoAssignments.includes(matchId),
      );

      if (sharedMatches.length !== 2) {
        throw new Error(
          `Players ${players[i].name} and ${players[j].name} share ${sharedMatches.length} matches (expected exactly 2: the common match + one unique pair match).`,
        );
      }

      if (!sharedMatches.includes(commonMatchId)) {
        throw new Error(
          `Players ${players[i].name} and ${players[j].name} don't share the common match.`,
        );
      }
    }
  }
};

export const createRandomAssignments = (
  players: Player[],
  matches: Match[],
  commonMatchId: string | null,
  additionalMatchesPerPlayer: number,
): PlayerAssignments => {
  if (!commonMatchId) {
    throw new Error("Please select a common match first");
  }

  const totalMatchesPerPlayer = additionalMatchesPerPlayer + 1;
  const numPlayers = players.length;
  const availableMatches = matches.filter(
    (match) => match.id !== commonMatchId,
  );
  const pairCount = (numPlayers * (numPlayers - 1)) / 2;
  const matchesFromPairs = 1 + (numPlayers - 1);
  const extraMatchesPerPlayer = Math.max(
    0,
    totalMatchesPerPlayer - matchesFromPairs,
  );
  const extraMatchesTotal = extraMatchesPerPlayer * numPlayers;
  const totalMatchesNeeded = 1 + pairCount + extraMatchesTotal;

  if (matches.length < totalMatchesNeeded) {
    throw new Error(
      `Need ${totalMatchesNeeded} matches (${pairCount} pair + ${extraMatchesTotal} extra) for ${numPlayers} players with ${additionalMatchesPerPlayer} additional each`,
    );
  }

  const assignments = createAssignmentsWithCommonMatch(players, commonMatchId);
  const { playerPairs, pairSharedMatches } = buildPlayerPairs(
    players,
    commonMatchId,
  );
  const shuffledPairs = shuffle(playerPairs);
  const shuffledMatches = shuffle(availableMatches);
  const usedMatchIndices = assignPairMatches({
    shuffledPairs,
    shuffledMatches,
    assignments,
    pairSharedMatches,
  });

  if (totalMatchesPerPlayer > 2) {
    assignExtraMatches({
      players,
      shuffledMatches,
      usedMatchIndices,
      assignments,
      pairSharedMatches,
      totalMatchesPerPlayer,
    });
  }

  verifyFinalAssignments(
    players,
    assignments,
    commonMatchId,
    totalMatchesPerPlayer,
  );

  return assignments;
};

export default createRandomAssignments;
