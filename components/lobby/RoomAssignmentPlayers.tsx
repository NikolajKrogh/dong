import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";

import type { RoomParticipantSummary } from "../../types/room";
import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";
import { MatchSelectionCard } from "../matchSelection/MatchSelectionCard";
import {
  SelectableMatchList,
  type SelectableMatch,
} from "../matchSelection/SelectableMatchList";

interface RoomAssignmentPlayersProps {
  participants: RoomParticipantSummary[];
  matches: SelectableMatch[];
  matchesPerPlayer: number;
  selectedMatchIdsFor: (participantId: string) => string[];
  isBusy: boolean;
  onToggleAllocation?: (participantId: string, matchId: string) => void;
  pending?: boolean;
  ownPicks?: React.ReactNode;
}

export function RoomAssignmentPlayers({
  participants,
  matches,
  matchesPerPlayer,
  selectedMatchIdsFor,
  isBusy,
  onToggleAllocation,
  pending = false,
  ownPicks,
}: RoomAssignmentPlayersProps): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const disabledMatchIds = isBusy
    ? matches.map((match) => match.id)
    : undefined;

  function toggleExpanded(participantId: string): void {
    setExpanded((previous) => ({
      ...previous,
      [participantId]: !previous[participantId],
    }));
  }
  return (
    <View testID="lobby-assignment-players" style={styles.assignmentSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Players</Text>
      </View>
      {ownPicks}
      {participants.map((participant) => {
        const selected = selectedMatchIdsFor(participant.id);
        return (
          <MatchSelectionCard
            key={participant.id}
            title={participant.displayName}
            testID={`lobby-assignment-player-${participant.id}`}
            badgeTestID={`lobby-allocation-status-${participant.id}`}
            selectedCount={selected.length}
            totalCount={matchesPerPlayer}
            badgeLabel={pending ? "On start" : undefined}
            collapsed={!expanded[participant.id]}
            onToggleCollapsed={
              onToggleAllocation
                ? () => toggleExpanded(participant.id)
                : undefined
            }
          >
            <SelectableMatchList
              matches={matches}
              selectedMatchIds={selected}
              disabledMatchIds={disabledMatchIds}
              testIDPrefix={`lobby-allocate-${participant.id}`}
              onToggleMatch={(id) => onToggleAllocation?.(participant.id, id)}
            />
          </MatchSelectionCard>
        );
      })}
    </View>
  );
}
