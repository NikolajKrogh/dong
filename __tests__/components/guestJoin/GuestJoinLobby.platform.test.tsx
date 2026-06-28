import React from "react";
import TestRenderer from "react-test-renderer";

import { GuestJoinLobby } from "../../../components/guestJoin/GuestJoinLobby";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

describe("GuestJoinLobby", () => {
  it("renders the joined room code, state, and participant summaries", () => {
    const tree = TestRenderer.create(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinLobby, {
          session: {
            grant: {
              guestToken: "guest-token-1",
              participantId: "guest-1",
              sessionId: "session-1",
              joinCode: "ROOM42",
              displayName: "Casey",
            },
            snapshot: {
              sessionId: "session-1",
              joinCode: "ROOM42",
              state: "joinable",
              commonMatchId: "match-1",
              participants: [
                {
                  id: "owner-1",
                  displayName: "Host Owner",
                  membershipType: "registered",
                  sessionRole: "owner",
                  currentDrinkTotal: 0,
                },
                {
                  id: "guest-1",
                  displayName: "Casey",
                  membershipType: "guest",
                  sessionRole: "member",
                  currentDrinkTotal: 0,
                },
              ],
              matches: [],
              assignments: [],
            },
          },
        }),
      ),
    );

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
});
