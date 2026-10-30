import React, { useState } from "react";
import { Text, YStack } from "tamagui";
import { ShellActionButton } from "../../components/ui";
import type { RoomParticipantSummary } from "../../types/room";
import type { AssignmentPreview } from "./roomAssignments";
import type { SelectableMatch } from "../game-setup/SelectableMatchList";

export function AssignmentPreviewPanel({ preview, participants, matches, isBusy, onReview, onCommit, actionLabel }: {
  preview: AssignmentPreview | null;
  participants: RoomParticipantSummary[];
  matches: SelectableMatch[];
  isBusy: boolean;
  onReview: () => void;
  onCommit: (acceptRelaxedSharing: boolean) => void;
  actionLabel: string;
}) {
  return <YStack gap="$2" testID="assignment-preview-panel">
    <ShellActionButton label={isBusy ? "Preparing…" : "Preview assignments"} disabled={isBusy} onPress={onReview} />
    {preview ? <ReviewedAssignments key={JSON.stringify(preview)} preview={preview} participants={participants} matches={matches}
      isBusy={isBusy} onCommit={onCommit} actionLabel={actionLabel} /> : null}
  </YStack>;
}

function ReviewedAssignments({ preview, participants, matches, isBusy, onCommit, actionLabel }: {
  preview: AssignmentPreview; participants: RoomParticipantSummary[]; isBusy: boolean;
  matches: SelectableMatch[];
  onCommit: (acceptRelaxedSharing: boolean) => void; actionLabel: string;
}) {
  const [consent, setConsent] = useState(false);
  const [pair, setPair] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const names = new Map(participants.map(p => [p.id, p.displayName]));
  const matchNames = new Map(matches.flatMap(m => [[m.id, `${m.homeTeam} vs ${m.awayTeam}`], [`new:${m.id}`, `${m.homeTeam} vs ${m.awayTeam}`]]));
  const quality = preview.quality;
  const rightMatches = new Set(preview.assignments[pair[1]] ?? []);
  const overlap = pair.length === 2 ? (preview.assignments[pair[0]] ?? [])
    .filter(id => rightMatches.has(id)).length : null;
  return <YStack gap="$2">
    <Text fontWeight="700">Assignment preview · plus the common match</Text>
    <Text>{preview.sharingPolicy === "common_only" ? "Common match only" : preview.sharingPolicy === "exact"
      ? "Exact sharing" : "Sharing is a preference; each player's count stays fixed."}</Text>
    {quality ? <Text>{quality.quality === "optimal" ? "Optimal sharing" : "Best-effort sharing"}
      {quality.summaryComplete ? ` · total deviation ${quality.totalDeviation ?? 0}` : " · sharing summary incomplete"}</Text> :
      <Text>Existing choices stay selected. Missing slots are filled when you continue.</Text>}
    {participants.map(p => {
      const actual = preview.assignments[p.id]?.length ?? 0;
      const target = preview.targetsByParticipantId[p.id] ?? 0;
      return <YStack key={p.id}>
        <ShellActionButton size="small" label={`${p.displayName}: ${actual}/${target} additional matches${target === 0 ? " · common match only" :
          actual < target ? ` · ${target - actual} to fill` : ""}`} onPress={() => setExpanded(value => value === p.id ? null : p.id)} />
        {expanded === p.id ? (preview.assignments[p.id] ?? []).map(id => <Text key={id}>{matchNames.get(id) ?? "Selected match"}</Text>) : null}
      </YStack>;
    })}
    {quality ? <>
      <Text>Select two players to inspect their shared additional matches.</Text>
      {participants.map(p => <ShellActionButton key={p.id} label={`${pair.includes(p.id) ? "✓ " : ""}${p.displayName}`}
        size="small" widthMode="fit" onPress={() => setPair(previous => previous.includes(p.id)
          ? previous.filter(id => id !== p.id) : [...previous.slice(-1), p.id])} />)}
      {overlap !== null ? <Text>{names.get(pair[0])} and {names.get(pair[1])} share {overlap} additional matches.</Text> : null}
    </> : null}
    {preview.requiresSharingConsent ? <>
      <Text>The pool is too small for exact sharing. Counts remain fixed. Allow relaxed sharing for this preview?</Text>
      <ShellActionButton label={consent ? "✓ Relaxed sharing accepted" : "Allow relaxed sharing"} disabled={isBusy}
        onPress={() => setConsent(value => !value)} />
    </> : null}
    <ShellActionButton label={actionLabel} disabled={isBusy || (preview.requiresSharingConsent && !consent)}
      onPress={() => onCommit(consent)} />
  </YStack>;
}
