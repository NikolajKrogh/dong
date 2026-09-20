import React, { useMemo, useState } from "react";
import { Sheet } from "tamagui";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import type { GuestRoomSnapshot } from "../../types/guestRoom";
import type {
  ReassignParticipantMatchesResponse,
  RoomSnapshot,
} from "../../types/room";
import { useColors } from "../../styles/theme";
import { ShellActionButton } from "../ui";

type ActiveRoomSnapshot = RoomSnapshot | GuestRoomSnapshot;

interface ReassignmentControlProps {
  snapshot: ActiveRoomSnapshot;
  pending: boolean;
  disabled?: boolean;
  onReassign: (
    participantId: string,
    matchIds: string[],
  ) => Promise<ReassignParticipantMatchesResponse>;
}

/** Host-only assignment editor. The Tamagui sheet keeps the selection usable on native and web. */
export function ReassignmentControl({
  snapshot,
  pending,
  disabled = false,
  onReassign,
}: ReassignmentControlProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, width), [colors, width]);
  const [open, setOpen] = useState(false);
  const [sheetPosition, setSheetPosition] = useState(0);
  const [participantId, setParticipantId] = useState(
    snapshot.participants[0]?.id ?? "",
  );
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);

  const chooseParticipant = (id: string) => {
    if (disabled || pending) return;
    setParticipantId(id);
    setSelectedMatchIds(
      snapshot.assignments
        .filter(
          (assignment) =>
            assignment.participantId === id &&
            assignment.matchId !== snapshot.commonMatchId,
        )
        .map((assignment) => assignment.matchId),
    );
  };

  const openEditor = () => {
    if (disabled || pending || snapshot.state !== "in_progress") return;
    const firstParticipant = snapshot.participants[0]?.id ?? "";
    chooseParticipant(firstParticipant);
    setSheetPosition(0);
    setOpen(true);
  };

  const currentAssignments = snapshot.assignments
    .filter(
      (assignment) =>
        assignment.participantId === participantId &&
        assignment.matchId !== snapshot.commonMatchId,
    )
    .map((assignment) => assignment.matchId);
  const requiredCount = currentAssignments.length;
  const selectableMatches = snapshot.matches.filter(
    (match) => match.id !== snapshot.commonMatchId,
  );

  const toggleMatch = (matchId: string) => {
    if (disabled || pending) return;
    setSelectedMatchIds((current) =>
      current.includes(matchId)
        ? current.filter((id) => id !== matchId)
        : [...current, matchId],
    );
  };

  const submit = async () => {
    if (disabled || pending || selectedMatchIds.length !== requiredCount) return;
    await onReassign(participantId, selectedMatchIds);
    setOpen(false);
  };

  return (
    <>
      <ShellActionButton
        testID="ReassignMatchesButton"
        label="Reassign matches"
        widthMode="fit"
        size="small"
        variant="surface"
        disabled={disabled || pending || snapshot.state !== "in_progress"}
        onPress={openEditor}
      />
      <Sheet
        open={open}
        position={sheetPosition}
        onPositionChange={setSheetPosition}
        animation="quick"
        onOpenChange={(nextOpen: boolean) => {
          if (!disabled || !nextOpen) setOpen(nextOpen);
        }}
        modal
        dismissOnOverlayPress
        dismissOnSnapToBottom
        snapPoints={[80]}
        snapPointsMode="percent"
      >
        <Sheet.Overlay backgroundColor={colors.backgroundModalOverlay} />
        <Sheet.Handle />
        <Sheet.Frame testID="ReassignmentSheetFrame" style={styles.dialog}>
          <Text style={styles.title}>Reassign matches</Text>
          <Text style={styles.description}>
            Replace one participant&apos;s non-common matches. Accepted scores
            and drinks remain unchanged.
          </Text>

          <Text style={styles.label}>Participant</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {snapshot.participants.map((participant) => {
                const selected = participant.id === participantId;
                return (
                  <TouchableOpacity
                    key={participant.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    disabled={disabled || pending}
                    onPress={() => chooseParticipant(participant.id)}
                  >
                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                      {participant.displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.matchHeader}>
            <Text style={styles.label}>
              Matches ({selectedMatchIds.length}/{requiredCount})
            </Text>
            <Text style={styles.locked}>Common Match locked</Text>
          </View>
          <ScrollView style={styles.matchList}>
            {selectableMatches.map((match) => {
              const selected = selectedMatchIds.includes(match.id);
              const selectionDisabled =
                !selected && selectedMatchIds.length >= requiredCount;
              return (
                <TouchableOpacity
                  key={match.id}
                  testID={`ReassignmentMatch-${match.id}`}
                  style={[styles.match, selected && styles.matchSelected]}
                  disabled={disabled || pending || selectionDisabled}
                  onPress={() => toggleMatch(match.id)}
                >
                  <Text style={styles.matchText}>
                    {selected ? "✓ " : ""}
                    {match.homeTeamName} · {match.awayTeamName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancel}
              disabled={disabled || pending}
              onPress={() => setOpen(false)}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="ReassignmentSaveButton"
              style={styles.save}
              disabled={disabled || pending || selectedMatchIds.length !== requiredCount}
              onPress={() => void submit()}
            >
              <Text style={styles.saveText}>{pending ? "Saving…" : "Save assignments"}</Text>
            </TouchableOpacity>
          </View>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>, width: number) =>
  StyleSheet.create({
    dialog: {
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      width: Math.min(width - 32, 560),
    },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 8 },
    description: { color: colors.textSecondary, marginBottom: 16 },
    label: { color: colors.textPrimary, fontWeight: "600", marginBottom: 8 },
    row: { flexDirection: "row", gap: 8, marginBottom: 16 },
    chip: { borderColor: colors.border, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
    chipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    chipText: { color: colors.textSecondary },
    chipTextSelected: { color: colors.primaryDark, fontWeight: "600" },
    matchHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
    locked: { color: colors.textMuted, fontSize: 12 },
    matchList: { marginBottom: 16, marginTop: 4 },
    match: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: 8, padding: 12 },
    matchSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    matchText: { color: colors.textPrimary },
    actions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
    cancel: { padding: 12 },
    save: { backgroundColor: colors.primary, borderRadius: 8, padding: 12 },
    saveText: { color: colors.white, fontWeight: "600" },
  });
