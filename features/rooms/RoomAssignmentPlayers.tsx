import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { AssignmentPlayerCard, AssignmentLayoutToggle } from "../game-setup/AssignmentPlayerCard";

import type { RoomParticipantSummary } from "../../types/room";
import createSetupGameStyles from "../game-setup/setupGameStyles";
import { useColors } from "../../styles/theme";

import {
  SelectableMatchList,
  type SelectableMatch,
} from "../game-setup/SelectableMatchList";

interface RoomAssignmentPlayersProps {
  participants: RoomParticipantSummary[];
  matches: SelectableMatch[];
  matchesPerPlayer: number;
  targetsByParticipantId?: Record<string, number>;
  onSetPlayerMatchCount?: (participantId: string, count: number | null) => void;
  selectedMatchIdsFor: (participantId: string) => string[];
  isBusy: boolean;
  onToggleAllocation?: (participantId: string, matchId: string) => void;
  pending?: boolean;
  pendingLabel?: string;
  ownPicks?: React.ReactNode;
  editable?: boolean;
}

export function RoomAssignmentPlayers({
  participants,
  matches,
  matchesPerPlayer,
  targetsByParticipantId,
  onSetPlayerMatchCount,
  selectedMatchIdsFor,
  isBusy,
  onToggleAllocation,
  pending = false,
  pendingLabel = "On start",
  ownPicks,
  editable = false,
}: RoomAssignmentPlayersProps): React.JSX.Element {
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);
  const [useGridLayout, setUseGridLayout] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const busyMatchIds = isBusy
    ? matches.map((match) => match.id)
    : undefined;

  function toggleExpanded(participantId: string): void {
    setExpanded((previous) => ({
      ...previous,
      [participantId]: !previous[participantId],
    }));
  }
  return (
    <View
      testID="lobby-assignment-players"
      style={[styles.assignmentSection, styles.compactAssignmentSection]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, styles.compactAssignmentTitle]}>Players</Text>
        {onToggleAllocation ? <AssignmentLayoutToggle grid={useGridLayout} onToggle={() => setUseGridLayout(value => !value)} /> : null}
      </View>
      {ownPicks}
      {participants.map((participant) => {
        const selected = selectedMatchIdsFor(participant.id);
        const selectedIds = new Set(selected);
        const target = targetsByParticipantId?.[participant.id] ?? matchesPerPlayer;
        return (
          <AssignmentPlayerCard
            key={participant.id}
            compact
            target={target}
            defaultCount={matchesPerPlayer}
            selectedMatches={matches.filter(match => selectedIds.has(match.id))}
            disabled={isBusy}
            usesDefault={participant.additionalMatchCount == null}
            onSetCount={onSetPlayerMatchCount ? count => onSetPlayerMatchCount(participant.id, count) : undefined}
            title={participant.displayName}
            testID={`lobby-assignment-player-${participant.id}`}
            badgeTestID={`lobby-allocation-status-${participant.id}`}
            selectedCount={selected.length}
            totalCount={target}
            badgeLabel={pending && !editable ? `${target} · ${pendingLabel}` : undefined}
            collapsed={!expanded[participant.id]}
            onToggleCollapsed={
              onToggleAllocation || onSetPlayerMatchCount
                ? () => toggleExpanded(participant.id)
                : undefined
            }
          >
            {onToggleAllocation ?
            <SelectableMatchList
              density="compact"
              matches={matches}
              selectedMatchIds={selected}
              disabledMatchIds={busyMatchIds}
              useGridLayout={useGridLayout}
              testIDPrefix={`lobby-allocate-${participant.id}`}
              onToggleMatch={(id) => onToggleAllocation?.(participant.id, id)}
            /> : null}
          </AssignmentPlayerCard>
        );
      })}
    </View>
  );
}
