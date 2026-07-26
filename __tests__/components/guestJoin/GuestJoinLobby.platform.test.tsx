import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

import { GuestJoinLobby } from "../../../components/guestJoin/GuestJoinLobby";
import type { GuestRoomSession } from "../../../types/guestRoom";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

const GRANT = {
  guestToken: "guest-token-1",
  participantId: "guest-1",
  sessionId: "session-1",
  joinCode: "ROOM42",
  displayName: "Casey",
};

const PARTICIPANTS = [
  {
    id: "owner-1",
    displayName: "Host Owner",
    membershipType: "registered" as const,
    sessionRole: "owner" as const,
    currentDrinkTotal: 0,
  },
  {
    id: "guest-1",
    displayName: "Casey",
    membershipType: "guest" as const,
    sessionRole: "member" as const,
    currentDrinkTotal: 0,
  },
];

const MATCHES = [
  {
    id: "match-1",
    sourceProvider: "espn",
    sourceMatchId: "e1",
    homeTeamName: "Arsenal",
    awayTeamName: "Chelsea",
    kickoffAt: null,
    homeScore: 0,
    awayScore: 0,
  },
  {
    id: "match-2",
    sourceProvider: "espn",
    sourceMatchId: "e2",
    homeTeamName: "Liverpool",
    awayTeamName: "Spurs",
    kickoffAt: null,
    homeScore: 0,
    awayScore: 0,
  },
];

const buildSession = (snapshotOverrides: Record<string, unknown> = {}) => ({
  grant: GRANT,
  snapshot: {
    sessionId: "session-1",
    joinCode: "ROOM42",
    state: "joinable" as const,
    commonMatchId: "match-1",
    assignmentMode: "automatic" as const,
    participants: PARTICIPANTS,
    matches: MATCHES,
    assignments: [],
    picks: [],
    assignmentPlan: {
      participantCount: 2,
      poolSize: 2,
      matchesPerPlayer: 1,
      sharedMatchesPerPair: 0,
      effectivePerPlayer: 1,
      requiredPoolSize: 2,
      relaxedFloor: 2,
      feasible: false,
      startable: false,
    },
    ...snapshotOverrides,
  },
});

const renderLobby = (props: Record<string, unknown> = {}) =>
  actCreate(
    React.createElement(
      TamaguiTestProvider,
      null,
      React.createElement(GuestJoinLobby, {
        session: buildSession(),
        ...props,
      }),
    ),
  );

describe("GuestJoinLobby", () => {
  it("renders the joined room code, state, and participant summaries", () => {
    const tree = renderLobby();

    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);
    const renderedText = textContents.join("");

    expect(renderedText).toContain("Guest Room");
    expect(renderedText).not.toContain("ROOM42");
    expect(renderedText).toContain("Current state: joinable");
    expect(renderedText).toContain(
      "You are connected as Casey. Guest access is temporary and only applies to this room on this device.",
    );
    expect(renderedText).toContain("Host Owner · registered");
    expect(renderedText).toContain("Casey · guest");

    tree.unmount();
  });
  // Before #185 a guest's room view had no actions at all. The panel must appear
  // only in player-picked mode, and only while the room is still joinable.
  it("shows no pick panel outside player-picked mode", () => {
    const tree = renderLobby({ onSetPicks: jest.fn() });

    expect(
      tree.root.findAllByProps({ testID: "guest-player-pick-panel" }),
    ).toHaveLength(0);

    tree.unmount();
  });

  it("shows the pick panel to a guest in a joinable player-picked room", () => {
    const tree = actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinLobby, {
          session: buildSession({ assignmentMode: "player_picked" }),
          onSetPicks: jest.fn(),
        }),
      ),
    );

    expect(
      tree.root.findAllByProps({ testID: "guest-player-pick-panel" }).length,
    ).toBeGreaterThan(0);

    tree.unmount();
  });

  it("hides the pick panel once the room has left the lobby", () => {
    const tree = actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinLobby, {
          session: buildSession({
            assignmentMode: "player_picked",
            state: "in_play",
          }),
          onSetPicks: jest.fn(),
        }),
      ),
    );

    expect(
      tree.root.findAllByProps({ testID: "guest-player-pick-panel" }),
    ).toHaveLength(0);

    tree.unmount();
  });

  it("hides the pick panel when no pick handler is wired up", () => {
    const tree = actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinLobby, {
          session: buildSession({ assignmentMode: "player_picked" }),
        }),
      ),
    );

    expect(
      tree.root.findAllByProps({ testID: "guest-player-pick-panel" }),
    ).toHaveLength(0);

    tree.unmount();
  });

  // FR-042: a guest sees every participant's progress, not only their own.
  it("shows each participant's pick progress in player-picked mode", () => {
    const tree = actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinLobby, {
          session: buildSession({
            assignmentMode: "player_picked",
            picks: [{ participantId: "guest-1", matchId: "match-2" }],
          }),
          onSetPicks: jest.fn(),
        }),
      ),
    );

    const { Text } = require("react-native");
    const renderedText = tree.root
      .findAllByType(Text)
      .flatMap((node: any) => node.props.children)
      .join("");

    expect(renderedText).toContain("1/1 picked");
    expect(renderedText).toContain("0/1 picked");

    tree.unmount();
  });
  it("stops showing pick progress once the room has started", () => {
    const tree = actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinLobby, {
          session: buildSession({
            assignmentMode: "player_picked",
            state: "in_play",
            picks: [{ participantId: "guest-1", matchId: "match-2" }],
          }),
          onSetPicks: jest.fn(),
        }),
      ),
    );

    const { Text } = require("react-native");
    const renderedText = tree.root
      .findAllByType(Text)
      .flatMap((node: any) => node.props.children)
      .join("");

    // Picks persist as joinable-era residue after settlement, so progress must
    // not keep implying they still decide anything.
    expect(renderedText).not.toContain("picked");

    tree.unmount();
  });
  // Regression: a client can meet a server that predates migration 038, whose
  // snapshot simply omits `picks` (and, on an older server still,
  // `assignmentPlan`). This crashed the guest card with
  // "can't access property filter, snapshot.picks is undefined" -- caught by
  // running the app on web against an un-migrated project, not by any test.
  it("renders against a snapshot from a server without the picks field", () => {
    const { picks, assignmentPlan, ...legacySnapshot } = buildSession({
      assignmentMode: "player_picked",
    }).snapshot;
    void picks;
    void assignmentPlan;

    const tree = actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinLobby, {
          // Cast is the point of the test: this shape does NOT satisfy
          // GuestRoomSession, because a pre-038 server does not send those keys.
          // The type describes the post-migration contract; the runtime can be
          // behind it.
          session: {
            grant: GRANT,
            snapshot: legacySnapshot,
          } as unknown as GuestRoomSession,
          onSetPicks: jest.fn(),
        }),
      ),
    );

    const { Text } = require("react-native");
    const renderedText = tree.root
      .findAllByType(Text)
      .flatMap((node: any) => node.props.children)
      .join("");

    // The card still renders; the pick affordances simply stay hidden until the
    // server can actually accept picks.
    expect(renderedText).toContain("Guest Room");
    expect(
      tree.root.findAllByProps({ testID: "guest-player-pick-panel" }),
    ).toHaveLength(0);
    expect(renderedText).not.toContain("picked");

    tree.unmount();
  });
});
