import React from "react";
import TestRenderer from "react-test-renderer";
import { BackHandler, Keyboard } from "react-native";

import { actCreate } from "../../../test-utils/render";
import { TaskOverlay as WebOverlay } from "../../../platform/navigation/TaskOverlay.web";
import { TaskOverlay as NativeOverlay } from "../../../platform/navigation/TaskOverlay.native";
import { getTaskOverlay } from "../../../platform/navigation/taskOverlayRegistry";
import { hasTaskOverlayOwner } from "../../../platform/navigation/taskNavigation.shared";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";
import TaskOverlayRoute from "../../../app/taskOverlay";

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = {};
let mockState = { index: 0, routes: [{ key: "owner" }] };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ getState: () => mockState }),
  useRootNavigationState: () => mockState,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => {
    const ReactLocal = jest.requireActual("react");
    ReactLocal.useEffect(callback, [callback]);
  },
}));

jest.mock("../../../components/ui", () => ({ ShellScreen: "ShellScreen", ShellActionButton: "ShellActionButton" }));

const panel = (controls: unknown) => React.createElement("View", { testID: "panel", ...controls as object });

describe("focused task navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canGoBack.mockReturnValue(true);
    mockState = { index: 0, routes: [{ key: "owner" }] };
  });

  it("finds a caller inside Expo's root wrapper instead of treating it as an expired panel", () => {
    expect(hasTaskOverlayOwner({ routes: [{ key: "__root", state: { routes: [{ key: "game" }] } }] }, "game")).toBe(true);
    expect(hasTaskOverlayOwner({ routes: [{ key: "__root", state: { routes: [{ key: "other" }] } }] }, "game")).toBe(false);
  });

  it("keeps the caller and current closure while the router owns Back, Close and Forward", async () => {
    const onClose = jest.fn();
    let owner = actCreate(<WebOverlay open onClose={onClose} fallbackHref="/gameProgress">{panel}</WebOverlay>);
    const id = mockRouter.push.mock.calls[0][0].params.overlayId;
    mockParams = { overlayId: id };
    mockState = { index: 1, routes: [{ key: "owner" }, { key: "overlay" }] };
    const host = actCreate(<TaskOverlayRoute />);
    expect(host.root.findByProps({ testID: "panel" }).props.open).toBe(true);
    const action = jest.fn();
    TestRenderer.act(() => host.root.findByProps({ testID: "panel" }).props.runAfterDismiss(action));
    TestRenderer.act(() => host.root.findByProps({ testID: "panel" }).props.dismiss());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
    await TestRenderer.act(async () => host.unmount());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);

    const latestClose = jest.fn();
    TestRenderer.act(() => owner.update(<WebOverlay open={false} onClose={latestClose} fallbackHref="/gameProgress">{panel}</WebOverlay>));
    const forwardHost = actCreate(<TaskOverlayRoute />);
    expect(forwardHost.root.findByProps({ testID: "panel" }).props.open).toBe(true);
    await TestRenderer.act(async () => forwardHost.unmount());
    expect(latestClose).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => owner.unmount());
    expect(getTaskOverlay(id)).toBeUndefined();
  });

  it("dismisses only the nested overlay and clears a removed owner registration", async () => {
    const closeOuter = jest.fn();
    const closeInner = jest.fn();
    const outer = actCreate(<WebOverlay open onClose={closeOuter} fallbackHref="/history">{panel}</WebOverlay>);
    const outerId = mockRouter.push.mock.calls.at(-1)![0].params.overlayId;
    mockParams = { overlayId: outerId };
    mockState = { index: 1, routes: [{ key: "owner" }, { key: "outer-overlay" }] };
    const outerHost = actCreate(<TaskOverlayRoute />);
    const inner = actCreate(<WebOverlay open onClose={closeInner} fallbackHref="/history">{panel}</WebOverlay>);
    const innerId = mockRouter.push.mock.calls.at(-1)![0].params.overlayId;
    mockParams = { overlayId: innerId };
    mockState = { index: 2, routes: [...mockState.routes, { key: "inner-overlay" }] };
    const innerHost = actCreate(<TaskOverlayRoute />);
    await TestRenderer.act(async () => innerHost.unmount());
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
    TestRenderer.act(() => inner.unmount());
    expect(getTaskOverlay(innerId)).toBeUndefined();
    await TestRenderer.act(async () => outerHost.unmount());
    expect(closeOuter).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => outer.unmount());
    expect(getTaskOverlay(outerId)).toBeUndefined();
  });

  it("reopens repeatedly without retaining registrations after owner unmount", () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      const owner = actCreate(<WebOverlay open onClose={jest.fn()} fallbackHref="/history">{panel}</WebOverlay>);
      const id = mockRouter.push.mock.calls.at(-1)![0].params.overlayId;
      expect(getTaskOverlay(id)).toBeDefined();
      TestRenderer.act(() => owner.unmount());
      expect(getTaskOverlay(id)).toBeUndefined();
    }
    expect(mockRouter.push).toHaveBeenCalledTimes(3);
  });

  it("explains a direct, dead or removed-owner registration and offers safe recovery", () => {
    mockRouter.canGoBack.mockReturnValue(false);
    mockParams = { overlayId: "missing", parent: "https://untrusted.example" };
    const host = actCreate(<TamaguiTestProvider><TaskOverlayRoute /></TamaguiTestProvider>);
    expect(host.root.findByProps({ label: "Home" })).toBeDefined();
    TestRenderer.act(() => host.root.findByProps({ label: "Home" }).props.onPress());
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/");
    TestRenderer.act(() => host.unmount());
  });

  it("lets native Back dismiss the keyboard first and cleans up its scoped listener", () => {
    let listener: ((event: any) => boolean | null | undefined) | undefined;
    const remove = jest.fn();
    const add = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_name, callback) => {
      listener = callback;
      return { remove };
    });
    const visible = jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
    const dismissKeyboard = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
    const onClose = jest.fn();
    const owner = actCreate(<NativeOverlay open onClose={onClose} fallbackHref="/history">{panel}</NativeOverlay>);
    expect(listener!({})).toBe(true);
    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    visible.mockReturnValue(false);
    expect(listener!({})).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => owner.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
    add.mockRestore(); visible.mockRestore(); dismissKeyboard.mockRestore();
  });
});
