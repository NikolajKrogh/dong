import React from "react";
import TestRenderer from "react-test-renderer";
import { useGameStore } from "../../store/store";
import { useGuestRoomEndedNavigation } from "../../hooks/useGuestRoomEndedNavigation";

const mockReplace = jest.fn();
let mockReady = false;
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useRootNavigationState: () => mockReady ? { key: "root" } : undefined,
}));

it("waits for navigation readiness and shows each termination only once", async () => {
  useGameStore.setState({ endedGuestSessionId: "room-1" });
  const Probe = () => { useGuestRoomEndedNavigation(); return null; };
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => { renderer = TestRenderer.create(React.createElement(Probe)); });
  expect(mockReplace).not.toHaveBeenCalled();
  mockReady = true;
  TestRenderer.act(() => renderer.update(React.createElement(Probe)));
  expect(mockReplace).toHaveBeenCalledWith("/roomEnded");
  TestRenderer.act(() => {
    useGameStore.setState({ endedGuestSessionId: "room-1" });
    renderer.update(React.createElement(Probe));
  });
  expect(mockReplace).toHaveBeenCalledTimes(1);
  await TestRenderer.act(async () => {
    useGameStore.setState({ endedGuestSessionId: "room-2" });
    renderer.update(React.createElement(Probe));
  });
  expect(mockReplace).toHaveBeenCalledTimes(2);
  TestRenderer.act(() => renderer.unmount());
});
