import React, { useState } from "react";
import { Text, YStack } from "tamagui";
import { ShellActionButton } from "../../components/ui";
import type { RoomParticipantSummary } from "../../types/room";
import type { SelectableMatch } from "../game-setup/SelectableMatchList";
import type { AssignmentPreview } from "./roomAssignments";

interface ReviewedAssignmentsProps {
  preview: AssignmentPreview;
  participants: RoomParticipantSummary[];
  matches: SelectableMatch[];
  isBusy: boolean;
  onCommit: (acceptRelaxedSharing: boolean) => void;
  actionLabel: string;
}

interface AssignmentPreviewPanelProps extends Omit<ReviewedAssignmentsProps, "preview"> {
  preview: AssignmentPreview | null;
  onReview: () => void;
}

interface PairInspectionProps {
  participants: RoomParticipantSummary[];
  assignments: AssignmentPreview["assignments"];
}

export function AssignmentPreviewPanel({
  preview, participants, matches, isBusy, onReview, onCommit, actionLabel,
}: AssignmentPreviewPanelProps): React.JSX.Element {
  return (
    <YStack gap="$2" testID="assignment-preview-panel">
      <ShellActionButton label={isBusy ? "Preparing…" : "Preview assignments"} disabled={isBusy} onPress={onReview} />
      {preview ? (
        <ReviewedAssignments
          key={JSON.stringify(preview)}
          preview={preview}
          participants={participants}
          matches={matches}
          isBusy={isBusy}
          onCommit={onCommit}
          actionLabel={actionLabel}
        />
      ) : null}
    </YStack>
  );
}

function ReviewedAssignments({
  preview, participants, matches, isBusy, onCommit, actionLabel,
}: ReviewedAssignmentsProps): React.JSX.Element {
  const [consent, setConsent] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const matchNames = new Map(matches.flatMap(match => {
    const name = `${match.homeTeam} vs ${match.awayTeam}`;
    return [[match.id, name], [`new:${match.id}`, name]];
  }));
  const quality = preview.quality;
  let sharingDescription = "Sharing is a preference; each player's count stays fixed.";
  if (preview.sharingPolicy === "common_only") sharingDescription = "Common match only";
  else if (preview.sharingPolicy === "exact") sharingDescription = "Exact sharing";

  return (
    <YStack gap="$2">
      <Text fontWeight="700">Assignment preview · plus the common match</Text>
      <Text>{sharingDescription}</Text>
      {quality ? (
        <Text>
          {quality.quality === "optimal" ? "Optimal sharing" : "Best-effort sharing"}
          {quality.summaryComplete ? ` · total deviation ${quality.totalDeviation ?? 0}` : " · sharing summary incomplete"}
        </Text>
      ) : (
        <Text>Existing choices stay selected. Missing slots are filled when you continue.</Text>
      )}
      {participants.map(participant => {
        const selected = preview.assignments[participant.id] ?? [];
        const target = preview.targetsByParticipantId[participant.id] ?? 0;
        let status = "";
        if (target === 0) status = " · common match only";
        else if (selected.length < target) status = ` · ${target - selected.length} to fill`;

        return (
          <YStack key={participant.id}>
            <ShellActionButton
              size="small"
              label={`${participant.displayName}: ${selected.length}/${target} additional matches${status}`}
              onPress={() => setExpanded(value => value === participant.id ? null : participant.id)}
            />
            {expanded === participant.id ? selected.map(id => <Text key={id}>{matchNames.get(id) ?? "Selected match"}</Text>) : null}
          </YStack>
        );
      })}
      {quality ? <PairInspection participants={participants} assignments={preview.assignments} /> : null}
      {preview.requiresSharingConsent ? (
        <>
          <Text>The pool is too small for exact sharing. Counts remain fixed. Allow relaxed sharing for this preview?</Text>
          <ShellActionButton
            label={consent ? "✓ Relaxed sharing accepted" : "Allow relaxed sharing"}
            disabled={isBusy}
            onPress={() => setConsent(value => !value)}
          />
        </>
      ) : null}
      <ShellActionButton
        label={actionLabel}
        disabled={isBusy || (preview.requiresSharingConsent && !consent)}
        onPress={() => onCommit(consent)}
      />
    </YStack>
  );
}

function PairInspection({ participants, assignments }: PairInspectionProps): React.JSX.Element {
  const [pair, setPair] = useState<string[]>([]);
  const names = new Map(participants.map(participant => [participant.id, participant.displayName]));
  let overlap: number | null = null;
  if (pair.length === 2) {
    const rightMatches = new Set(assignments[pair[1]] ?? []);
    overlap = (assignments[pair[0]] ?? []).filter(id => rightMatches.has(id)).length;
  }

  function togglePlayer(participantId: string): void {
    setPair(previous => {
      if (previous.includes(participantId)) return previous.filter(id => id !== participantId);
      return [...previous.slice(-1), participantId];
    });
  }

  return (
    <>
      <Text>Select two players to inspect their shared additional matches.</Text>
      {participants.map(participant => (
        <ShellActionButton
          key={participant.id}
          label={`${pair.includes(participant.id) ? "✓ " : ""}${participant.displayName}`}
          size="small"
          widthMode="fit"
          onPress={() => togglePlayer(participant.id)}
        />
      ))}
      {overlap !== null ? <Text>{names.get(pair[0])} and {names.get(pair[1])} share {overlap} additional matches.</Text> : null}
    </>
  );
}
