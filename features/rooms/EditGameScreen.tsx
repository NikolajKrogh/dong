import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import { ASSIGNMENT_MODE } from "../../types/room";
import SetupWizard from "../game-setup/SetupWizard";
import MatchList from "../game-setup/MatchList";
import CommonMatchSelector from "../game-setup/CommonMatchSelector";
import { AssignmentModeSelector } from "./AssignmentModeSelector";
import { AssignmentSettingsPanel } from "./AssignmentSettingsPanel";
import { RoomAssignmentPlayers } from "./RoomAssignmentPlayers";
import { RoomIdentityPanel } from "./RoomIdentityPanel";
import { AssignmentPreviewPanel } from "./AssignmentPreviewPanel";
import { useActiveGameRoomSync } from "./useActiveGameRoomSync";
import { useRunningGameDraft } from "./useRunningGameDraft";
import { isWideLayout } from "../../styles/responsive";
import { useColors } from "../../styles/theme";
import type { RoomSnapshot } from "../../types/room";
import { roomSnapshotHasAssignmentTargets } from "./roomSnapshotAdapter";

export default function EditGameScreen(): React.JSX.Element {
  const game = useActiveGameRoomSync();
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const { width } = useWindowDimensions();
  const ready = game.isHost && game.snapshot?.state === "in_progress";

  async function reload(): Promise<void> {
    const snapshot = await game.refresh();
    if (snapshot) setRevision(value => value + 1);
  }
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ShellScreen padded={false} centerContent={isWideLayout(width)} contentMaxWidth={isWideLayout(width) ? 1120 : undefined}>
        {ready && game.snapshot ? (
          <RunningGameEditor key={`${game.snapshot.sessionId}:${revision}`}
            snapshot={game.snapshot as RoomSnapshot} canEdit={game.isEditable}
            onReload={reload} onCancel={() => router.dismissTo("/gameProgress")}
            onSaved={snapshot => { game.acceptSnapshot(snapshot); router.dismissTo("/gameProgress"); }} />
        ) : (
          <YStack gap="$3" padding="$4">
            <Text>{game.status === "hydrating" ? "Loading game…" : "Only the current host can edit a running game."}</Text>
            <ShellActionButton label="Return to game" onPress={() => router.dismissTo("/gameProgress")} />
          </YStack>
        )}
      </ShellScreen>
    </SafeAreaView>
  );
}

function RunningGameEditor({ snapshot, canEdit, onSaved, onReload, onCancel }: {
  snapshot: RoomSnapshot;
  canEdit: boolean;
  onSaved: (snapshot: RoomSnapshot) => void;
  onReload: () => Promise<void>;
  onCancel: () => void;
}): React.JSX.Element {
  // Polls may update gameplay, but never replace an in-progress configuration draft.
  const [baseline] = useState(snapshot);
  const draft = useRunningGameDraft(baseline, snapshot);
  const [step, setStep] = useState("matches");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const colors = useColors();
  const busy = draft.isSaving || !canEdit;
  const controlsBusy = busy || draft.assignmentPreview.recoveryRequired;
  const selectable = draft.matches.filter(match => match.id !== baseline.commonMatchId);
  const commonMatch = draft.matches.filter(match => match.id === baseline.commonMatchId);

  async function save(acceptRelaxedSharing = false): Promise<void> {
    if (busy) return;
    const saved = await draft.save(acceptRelaxedSharing);
    if (saved) onSaved(saved);
  }
  if (!roomSnapshotHasAssignmentTargets(baseline)) return <RunningGameEditorUnavailable onReload={onReload} />;
  return <RunningGameEditorView baseline={baseline} draft={draft} step={step} setStep={setStep}
    homeTeam={homeTeam} awayTeam={awayTeam} setHomeTeam={setHomeTeam} setAwayTeam={setAwayTeam}
    selectable={selectable} commonMatch={commonMatch} busy={busy} controlsBusy={controlsBusy}
    colors={colors} onCancel={onCancel} onReload={onReload} onSave={save} />;
}

function RunningGameEditorUnavailable({ onReload }: { onReload: () => Promise<void> }): React.JSX.Element {
  return <YStack padding="$4" gap="$3">
    <Text accessibilityRole="alert">Player counts are unavailable. Reload the room before editing.</Text>
    <ShellActionButton label="Reload room" onPress={() => { void onReload(); }} />
  </YStack>;
}

type RunningGameDraft = ReturnType<typeof useRunningGameDraft>;

function RunningGameEditorView({ baseline, draft, step, setStep, homeTeam, awayTeam, setHomeTeam, setAwayTeam,
  selectable, commonMatch, busy, controlsBusy, colors, onCancel, onReload, onSave }: {
  baseline: RoomSnapshot;
  draft: RunningGameDraft;
  step: string;
  setStep: React.Dispatch<React.SetStateAction<string>>;
  homeTeam: string;
  awayTeam: string;
  setHomeTeam: React.Dispatch<React.SetStateAction<string>>;
  setAwayTeam: React.Dispatch<React.SetStateAction<string>>;
  selectable: RunningGameDraft["matches"];
  commonMatch: RunningGameDraft["matches"];
  busy: boolean;
  controlsBusy: boolean;
  colors: ReturnType<typeof useColors>;
  onCancel: () => void;
  onReload: () => Promise<void>;
  onSave: (acceptRelaxedSharing?: boolean) => Promise<void>;
}): React.JSX.Element {
  return <YStack flex={1}>
    <XStack alignItems="center" justifyContent="space-between" paddingHorizontal="$4" paddingTop="$2">
      <Text fontSize={18} fontWeight="700" color="$color">Edit game</Text>
      <ShellActionButton label="Cancel" size="small" widthMode="fit" disabled={draft.isSaving} onPress={onCancel} />
    </XStack>
    <RunningGameDraftStatus baseline={baseline} draft={draft} onReload={onReload} />
    <SetupWizard activeStepKey={step} onStepChange={setStep} onStepBack={setStep}
      firstSlotAction={{ label: "Cancel", icon: "close", onPress: onCancel, disabled: draft.isSaving }}
      finalAction={{ label: getRunningGameFinalActionLabel(draft), icon: "checkmark", testID: "EditGameSave",
        disabled: busy || !draft.canSave, backgroundColor: colors.success,
        onPress: () => handleRunningGameFinalAction(draft, setStep, onSave) }}
      steps={[
        { key: "room", name: "Room", icon: "people", canEnter: true,
          content: <YStack padding="$4" gap="$3"><RoomIdentityPanel joinCode={baseline.joinCode} participants={draft.participants} /></YStack> },
        { key: "matches", name: "Matches", icon: "game-controller-outline", canEnter: true,
          content: <MatchList matches={draft.matches} fixedMatchIds={draft.fixedMatchIds}
            homeTeam={homeTeam} awayTeam={awayTeam} setHomeTeam={setHomeTeam} setAwayTeam={setAwayTeam}
            setGlobalMatches={draft.updateMatches} disableSelection={busy}
            handleRemoveMatch={id => draft.updateMatches(draft.matches.filter(match => match.id !== id))} /> },
        { key: "common", name: "Common", icon: "tv-outline", canEnter: true,
          content: <YStack gap="$2"><Text padding="$4" color="$colorMuted">The common match stays fixed during the game.</Text>
            <CommonMatchSelector matches={commonMatch} readOnly selectedCommonMatch={baseline.commonMatchId} handleSelectCommonMatch={() => undefined} />
          </YStack> },
        { key: "assign", name: "Assign", icon: "git-network", canEnter: true,
          content: <RunningGameAssignmentStep draft={draft} selectable={selectable} controlsBusy={controlsBusy}
            busy={busy} onSave={onSave} /> },
      ]} />
  </YStack>;
}

function RunningGameDraftStatus({ baseline, draft, onReload }: {
  baseline: RoomSnapshot;
  draft: RunningGameDraft;
  onReload: () => Promise<void>;
}): React.JSX.Element {
  return <>
    {draft.error ? <YStack paddingHorizontal="$4" gap="$2">
      <Text accessibilityRole="alert" color="$danger">{draft.error}</Text>
      {draft.hasConflict ? <ShellActionButton label="Reload room (discard edits)" onPress={() => { void onReload(); }} /> : null}
    </YStack> : null}
    {!baseline.configurationToken ? <Text accessibilityRole="alert">This server must be updated before running games can be edited.</Text> : null}
  </>;
}

function getRunningGameFinalActionLabel(draft: RunningGameDraft): string {
  if (draft.isSaving) return "Saving…";
  return draft.supportsTargets && !draft.supportsEditable ? "Review changes" : "Save changes";
}

function handleRunningGameFinalAction(draft: RunningGameDraft, setStep: React.Dispatch<React.SetStateAction<string>>,
  onSave: (acceptRelaxedSharing?: boolean) => Promise<void>): void {
  if (draft.supportsEditable || !draft.supportsTargets) {
    void onSave();
    return;
  }
  setStep("assign");
  void draft.assignmentPreview.review();
}

function RunningGameAssignmentStep({ draft, selectable, controlsBusy, busy, onSave }: {
  draft: RunningGameDraft;
  selectable: RunningGameDraft["matches"];
  controlsBusy: boolean;
  busy: boolean;
  onSave: (acceptRelaxedSharing?: boolean) => Promise<void>;
}): React.JSX.Element {
  return <YStack padding="$4" gap="$4">
    <AssignmentModeSelector showHelp={!draft.supportsEditable} allowPlayerPicked={false} assignmentMode={draft.mode} isBusy={controlsBusy}
      onSelectMode={mode => { if (mode !== ASSIGNMENT_MODE.playerPicked) draft.setMode(mode); }} />
    {!draft.supportsEditable || draft.mode === ASSIGNMENT_MODE.automatic ? <AssignmentSettingsPanel editing plan={draft.plan} mode={draft.mode} isBusy={controlsBusy} onChange={draft.setSettings}
      onRandomize={draft.supportsEditable ? draft.randomizeAssignments : undefined} hasRandomized={draft.assignmentPreview.hasRandomized} /> : null}
    <RoomAssignmentPlayers editable={draft.supportsEditable} participants={draft.participants} matches={selectable}
      targetsByParticipantId={draft.plan.targetsByParticipantId}
      onSetPlayerMatchCount={draft.supportsTargets ? draft.setPlayerMatchCount : undefined}
      matchesPerPlayer={draft.supportsEditable ? draft.plan.matchesPerPlayer : draft.plan.effectivePerPlayer} isBusy={controlsBusy} pending={draft.mode === ASSIGNMENT_MODE.automatic} pendingLabel="On save"
      selectedMatchIdsFor={id => draft.assignments.filter(a => a.participantId === id).map(a => a.matchId)}
      onToggleAllocation={draft.supportsEditable || draft.mode === ASSIGNMENT_MODE.hostAssigned ? draft.toggleAssignment : undefined} />
    {draft.assignmentPreview.issue === "confirmation_required" ? <ShellActionButton label="Accept relaxed sharing" onPress={() => { void onSave(true); }} /> : null}
    {!draft.plan.feasible ? <Text color="$danger">Add more matches or lower the assignment count before saving.</Text> : null}
    {!draft.supportsEditable && draft.supportsTargets ? <AssignmentPreviewPanel preview={draft.assignmentPreview.preview} participants={draft.participants} matches={selectable}
      isBusy={controlsBusy} commitBusy={busy} onReview={() => { void draft.assignmentPreview.review(); }} actionLabel="Save these assignments"
      onCommit={accept => { void onSave(accept); }} /> : null}
  </YStack>;
}
