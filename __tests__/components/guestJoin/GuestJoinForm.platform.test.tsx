import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

import { GuestJoinForm } from "../../../components/guestJoin/GuestJoinForm";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

jest.mock("../../../components/ui", () => ({
  ShellActionButton: ({ label, onPress, ...props }: any) => {
    const RN = require("react-native");
    const ReactLocal = require("react");

    return ReactLocal.createElement(
      RN.Pressable,
      { testID: "ShellActionButton", onPress, ...props },
      ReactLocal.createElement(RN.Text, null, label),
    );
  },
}));

describe("GuestJoinForm", () => {
  it("renders the room-code and guest-name inputs with the join action", () => {
    const tree = actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinForm, {
          joinCode: "ROOM42",
          guestName: "Casey",
          error: null,
          isSubmitting: false,
          retryMessage: null,
          submitLabel: "Join Room",
          onJoinCodeChange: jest.fn(),
          onGuestNameChange: jest.fn(),
          onSubmit: jest.fn(),
        }),
      ),
    );

    const { Text, TextInput } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);
    const inputs = tree.root.findAllByType(TextInput);

    expect(textContents).toContain("Room Code");
    expect(textContents).toContain("Guest Name");
    expect(textContents).toContain("Join Room");
    expect(inputs).toHaveLength(2);

    tree.unmount();
  });

  it("wires the submit action and renders an error message when provided", () => {
    const onSubmit = jest.fn();

    const tree = actCreate(
      React.createElement(
        TamaguiTestProvider,
        null,
        React.createElement(GuestJoinForm, {
          joinCode: "ROOM42",
          guestName: "Casey",
          error: "We couldn't find that room. Check the code and try again.",
          isSubmitting: false,
          retryMessage: "Update the room code or guest name and try again.",
          submitLabel: "Retry Join",
          onJoinCodeChange: jest.fn(),
          onGuestNameChange: jest.fn(),
          onSubmit,
        }),
      ),
    );

    const button = tree.root.findByProps({ testID: "ShellActionButton" });
    const { Text } = require("react-native");
    const textNodes = tree.root.findAllByType(Text);
    const textContents = textNodes.flatMap((node: any) => node.props.children);

    button.props.onPress();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(textContents).toContain(
      "We couldn't find that room. Check the code and try again.",
    );
    expect(textContents).toContain(
      "Update the room code or guest name and try again.",
    );
    expect(textContents).toContain("Retry Join");

    tree.unmount();
  });
});
