
import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../test-utils/render";

const mockReplace = jest.fn();
const mockParams = { returnTo: "/userPreferences/profile" };

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../../hooks/useAccountAuth", () => ({
  normalizeAccountFlowReturnTo: (value: string) => value?.startsWith("/") ? value : null,
}));

jest.mock("../../components/preferences/SettingsPage", () => ({ title, children, onBack }: any) => {
  const R = require("react");
  const RN = require("react-native");
  return R.createElement(RN.View, null,
    R.createElement(RN.Text, { onPress: onBack, testID: "back" }, title), children);
});

jest.mock("../../components/auth/ChangePasswordForm", () => () => null);

it("returns from password changes to the Profile page", () => {
  const Screen = require("../../app/auth/change-password").default;
  const tree = actCreate(React.createElement(Screen));
  TestRenderer.act(() => tree.root.findByProps({ testID: "back" }).props.onPress());
  expect(mockReplace).toHaveBeenCalledWith("/userPreferences/profile");
  TestRenderer.act(() => tree.unmount());
});
