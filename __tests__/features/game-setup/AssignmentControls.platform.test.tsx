import React from "react";
import { act } from "react-test-renderer";
import { AssignmentCounter } from "../../../features/game-setup/AssignmentControls";
import { ShellActionButton } from "../../../components/ui/ShellActionButton";
import { actCreate } from "../../../test-utils/render";
import { TamaguiTestProvider } from "../../../test-utils/tamagui";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

it.each(["light", "dark"] as const)("keeps counter bounds and pending protection in the %s theme", theme => {
  const onChange = jest.fn();
  const renderCounter = (value: number, disabled = false) => <TamaguiTestProvider theme={theme}>
    <AssignmentCounter label="Alice's additional matches" compact subtle value={value} max={2} disabled={disabled} onChange={onChange} />
  </TamaguiTestProvider>;
  const tree = actCreate(renderCounter(0));
  const button = (action: string) => tree.root.findAll(node => typeof node.type === "string" &&
    node.props.accessibilityLabel === `${action} alice's additional matches`)[0];
  const press = (action: string) => tree.root.findAllByType(ShellActionButton)
    .find(node => node.props.accessibilityLabel === `${action} alice's additional matches`)!.props.onPress();
  expect(button("Decrease").props.accessibilityState.disabled).toBe(true);
  act(() => press("Increase"));
  expect(onChange).toHaveBeenLastCalledWith(1);
  act(() => tree.update(renderCounter(2)));
  expect(button("Increase").props.accessibilityState.disabled).toBe(true);
  act(() => press("Decrease"));
  expect(onChange).toHaveBeenLastCalledWith(1);
  act(() => tree.update(renderCounter(1, true)));
  expect(button("Decrease").props.accessibilityState.disabled).toBe(true);
  expect(button("Increase").props.accessibilityState.disabled).toBe(true);
  expect(button("Increase").props.onPress).toBeUndefined();
});
