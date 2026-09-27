import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, BackHandler } from "react-native";
import { useRoomEndedExit } from "../../platform/navigation/useRoomEndedExit";

let mockInteractive = true;
jest.mock("../../platform/visibility/useAppVisibility", () => ({
  useAppVisibility: () => ({ isInteractive: mockInteractive }),
}));

const onExit = jest.fn();
let state: ReturnType<typeof useRoomEndedExit>;
function Probe() {
  const value = useRoomEndedExit(onExit);
  React.useEffect(() => { state = value; }, [value]);
  return null;
}
let renderer: TestRenderer.ReactTestRenderer;
let back: () => boolean;
let readerChanged: (enabled: boolean) => void;
const mount = async () => { await act(async () => { renderer = TestRenderer.create(React.createElement(Probe)); }); };
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  mockInteractive = true;
  onExit.mockClear();
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((_name: string, handler: (enabled: boolean) => void) => {
    readerChanged = handler;
    return { remove: jest.fn() };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_name, handler) => {
    back = handler as () => boolean;
    return { remove: jest.fn() };
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("waits for accessibility detection, then counts five visible seconds", async () => {
  let resolve!: (value: boolean) => void;
  jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockReturnValue(new Promise((done) => { resolve = done; }));
  await mount();
  advance(10000);
  expect(onExit).not.toHaveBeenCalled();
  await act(async () => resolve(false));
  advance(2000);
  expect(state.seconds).toBe(3);
  mockInteractive = false;
  act(() => renderer.update(React.createElement(Probe)));
  advance(10000);
  expect(onExit).not.toHaveBeenCalled();
  mockInteractive = true;
  act(() => renderer.update(React.createElement(Probe)));
  advance(2900);
  expect(onExit).not.toHaveBeenCalled();
  advance(100);
  expect(onExit).toHaveBeenCalledTimes(1);
});

it("keeps screen reader users on screen until they choose Home", async () => {
  jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
  await mount();
  advance(10000);
  expect(state.automatic).toBe(false);
  expect(onExit).not.toHaveBeenCalled();
  act(() => state.exit());
  expect(onExit).toHaveBeenCalledTimes(1);
});

it("stops automatic dismissal when a screen reader is enabled", async () => {
  await mount();
  advance(1000);
  act(() => readerChanged(true));
  advance(10000);
  expect(onExit).not.toHaveBeenCalled();
});

it("handles Android Back once and cleans timers on unmount", async () => {
  await mount();
  act(() => { expect(back()).toBe(true); state.exit(); });
  expect(onExit).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
  advance(10000);
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("uses manual dismissal if accessibility detection fails", async () => {
  jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockRejectedValue(new Error("unavailable"));
  await mount();
  advance(10000);
  expect(state.automatic).toBe(false);
  expect(onExit).not.toHaveBeenCalled();
});
