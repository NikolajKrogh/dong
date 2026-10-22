import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";
import { ShellActionButton, ShellScreen } from "../components/ui";
import SetupWizard from "../components/setupGame/SetupWizard";
import MatchList from "../components/setupGame/MatchList";
import CommonMatchSelector from "../components/setupGame/CommonMatchSelector";
import { AssignmentModeSelector } from "../components/lobby/AssignmentModeSelector";
import { AssignmentSettingsPanel } from "../components/lobby/AssignmentSettingsPanel";
import { RoomAssignmentPlayers } from "../components/lobby/RoomAssignmentPlayers";
import { RoomIdentityPanel } from "../components/lobby/RoomIdentityPanel";
import { useActiveGameRoomSync } from "../hooks/useActiveGameRoomSync";
import { useRunningGameDraft } from "../hooks/useRunningGameDraft";
import { isWideLayout } from "../styles/responsive";
import { useColors } from "../styles/theme";
import type { RoomSnapshot } from "../types/room";

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
  const draft = useRunningGameDraft(baseline);
  const [step, setStep] = useState("matches");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const colors = useColors();
  const busy = draft.isSaving || !canEdit;
  const selectable = draft.matches.filter(match => match.id !== baseline.commonMatchId);
  const commonMatch = draft.matches.filter(match => match.id === baseline.commonMatchId);

  async function save(): Promise<void> {
    if (busy) return;
    const saved = await draft.save();
    if (saved) onSaved(saved);
  }
  return <YStack flex={1}>
    <XStack alignItems="center" justifyContent="space-between" paddingHorizontal="$4" paddingTop="$2">
      <Text fontSize={18} fontWeight="700" color="$color">Edit game</Text>
      <ShellActionButton label="Cancel" size="small" widthMode="fit" disabled={draft.isSaving} onPress={onCancel} />
    </XStack>
    {draft.error ? <YStack paddingHorizontal="$4" gap="$2">
      <Text accessibilityRole="alert" color="$danger">{draft.error}</Text>
      {draft.hasConflict ? <ShellActionButton label="Reload room (discard edits)" onPress={() => { void onReload(); }} /> : null}
    </YStack> : null}
    {!baseline.configurationToken ? <Text accessibilityRole="alert">This server must be updated before running games can be edited.</Text> : null}
    <SetupWizard activeStepKey={step} onStepChange={setStep} onStepBack={setStep}
      firstSlotAction={{ label: "Cancel", icon: "close", onPress: onCancel, disabled: draft.isSaving }}
      finalAction={{ label: draft.isSaving ? "Saving…" : "Save changes", icon: "checkmark", testID: "EditGameSave",
        disabled: busy || !draft.canSave, backgroundColor: colors.success, onPress: () => { void save(); } }}
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
          content: <YStack padding="$4" gap="$4">
            <AssignmentModeSelector allowPlayerPicked={false} assignmentMode={draft.mode} isBusy={busy} onSelectMode={mode => { if (mode !== "player_picked") draft.setMode(mode); }} />
            <AssignmentSettingsPanel editing plan={draft.plan} mode={draft.mode} isBusy={busy} onChange={draft.setSettings} />
            <RoomAssignmentPlayers participants={draft.participants} matches={selectable}
              matchesPerPlayer={draft.plan.effectivePerPlayer} isBusy={busy} pending={draft.mode === "automatic"} pendingLabel="On save"
              selectedMatchIdsFor={id => draft.assignments.filter(a => a.participantId === id).map(a => a.matchId)}
              onToggleAllocation={draft.mode === "host_assigned" ? draft.toggleAssignment : undefined} />
            {!draft.plan.feasible ? <Text color="$danger">Add more matches or lower the assignment count before saving.</Text> : null}
          </YStack> },
      ]} />
  </YStack>;
}
