import React from "react";
import { Image } from "react-native";
import { act } from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";
import LeagueFilter from "../../../components/setupGame/LeagueFilter";

jest.mock("../../../hooks/useLeagueLogo", () => ({
  useLeagueLogo: () => ({ logoSource: { uri: "league-logo" }, isLoading: false }),
}));
jest.mock("../../../styles/theme", () => ({ useColors: () => ({ textPrimary: "black" }) }));
jest.mock("../../../styles/setupGameStyles", () => ({ __esModule: true, default: () => ({}) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

it("keeps twenty selected leagues to three icons and an overflow count, with access to the full picker", () => {
  const leagues = Array.from({ length: 20 }, (_, index) => ({ code: `league-${index}`, name: `League ${index}` }));
  const tree = actCreate(<LeagueFilter availableLeagues={leagues} selectedLeagues={leagues} handleLeagueChange={jest.fn()} />);
  expect(tree.root.findAllByType(Image)).toHaveLength(3);
  expect(tree.root.findAllByProps({ children: "+17" }).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({ children: "20 leagues" }).length).toBeGreaterThan(0);
  act(() => tree.root.findByProps({ testID: "SetupLeagueToggle" }).props.onPress());
  expect(tree.root.findByProps({ testID: "SetupLeagueToggle" }).props.accessibilityState.expanded).toBe(true);
  expect(tree.root.findAllByType(Image)).toHaveLength(23);
  act(() => tree.unmount());
});
