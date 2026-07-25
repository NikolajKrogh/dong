import React, { useMemo } from "react";
import { Text, XStack, YStack } from "tamagui";

import type { GuestRoomSession } from "../../types/guestRoom";
import { PlayerPickPanel } from "../lobby/PlayerPickPanel";

interface GuestJoinLobbyProps {
  session: GuestRoomSession;
  /**
   * Submits this guest's complete next pick set. Omitted when the caller has no
   * pick capability wired up, in which case the panel is not rendered and the
   * card behaves exactly as it did before player-picked mode existed.
   */
  onSetPicks?: (matchIds: string[]) => void | Promise<void>;
  isBusy?: boolean;
}

export const GuestJoinLobby: React.FC<GuestJoinLobbyProps> = ({
  session,
  onSetPicks,
  isBusy = false,
}) => {
  const { snapshot, grant } = session;

  const canPick =
    Boolean(onSetPicks) &&
    snapshot.assignmentMode === "player_picked" &&
    snapshot.state === "joinable";

  // GuestRoomMatchSummary → the shared renderer's view-model, minus the Common
  // Match (FR-040a). Mapped here rather than inside the panel because this type
  // doesn't unify with the registered lobby's RoomMatchSummary.
  const pickableMatches = useMemo(
    () =>
      snapshot.matches
        .filter((match) => match.id !== snapshot.commonMatchId)
        .map((match) => ({
          id: match.id,
          homeTeam: match.homeTeamName,
          awayTeam: match.awayTeamName,
          startTime: match.kickoffAt ?? undefined,
        })),
    [snapshot.matches, snapshot.commonMatchId],
  );

  const myPicks = useMemo(
    () =>
      snapshot.picks
        .filter((pick) => pick.participantId === grant.participantId)
        .map((pick) => pick.matchId),
    [snapshot.picks, grant.participantId],
  );

  // FR-042: a guest sees everyone's progress, not only their own.
  const pickCounts = useMemo(() => {
    const counts = new Map<string, number>();
    snapshot.picks.forEach((pick) => {
      counts.set(pick.participantId, (counts.get(pick.participantId) ?? 0) + 1);
    });
    return counts;
  }, [snapshot.picks]);

  // Gated on room state as well as mode: picks persist as joinable-era residue
  // after settlement, so a started room would otherwise keep showing progress
  // against picks that no longer decide anything. The registered lobby redirects
  // away at that point; this card stays on screen, so it has to check.
  const showProgress =
    snapshot.assignmentMode === "player_picked" &&
    snapshot.state === "joinable";
  const cap = snapshot.assignmentPlan.matchesPerPlayer;

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <Text color="$color" fontSize={24} fontWeight="700">
          Guest Room
        </Text>
        <Text color="$colorMuted" fontSize={14}>
          Current state: {snapshot.state}
        </Text>
      </YStack>

      <Text color="$colorMuted" fontSize={14} lineHeight={20}>
        You are connected as {grant.displayName}. Guest access is temporary and
        only applies to this room on this device.
      </Text>

      {canPick && onSetPicks ? (
        <PlayerPickPanel
          matches={pickableMatches}
          myPicks={myPicks}
          cap={cap}
          onSetPicks={onSetPicks}
          isBusy={isBusy}
          testID="guest-player-pick-panel"
        />
      ) : null}

      <Text color="$color" fontSize={16} fontWeight="700">
        Participants
      </Text>
      {snapshot.participants.map((participant) => (
        <XStack
          alignItems="center"
          backgroundColor="$backgroundLight"
          borderColor="$borderColorLight"
          borderRadius="$6"
          borderWidth={1}
          key={participant.id}
          gap="$2"
          padding="$4"
        >
          <Text color="$color" fontSize={15} fontWeight="600">
            {participant.displayName}{" "}
          </Text>
          <Text color="$primary" fontSize={13} fontWeight="600">
            · {participant.membershipType}
          </Text>
          {showProgress ? (
            <Text
              testID={`guest-pick-progress-${participant.id}`}
              color="$colorMuted"
              fontSize={13}
              fontWeight="600"
            >
              · {pickCounts.get(participant.id) ?? 0}/{cap} picked
            </Text>
          ) : null}
        </XStack>
      ))}
    </YStack>
  );
};
