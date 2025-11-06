import { Match, Player } from "../store/store";

/**
 * Mapping of player IDs to the list of match IDs they are assigned during setup.
 */
export type PlayerAssignments = Record<string, string[]>;

/**
 * Validate that generated assignments satisfy the balance and pairing constraints enforced by the setup wizard.
 * @param {Player[]} players Ordered list of participating players.
 * @param {PlayerAssignments} assignments Candidate assignment map to validate.
 * @param {number} totalMatchesPerPlayer Expected number of matches per player including the common match.
 * @param {string} commonMatchId Identifier of the common match shared by all players.
 * @throws {Error} When any player lacks the expected number of matches, when the common match is missing, or when pairings do not share exactly two matches.
 */
export function verifyFinalAssignments(
  players: Player[],
  assignments: PlayerAssignments,
  totalMatchesPerPlayer: number,
  commonMatchId: string
): void {
  const allHaveExactMatches = players.every(
    (player) => assignments[player.id]?.length === totalMatchesPerPlayer
  );

  if (!allHaveExactMatches) {
    throw new Error(
      `Could not assign exactly ${totalMatchesPerPlayer} matches to each player.`
    );
  }

  const allHaveCommonMatch = players.every((player) =>
    assignments[player.id]?.includes(commonMatchId)
  );

  if (!allHaveCommonMatch) {
    throw new Error("Not all players have the common match");
  }

  for (let i = 0; i < players.length - 1; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const player1Assignments = assignments[players[i].id] ?? [];
      const player2Assignments = assignments[players[j].id] ?? [];

      const sharedMatches = player1Assignments.filter((matchId) =>
        player2Assignments.includes(matchId)
      );

      if (sharedMatches.length !== 2) {
        throw new Error(
          `Players ${players[i].name} and ${players[j].name} share ${sharedMatches.length} matches (expected exactly 2: the common match + one unique pair match).`
        );
      }

      if (!sharedMatches.includes(commonMatchId)) {
        throw new Error(
          `Players ${players[i].name} and ${players[j].name} don't share the common match.`
        );
      }
    }
  }
}

/**
 * Generate balanced random match assignments that ensure every pair of players shares the common match plus one unique match.
 * @param {Player[]} players Players participating in the session.
 * @param {Match[]} matches Available matches to assign.
 * @param {string | null} commonMatchId Selected common match all players must share.
 * @param {number} additionalMatchesPerPlayer Number of extra matches (beyond the common match) each player should receive.
 * @returns {PlayerAssignments} Map of player IDs to the match IDs they are assigned.
 * @throws {Error} When prerequisites are not met or when the available matches cannot satisfy the constraints.
 */
export function generateRandomAssignments(
  players: Player[],
  matches: Match[],
  commonMatchId: string | null,
  additionalMatchesPerPlayer: number
): PlayerAssignments {
  if (!commonMatchId) {
    throw new Error("Please select a common match first");
  }

  const commonId = commonMatchId;
  const totalMatchesPerPlayer = additionalMatchesPerPlayer + 1;

  const numPlayers = players.length;
  const availableMatches = matches.filter((match) => match.id !== commonId);

  const pairCount = (numPlayers * (numPlayers - 1)) / 2;
  const matchesFromPairs = 1 + (numPlayers - 1);
  const extraMatchesPerPlayer = Math.max(
    0,
    totalMatchesPerPlayer - matchesFromPairs
  );
  const extraMatchesTotal = extraMatchesPerPlayer * numPlayers;
  const totalMatchesNeeded = 1 + pairCount + extraMatchesTotal;

  if (matches.length < totalMatchesNeeded) {
    throw new Error(
      `Need ${totalMatchesNeeded} matches (${pairCount} pair + ${extraMatchesTotal} extra) for ${numPlayers} players with ${additionalMatchesPerPlayer} additional each`
    );
  }

  const assignments: PlayerAssignments = {};
  players.forEach((player) => {
    assignments[player.id] = [commonId];
  });

  const playerPairs: [string, string][] = [];
  const pairSharedMatches: Record<string, string[]> = {};

  for (let i = 0; i < players.length - 1; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const pair: [string, string] = [players[i].id, players[j].id];
      const pairKey = pair.slice().sort().join("-");
      playerPairs.push(pair);
      pairSharedMatches[pairKey] = [commonId];
    }
  }

  const shuffledPairs = [...playerPairs].sort(() => Math.random() - 0.5);
  const shuffledMatches = [...availableMatches].sort(() => Math.random() - 0.5);

  const usedMatchIndices = new Set<number>();

  shuffledPairs.forEach((pair) => {
    let matchIndex = 0;
    while (
      usedMatchIndices.has(matchIndex) &&
      matchIndex < shuffledMatches.length
    ) {
      matchIndex++;
    }

    if (matchIndex >= shuffledMatches.length) {
      throw new Error("Not enough unique matches for all player pairs");
    }

    const match = shuffledMatches[matchIndex];
    const pairKey = pair.slice().sort().join("-");

    assignments[pair[0]].push(match.id);
    assignments[pair[1]].push(match.id);
    pairSharedMatches[pairKey].push(match.id);
    usedMatchIndices.add(matchIndex);
  });

  if (totalMatchesPerPlayer > 2) {
    const remainingMatches = shuffledMatches.filter(
      (_, index) => !usedMatchIndices.has(index)
    );

    players.forEach((player) => {
      const currentCount = assignments[player.id].length;
      const neededCount = totalMatchesPerPlayer - currentCount;
      if (neededCount <= 0) {
        return;
      }

      let assignedThisRound = 0;

      for (const match of remainingMatches) {
        if (assignedThisRound >= neededCount) {
          break;
        }

        if (assignments[player.id].includes(match.id)) {
          continue;
        }

        let createsPairConflict = false;
        const impactedPairs: string[] = [];

        for (const otherPlayer of players) {
          if (otherPlayer.id === player.id) {
            continue;
          }

          if (assignments[otherPlayer.id].includes(match.id)) {
            const pairKey = [player.id, otherPlayer.id].sort().join("-");

            const sharedMatches = pairSharedMatches[pairKey] ?? [commonId];

            if (sharedMatches.length >= 2) {
              createsPairConflict = true;
              break;
            }

            impactedPairs.push(pairKey);
          }
        }

        if (createsPairConflict) {
          continue;
        }

        assignments[player.id].push(match.id);
        impactedPairs.forEach((pairKey) => {
          if (!pairSharedMatches[pairKey]) {
            pairSharedMatches[pairKey] = [commonId];
          }
          if (!pairSharedMatches[pairKey].includes(match.id)) {
            pairSharedMatches[pairKey].push(match.id);
          }
        });

        assignedThisRound++;
      }

      if (assignments[player.id].length < totalMatchesPerPlayer) {
        throw new Error(
          `Could only assign ${
            assignments[player.id].length
          }/${totalMatchesPerPlayer} matches to ${
            player.name
          }. Need more matches.`
        );
      }
    });
  }

  verifyFinalAssignments(players, assignments, totalMatchesPerPlayer, commonId);

  return assignments;
}
