import React from "react";
import TestRenderer from "react-test-renderer";
import RoomStatusModal from "../../../components/gameProgress/RoomStatusModal";
import { actCreate } from "../../../test-utils/render";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
import type { ActiveGameRoomSync } from "../../../features/rooms/useActiveGameRoomSync";

jest.mock("../../../platform/navigation/taskNavigation", () => ({
  TaskOverlay: ({ open, onClose, children }: any) => children({
    open, dismiss: onClose, runAfterDismiss: (action: () => void) => { onClose(); action(); },
  }),
}));

jest.mock("../../../components/ui", () => ({ ShellActionButton: "ShellActionButton" }));

describe("read-only room status", () => {
  it("offers direct Home recovery without granting any edit actions", () => {
    const onHome = jest.fn();
    const onClose = jest.fn();
    const renderer = actCreate(<TamaguiTestProvider><RoomStatusModal
      visible onClose={onClose} onHome={onHome}
      activeGame={{ status: "offline", snapshot: null } as ActiveGameRoomSync}
    /></TamaguiTestProvider>);
    TestRenderer.act(() => renderer.root.findByProps({ label: "Home" }).props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => renderer.unmount());
  });

  it.each([
    ["hydrating", "Loading your room status"],
    ["access_lost", "access has expired"],
    ["ended", "room has ended"],
    ["offline", "status is unavailable"],
  ] as const)("explains %s without rendering stale private status", (status, message) => {
    const onClose = jest.fn();
    const activeGame = { status, snapshot: { state: "private cached title" } } as unknown as ActiveGameRoomSync;
    const renderer = actCreate(<TamaguiTestProvider>
      <RoomStatusModal visible onClose={onClose} activeGame={activeGame} />
    </TamaguiTestProvider>);
    expect(JSON.stringify(renderer.toJSON())).toContain(message);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("private cached title");
    renderer.root.findByProps({ label: "Close room status" }).props.onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => renderer.unmount());
  });
});
