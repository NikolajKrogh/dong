import React from "react";
import { Platform } from "react-native";
import { act } from "react-test-renderer";

import { actCreate } from "../../test-utils/render";

const mockUsePathname = jest.fn(() => "/");

jest.mock("../../platform/connectivity", () => ({ subscribeConnectivity: () => () => {} }));

jest.mock("expo-router", () => ({
  usePathname: () => mockUsePathname(),
  useRootNavigationState: () => ({ key: "root" }),
  useRouter: () => ({ replace: jest.fn() }),
  Stack: Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    { Screen: () => null }
  ),
}));

jest.mock("expo-router/head", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));

jest.mock("react-native-toast-message", () => {
  const ReactLocal = require("react");
  return {
    __esModule: true,
    default: () => ReactLocal.createElement("Toast"),
  };
});

jest.mock("../../features/game-setup/RandomMatchesToast", () => ({}));
jest.mock("../../features/game-progress/GoalToast", () => ({
  goalToastConfig: { success: () => null },
}));

jest.mock("../../platform", () => ({
  PlatformGestureRoot: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock("../../store/store", () => ({
  useGameStore: Object.assign(
    (selector: (s: any) => any) =>
      selector({ theme: "light" }),
    { getState: () => ({ theme: "light" }) }
  ),
}));

it("keeps navigation and Toast inside the gesture root and themed provider", () => {
  const Layout = require("../../app/_layout").default;
  const { TamaguiAppProvider } = require("../../components/ui");
  const { PlatformGestureRoot } = require("../../platform");
  const { Stack } = require("expo-router");
  const tree = actCreate(<Layout />);
  const provider = tree.root.findByType(TamaguiAppProvider);
  const gestures = provider.findByType(PlatformGestureRoot);

  expect(gestures.findByType(Stack).props.initialRouteName).toBe("index");
  expect(gestures.findAllByType("Toast" as React.ElementType)).toHaveLength(1);
});

it('updates the browser title when the current route changes', () => {
  const previousPlatform = Platform.OS;
  Platform.OS = 'web';
  try {
    const Layout = require('../../app/_layout').default;
    const tree = actCreate(<Layout />);
    expect(tree.root.findByType('title' as React.ElementType).props.children).toBe('Home · DONG');
    mockUsePathname.mockReturnValue('/history');
    act(() => tree.update(<Layout />));
    expect(tree.root.findByType('title' as React.ElementType).props.children).toBe('History · DONG');
    mockUsePathname.mockReturnValue('/lobby/room-fixture');
    act(() => tree.update(<Layout />));
    expect(tree.root.findByType('title' as React.ElementType).props.children).toBe('Room · DONG');
    act(() => tree.unmount());
  } finally {
    Platform.OS = previousPlatform;
    mockUsePathname.mockReturnValue('/');
  }
});
