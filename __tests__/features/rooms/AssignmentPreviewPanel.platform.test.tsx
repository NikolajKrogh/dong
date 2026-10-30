import React from "react";
import TestRenderer from "react-test-renderer";
import { Text } from "react-native";
import { actCreate } from "../../../test-utils/render";
import { AssignmentPreviewPanel } from "../../../features/rooms/AssignmentPreviewPanel";
import type { AssignmentPreview } from "../../../features/rooms/roomAssignments";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
jest.mock("../../../components/ui", () => ({ ShellActionButton: "ShellActionButton" }));

const participants = ["Alice", "Bob"].map(id => ({ id, displayName: id, membershipType: "registered" as const,
  sessionRole: "member" as const, currentDrinkTotal: 0 }));
const preview: AssignmentPreview = { assignments: { Alice: ["one"], Bob: ["one"] },
  targetsByParticipantId: { Alice: 1, Bob: 1 }, sharingPolicy: "relaxed", requiresSharingConsent: true, expiresAt: "2099-01-01",
  quality: { quality: "best_effort", summaryComplete: false, totalDeviation: null, exactPreferenceAchieved: null, reason: "time_limit" } };
function render() {
  const onCommit = jest.fn();
  const tree = actCreate(<TamaguiTestProvider><AssignmentPreviewPanel preview={preview} participants={participants}
    matches={[{ id: "one", homeTeam: "Home", awayTeam: "Away" }]} isBusy={false} onReview={() => {}} onCommit={onCommit} actionLabel="Start" /></TamaguiTestProvider>);
  return { tree, onCommit };
}
it("requires consent and resets it when the reviewed preview changes", () => {
  const { tree, onCommit } = render();
  expect(tree.root.findByProps({ label: "Start" }).props.disabled).toBe(true);
  TestRenderer.act(() => tree.root.findByProps({ label: "Allow relaxed sharing" }).props.onPress());
  expect(tree.root.findByProps({ label: "Start" }).props.disabled).toBe(false);
  TestRenderer.act(() => tree.root.findByProps({ label: "Start" }).props.onPress());
  expect(onCommit).toHaveBeenCalledWith(true);
  TestRenderer.act(() => tree.update(<TamaguiTestProvider><AssignmentPreviewPanel preview={{ ...preview, expiresAt: "2099-02-01" }} participants={participants}
    matches={[]} isBusy={false} onReview={() => {}} onCommit={onCommit} actionLabel="Start" /></TamaguiTestProvider>));
  expect(tree.root.findByProps({ label: "Start" }).props.disabled).toBe(true);
});
it("shows proposed matches, incomplete quality, and on-demand pair overlap", () => {
  const { tree } = render();
  TestRenderer.act(() => tree.root.findByProps({ label: "Alice: 1/1 additional matches" }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain("Home vs Away");
  expect(JSON.stringify(tree.toJSON())).toContain("sharing summary incomplete");
  TestRenderer.act(() => tree.root.findByProps({ label: "Alice" }).props.onPress());
  TestRenderer.act(() => tree.root.findByProps({ label: "Bob" }).props.onPress());
  const text = tree.root.findAllByType(Text).map(node => [node.props.children].flat().join("")).join(" ");
  expect(text).toContain("Alice and Bob share 1 additional matches.");
});
