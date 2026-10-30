import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AssignmentCounter } from "../game-setup/AssignmentControls";

import type { RoomParticipantSummary } from "../../types/room";
import createSetupGameStyles from "../game-setup/setupGameStyles";
import { useColors } from "../../styles/theme";
import { MatchSelectionCard } from "../game-setup/MatchSelectionCard";
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
    <View
      testID="lobby-assignment-players"
      style={[styles.assignmentSection, styles.compactAssignmentSection]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, styles.compactAssignmentTitle]}>Players</Text>
      </View>
      {ownPicks}
      {participants.map((participant) => {
        const selected = selectedMatchIdsFor(participant.id);
        const selectedIds = new Set(selected);
        const target = targetsByParticipantId?.[participant.id] ?? matchesPerPlayer;
        return (
          <MatchSelectionCard
            key={participant.id}
            compact
            title={participant.displayName}
            testID={`lobby-assignment-player-${participant.id}`}
            badgeTestID={`lobby-allocation-status-${participant.id}`}
            selectedCount={selected.length}
            totalCount={target}
            badgeLabel={pending ? `${target} · ${pendingLabel}` : undefined}
            collapsed={!expanded[participant.id]}
            onToggleCollapsed={
              onToggleAllocation || onSetPlayerMatchCount
                ? () => toggleExpanded(participant.id)
                : undefined
            }
          >
            {onSetPlayerMatchCount ? <>
              <AssignmentCounter label={`${participant.displayName}'s additional matches`} value={target} max={100}
                disabled={isBusy} onChange={count => onSetPlayerMatchCount(participant.id, count)} />
              <Text>{target === 0 ? "Common match only" : "Plus the common match"} · {participant.additionalMatchCount == null ? "Using default" : "Custom count"}</Text>
              {participant.additionalMatchCount != null ? <TouchableOpacity accessibilityRole="button"
                accessibilityLabel={`Use default count for ${participant.displayName}`} disabled={isBusy}
                onPress={() => onSetPlayerMatchCount(participant.id, null)}><Text>Use default</Text></TouchableOpacity> : null}
            </> : null}
            {onToggleAllocation ?
            <SelectableMatchList
              matches={matches}
              selectedMatchIds={selected}
              disabledMatchIds={isBusy ? disabledMatchIds : selected.length >= target ? matches.filter(m => !selectedIds.has(m.id)).map(m => m.id) : undefined}
              testIDPrefix={`lobby-allocate-${participant.id}`}
              onToggleMatch={(id) => onToggleAllocation?.(participant.id, id)}
            /> : null}
          </MatchSelectionCard>
        );
      })}
    </View>
  );
}
