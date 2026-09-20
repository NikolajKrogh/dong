import React from "react";
import TestRenderer from "react-test-renderer";

import { actCreate } from "../../../test-utils/render";
import type { RoomSnapshot } from "../../../types/room";

let mockSheetProps: Record<string, unknown> = {};

jest.mock("../../../styles/theme", () => ({
  useColors: () => ({
    backgroundModalOverlay: "rgba(0,0,0,.5)",
    surface: "#fff",
    textPrimary: "#111",
    textSecondary: "#333",
    textMuted: "#666",
    border: "#ccc",
    primaryLight: "#def",
    primary: "#08f",
    primaryDark: "#036",
    white: "#fff",
  }),
}));

jest.mock("../../../components/ui", () => {
  const ReactModule = jest.requireActual("react") as typeof React;
  const { Text, TouchableOpacity } = jest.requireActual("react-native") as {
    Text: React.ComponentType<React.ComponentProps<typeof import("react-native").Text>>;
    TouchableOpacity: React.ComponentType<React.ComponentProps<typeof import("react-native").TouchableOpacity>>;
  };
  const ShellActionButton = (props: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
  }) =>
    ReactModule.createElement(
      TouchableOpacity,
      { ...props, accessibilityRole: "button" },
      ReactModule.createElement(Text, null, props.label),
    );
  return { ShellActionButton };
});

jest.mock("tamagui", () => {
  const ReactModule = jest.requireActual("react") as typeof React;
  const Sheet = ({
    open,
    children,
    ...props
  }: {
    open: boolean;
    children: React.ReactNode;
    snapPoints?: number[];
    snapPointsMode?: string;
  }) => {
    mockSheetProps = { open, ...props };
    return open ? ReactModule.createElement(ReactModule.Fragment, null, children) : null;
  };
  Object.assign(Sheet, {
    Overlay: () => null,
    Handle: () => null,
    Frame: ({ children, ...props }: { children: React.ReactNode; testID?: string }) =>
      ReactModule.createElement("View", props, children),
  });
  return { Sheet };
});

const snapshot: RoomSnapshot = {
  sessionId: "room-1",
  joinCode: "ROOM1",
  state: "in_progress",
  ownerParticipantId: "p1",
  lastEventSequence: 4,
  commonMatchId: "common",
  assignmentMode: "automatic",
  participants: [
    {
      id: "p1",
      displayName: "Alice",
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 0,
    },
    {
      id: "p2",
      displayName: "Bob",
      membershipType: "registered",
      sessionRole: "member",
      currentDrinkTotal: 0,
    },
  ],
  matches: [
    {
      id: "common",
      sourceProvider: "manual",
      sourceMatchId: "common",
      homeTeamName: "Common Home",
      awayTeamName: "Common Away",
      kickoffAt: null,
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: "m1",
      sourceProvider: "manual",
      sourceMatchId: "m1",
      homeTeamName: "Arsenal",
      awayTeamName: "Chelsea",
      kickoffAt: null,
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: "m2",
      sourceProvider: "manual",
      sourceMatchId: "m2",
      homeTeamName: "Liverpool",
      awayTeamName: "Everton",
      kickoffAt: null,
      homeScore: 0,
      awayScore: 0,
    },
  ],
  assignments: [
    { participantId: "p1", matchId: "common" },
    { participantId: "p1", matchId: "m1" },
    { participantId: "p2", matchId: "common" },
    { participantId: "p2", matchId: "m2" },
  ],
  picks: [],
  assignmentPlan: {
    participantCount: 2,
    poolSize: 3,
    matchesPerPlayer: 1,
    sharedMatchesPerPair: 0,
    effectivePerPlayer: 1,
    requiredPoolSize: 3,
    relaxedFloor: 2,
    feasible: true,
    startable: true,
  },
};

describe("ReassignmentControl", () => {
  const textFromValue = (value: unknown): string => {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(textFromValue).join("");
    }
    if (value && typeof value === "object" && "props" in value) {
      return textFromValue((value as { props?: { children?: unknown } }).props?.children);
    }
    return "";
  };

  it("locks Common Match, preserves the exact slot count, and submits selection", async () => {
    const onReassign = jest.fn().mockResolvedValue({
      sessionId: "room-1",
      participantId: "p1",
      addedMatchIds: [],
      removedMatchIds: [],
      matchIds: ["m1"],
      sequenceNumber: 5,
    });
    const ReassignmentControl =
      require("../../../components/gameProgress/ReassignmentControl").ReassignmentControl;
    const renderer = actCreate(
      React.createElement(ReassignmentControl, {
        snapshot,
        pending: false,
        onReassign,
      }),
    );

    expect(mockSheetProps.snapPoints).toEqual([80]);
    expect(mockSheetProps.snapPointsMode).toBe("percent");
    expect(mockSheetProps.animation).toBe("quick");

    const openButton = renderer.root.findByProps({ testID: "ReassignMatchesButton" });
    TestRenderer.act(() => openButton.props.onPress());

    expect(renderer.root.findByProps({ testID: "ReassignmentSheetFrame" })).toBeDefined();

    const includesText = (needle: string) =>
      renderer.root.findAll((node) => {
        const children = node.props?.children;
        const content = Array.isArray(children)
          ? children.join("")
          : String(children ?? "");
        return content.includes(needle);
      }).length > 0;
    expect(renderer.root.findAllByProps({ children: "Common Match locked" }).length).toBeGreaterThan(0);
    expect(includesText("Common Home")).toBe(false);
    expect(includesText("Arsenal · Chelsea")).toBe(true);
    expect(includesText("Liverpool · Everton")).toBe(true);

    const save = renderer.root.findAll(
      (node) =>
        typeof node.props?.onPress === "function" &&
        textFromValue(node.props?.children).includes("Save assignments"),
    )[0];
    await TestRenderer.act(async () => {
      save.props.onPress();
      await Promise.resolve();
    });

    expect(onReassign).toHaveBeenCalledWith("p1", ["m1"]);
    expect(renderer.root.findAllByProps({ children: "Common Match locked" })).toHaveLength(0);
  });

  it("disables the editor while a reassignment is pending", () => {
    const ReassignmentControl =
      require("../../../components/gameProgress/ReassignmentControl").ReassignmentControl;
    const renderer = actCreate(
      React.createElement(ReassignmentControl, {
        snapshot,
        pending: true,
        onReassign: jest.fn(),
      }),
    );

    const button = renderer.root.findByProps({ testID: "ReassignMatchesButton" });
    expect(button.props.disabled).toBe(true);
  });

  it("disables the editor when the active game is not editable", () => {
    const ReassignmentControl =
      require("../../../components/gameProgress/ReassignmentControl").ReassignmentControl;
    const renderer = actCreate(
      React.createElement(ReassignmentControl, {
        snapshot,
        pending: false,
        disabled: true,
        onReassign: jest.fn(),
      }),
    );

    const button = renderer.root.findByProps({ testID: "ReassignMatchesButton" });
    expect(button.props.disabled).toBe(true);
  });
});
