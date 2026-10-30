import React, { useMemo } from "react";
import { Platform } from "react-native";
import { Text, XStack, YStack } from "tamagui";

import type { GuestRoomSession } from "../../types/guestRoom";
import { SelectableMatchList } from "../game-setup/SelectableMatchList";
import { PlayerPickPanel } from "./PlayerPickPanel";
import { roomSnapshotToActiveRoster } from "./roomSnapshotAdapter";

interface GuestRoomContentProps {
  session: GuestRoomSession;
  onSetPicks?: (matchIds: string[]) => void | Promise<void>;
  isBusy?: boolean;
  tab?: "matches" | "room";
}

interface GuestMatchesProps extends Pick<GuestRoomContentProps, "session" | "onSetPicks" | "isBusy"> {
  showPickProgress: boolean;
}

function ignoreReadOnlyPress(): void {}

function GuestMatches({ session, onSetPicks, isBusy, showPickProgress }: GuestMatchesProps): React.JSX.Element {
  const { snapshot, grant } = session;
  const matches = useMemo(
    () => snapshot.matches
      .filter((match) => match.id !== snapshot.commonMatchId)
      .map((match) => ({
        id: match.id,
        homeTeam: match.homeTeamName,
        awayTeam: match.awayTeamName,
        startTime: match.kickoffAt ?? undefined,
      })),
    [snapshot.matches, snapshot.commonMatchId],
  );

  if (showPickProgress && onSetPicks) {
    const myPicks = (snapshot.picks ?? [])
      .filter((pick) => pick.participantId === grant.participantId)
      .map((pick) => pick.matchId);

    return (
      <PlayerPickPanel
        flat
        matches={matches}
        myPicks={myPicks}
        cap={snapshot.assignmentPlan.matchesPerPlayer}
        onSetPicks={onSetPicks}
        isBusy={isBusy}
        testID="guest-player-pick-panel"
      />
    );
  }

  const assignsOnStart = snapshot.state === "joinable"
    && !snapshot.finalOnly
    && snapshot.assignmentMode === "automatic";
  const assignedIds = new Set(
    snapshot.assignments
      .filter((assignment) => assignment.participantId === grant.participantId)
      .map((assignment) => assignment.matchId),
  );
  const assigned = matches.filter((match) => assignedIds.has(match.id));

  let content = <Text color="$colorMuted">Waiting for the host to assign your matches.</Text>;
  if (assignsOnStart) {
    content = <Text color="$colorMuted">Your matches will be assigned when the host starts the game.</Text>;
  } else if (assigned.length > 0) {
    content = (
      <SelectableMatchList
        matches={assigned}
        selectedMatchIds={[]}
        onToggleMatch={ignoreReadOnlyPress}
        readOnly
        testIDPrefix="guest-assigned-match"
      />
    );
  }

  return (
    <>
      <Text color="$color" fontSize={18} fontWeight="600">Your matches</Text>
      {content}
    </>
  );
}

export function GuestRoomContent({
  session,
  onSetPicks,
  isBusy = false,
  tab = "matches",
}: GuestRoomContentProps): React.JSX.Element {
  const { snapshot, grant } = session;
  const participants = roomSnapshotToActiveRoster(snapshot);
  const picks = snapshot.picks ?? [];
  const cap = snapshot.assignmentPlan?.matchesPerPlayer ?? 0;
  const common = snapshot.matches.find((match) => match.id === snapshot.commonMatchId);
  const showPickProgress = snapshot.state === "joinable"
    && !snapshot.finalOnly
    && snapshot.assignmentMode === "player_picked"
    && Boolean(snapshot.assignmentPlan);

  return (
    <>
      <YStack
        gap="$3"
        display={tab === "matches" ? "flex" : "none"}
        {...(Platform.OS === "web" ? {
          role: "tabpanel",
          id: "guest-panel-matches",
          "aria-labelledby": "guest-tab-matches",
        } : {})}
      >
        <GuestMatches
          session={session}
          onSetPicks={onSetPicks}
          isBusy={isBusy}
          showPickProgress={showPickProgress}
        />
      </YStack>
      <YStack
        gap="$4"
        display={tab === "room" ? "flex" : "none"}
        {...(Platform.OS === "web" ? {
          role: "tabpanel",
          id: "guest-panel-room",
          "aria-labelledby": "guest-tab-room",
        } : {})}
      >
        <YStack gap="$2">
          <Text color="$color" fontSize={18} fontWeight="600">Common match</Text>
          <Text color="$colorMuted">Included for everyone, in addition to your picks.</Text>
          {common ? (
            <Text color="$color">{common.homeTeamName} vs {common.awayTeamName}</Text>
          ) : (
            <Text color="$colorMuted">The host has not chosen a common match yet.</Text>
          )}
        </YStack>
        <YStack gap="$2">
          <Text color="$color" fontSize={18} fontWeight="600">Players · {participants.length}</Text>
          {participants.map((participant) => (
            <XStack
              key={participant.id}
              gap="$3"
              alignItems="center"
              justifyContent="space-between"
              paddingVertical="$3"
              borderBottomWidth={1}
              borderColor="$borderColorLight"
            >
              <YStack flex={1} minWidth={0} gap="$1">
                <Text color="$color" fontSize={16}>{participant.displayName}</Text>
                <Text color="$colorMuted" fontSize={13}>
                  {participant.sessionRole === "owner" ? "Host" : "Player"}
                  {participant.id === grant.participantId ? " · You" : ""}
                </Text>
              </YStack>
              {showPickProgress ? (
                <Text testID={`guest-pick-progress-${participant.id}`} color="$colorMuted" fontSize={13}>
                  {picks.filter((pick) => pick.participantId === participant.id).length}/{cap} picked
                </Text>
              ) : null}
            </XStack>
          ))}
        </YStack>
        <Text color="$colorMuted" fontSize={13}>
          Guest access is temporary and only applies to this room on this device.
        </Text>
      </YStack>
    </>
  );
}
