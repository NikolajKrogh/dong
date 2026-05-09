import type {
  ImportLegacyHistoryRpcRequest,
  LegacyHistoryClaimantOption,
  LegacyHistoryImportGuestParticipantPayload,
  LegacyHistoryImportMatchPayload,
  LegacyHistoryImportPlayerPayload,
  LegacyHistoryImportSessionPayload,
  LegacyHistoryPlayerAssignments,
  LegacyHistorySourceFingerprintInput,
  LegacyLocalSessionSnapshot,
} from "../types/legacyHistoryImport";

export interface LegacyHistoryDerivedClaimantOption extends LegacyHistoryClaimantOption {
  normalizedName: string;
  sourceParticipantIds: string[];
  sessionParticipantIds: Record<string, string[]>;
  ambiguousSessionIds: string[];
}

const compareStrings = (left: string, right: string) =>
  left.localeCompare(right);

const compareSessions = (
  left: LegacyLocalSessionSnapshot,
  right: LegacyLocalSessionSnapshot,
) => {
  const bySavedAt = left.date.localeCompare(right.date);

  if (bySavedAt !== 0) {
    return bySavedAt;
  }

  return left.id.localeCompare(right.id);
};

const sortUniqueStrings = (values: string[]) => {
  return [...new Set(values)].sort(compareStrings);
};

const pickRepresentativeParticipantId = (
  sessionParticipantIds: Record<string, string[]>,
  sessionIds: string[],
) => {
  const representativeSessionId =
    sessionIds.find(
      (sessionId) => sessionParticipantIds[sessionId].length === 1,
    ) ?? sessionIds[0];

  return representativeSessionId
    ? sessionParticipantIds[representativeSessionId][0]
    : "";
};

const pickDisplayName = (
  displayNameCounts: Map<string, number>,
  fallbackName: string,
) => {
  const countUppercaseCharacters = (value: string) => {
    return (value.match(/[A-Z]/g) ?? []).length;
  };

  let selectedName = fallbackName;
  let selectedCount = -1;

  for (const [displayName, count] of displayNameCounts.entries()) {
    const displayNameUppercaseCount = countUppercaseCharacters(displayName);
    const selectedNameUppercaseCount = countUppercaseCharacters(selectedName);

    if (
      count > selectedCount ||
      (count === selectedCount &&
        displayNameUppercaseCount > selectedNameUppercaseCount) ||
      (count === selectedCount &&
        displayNameUppercaseCount === selectedNameUppercaseCount &&
        displayName.length > selectedName.length) ||
      (count === selectedCount && displayName.localeCompare(selectedName) < 0)
    ) {
      selectedName = displayName;
      selectedCount = count;
    }
  }

  return selectedName;
};

const formatLegacyHistoryParticipantName = (name: string) => {
  return name.trim().replaceAll(/\s+/g, " ");
};

const buildStablePlayerAssignments = (
  playerAssignments: LegacyHistoryPlayerAssignments,
) => {
  const stableAssignments: LegacyHistoryPlayerAssignments = {};

  Object.keys(playerAssignments)
    .sort(compareStrings)
    .forEach((playerId) => {
      stableAssignments[playerId] = sortUniqueStrings(
        playerAssignments[playerId] ?? [],
      );
    });

  return stableAssignments;
};

const buildPlayerPayloads = (
  players: LegacyLocalSessionSnapshot["players"],
): LegacyHistoryImportPlayerPayload[] => {
  return [...players]
    .map((player) => {
      const payload: LegacyHistoryImportPlayerPayload = {
        id: player.id,
        name: player.name,
      };

      if (typeof player.drinksTaken === "number") {
        payload.drinksTaken = player.drinksTaken;
      }

      return payload;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
};

const buildMatchPayloads = (
  matches: LegacyLocalSessionSnapshot["matches"],
): LegacyHistoryImportMatchPayload[] => {
  return [...matches]
    .map((match) => {
      const payload: LegacyHistoryImportMatchPayload = {
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
      };

      if (match.startTime) {
        payload.startTime = match.startTime;
      }

      return payload;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
};

const buildGuestParticipantPayloads = (
  players: LegacyLocalSessionSnapshot["players"],
  claimedLocalParticipantId: string,
): LegacyHistoryImportGuestParticipantPayload[] => {
  return buildPlayerPayloads(players).filter(
    (player) => player.id !== claimedLocalParticipantId,
  );
};

const buildStableSessionParticipantIds = (
  sessionParticipantIds: Record<string, string[]>,
) => {
  const stableParticipantIds: Record<string, string[]> = {};

  Object.keys(sessionParticipantIds)
    .sort(compareStrings)
    .forEach((sessionId) => {
      stableParticipantIds[sessionId] = sortUniqueStrings(
        sessionParticipantIds[sessionId],
      );
    });

  return stableParticipantIds;
};

export const normalizeLegacyHistoryParticipantName = (name: string) => {
  return name.trim().replaceAll(/\s+/g, " ").toLocaleLowerCase();
};

export const buildLegacyHistoryClaimantOptions = (
  sessions: LegacyLocalSessionSnapshot[],
): LegacyHistoryDerivedClaimantOption[] => {
  const claimantGroups = new Map<
    string,
    {
      displayNameCounts: Map<string, number>;
      sourceParticipantIds: Set<string>;
      sessionParticipantIds: Record<string, string[]>;
      fallbackName: string;
    }
  >();

  [...sessions].sort(compareSessions).forEach((session) => {
    [...session.players]
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach((player) => {
        const displayName = formatLegacyHistoryParticipantName(player.name);
        const normalizedName = normalizeLegacyHistoryParticipantName(
          player.name,
        );

        if (!normalizedName) {
          return;
        }

        const existingGroup = claimantGroups.get(normalizedName);

        if (existingGroup) {
          existingGroup.displayNameCounts.set(
            displayName,
            (existingGroup.displayNameCounts.get(displayName) ?? 0) + 1,
          );
          existingGroup.sourceParticipantIds.add(player.id);
          existingGroup.sessionParticipantIds[session.id] = [
            ...(existingGroup.sessionParticipantIds[session.id] ?? []),
            player.id,
          ];
          return;
        }

        claimantGroups.set(normalizedName, {
          displayNameCounts: new Map([[displayName, 1]]),
          sourceParticipantIds: new Set([player.id]),
          sessionParticipantIds: { [session.id]: [player.id] },
          fallbackName: displayName,
        });
      });
  });

  return [...claimantGroups.entries()]
    .map(([normalizedName, claimantGroup]) => {
      const sessionParticipantIds = buildStableSessionParticipantIds(
        claimantGroup.sessionParticipantIds,
      );
      const sessionIds = Object.keys(sessionParticipantIds).sort(
        compareStrings,
      );
      const ambiguousSessionIds = sessionIds.filter(
        (sessionId) => sessionParticipantIds[sessionId].length > 1,
      );
      const sourceParticipantIds = sortUniqueStrings([
        ...claimantGroup.sourceParticipantIds,
      ]);

      return {
        id: pickRepresentativeParticipantId(sessionParticipantIds, sessionIds),
        name: pickDisplayName(
          claimantGroup.displayNameCounts,
          claimantGroup.fallbackName,
        ),
        normalizedName,
        sessionIds,
        sessionCount: sessionIds.length,
        sourceParticipantIds,
        sessionParticipantIds,
        ambiguousSessionIds,
      };
    })
    .sort((left, right) => {
      if (left.sessionCount !== right.sessionCount) {
        return right.sessionCount - left.sessionCount;
      }

      const byName = left.name.localeCompare(right.name);

      if (byName !== 0) {
        return byName;
      }

      return left.id.localeCompare(right.id);
    });
};

export const buildLegacyHistorySourceFingerprintInput = (
  session: LegacyLocalSessionSnapshot,
): LegacyHistorySourceFingerprintInput => {
  return {
    sourceLocalSessionId: session.id,
    savedAt: session.date,
    commonMatchId: session.commonMatchId,
    matchesPerPlayer: session.matchesPerPlayer,
    players: buildPlayerPayloads(session.players),
    matches: buildMatchPayloads(session.matches),
    playerAssignments: buildStablePlayerAssignments(session.playerAssignments),
  };
};

export const buildLegacyHistoryImportSessionPayload = (
  session: LegacyLocalSessionSnapshot,
  claimedLocalParticipantId: string,
): LegacyHistoryImportSessionPayload => {
  if (
    !session.players.some((player) => player.id === claimedLocalParticipantId)
  ) {
    throw new Error(
      `Claimed participant ${claimedLocalParticipantId} is missing from source session ${session.id}.`,
    );
  }

  return {
    ...buildLegacyHistorySourceFingerprintInput(session),
    claimedLocalParticipantId,
    guestParticipants: buildGuestParticipantPayloads(
      session.players,
      claimedLocalParticipantId,
    ),
  };
};

export const buildLegacyHistoryImportSessions = ({
  sessions,
  claimant,
}: {
  sessions: LegacyLocalSessionSnapshot[];
  claimant: LegacyHistoryDerivedClaimantOption;
}) => {
  if (claimant.ambiguousSessionIds.length > 0) {
    throw new Error(
      `Claimant ${claimant.name} is ambiguous in ${claimant.ambiguousSessionIds.length} legacy session(s).`,
    );
  }

  const importSessions = [...sessions]
    .sort(compareSessions)
    .filter((session) => {
      return (claimant.sessionParticipantIds[session.id] ?? []).length === 1;
    })
    .map((session) => {
      const [claimedLocalParticipantId] =
        claimant.sessionParticipantIds[session.id];

      return buildLegacyHistoryImportSessionPayload(
        session,
        claimedLocalParticipantId,
      );
    });

  if (importSessions.length === 0) {
    throw new Error(
      `Claimant ${claimant.name} was not found in any eligible legacy sessions.`,
    );
  }

  return importSessions;
};

export const buildLegacyHistoryImportRequest = ({
  sessions,
  claimant,
}: {
  sessions: LegacyLocalSessionSnapshot[];
  claimant: LegacyHistoryDerivedClaimantOption;
}): ImportLegacyHistoryRpcRequest => {
  return {
    claimedLocalParticipantId: claimant.id,
    sessions: buildLegacyHistoryImportSessions({ sessions, claimant }),
  };
};
