import React from "react";
import { act } from "react-test-renderer";
import { actCreate } from "../../test-utils/render";
import { useReducedMotion } from "../../platform/animation/useReducedMotion";

jest.mock("../../platform/animation/useReducedMotion", () => jest.requireActual("../../platform/animation/useReducedMotion.ts"));

const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
let preference = false;
let listener: (() => void) | undefined;
const remove = jest.fn();
const media = {
  get matches() { return preference; },
  addEventListener: jest.fn((_event: string, update: () => void) => { listener = update; }),
  removeEventListener: remove,
};
const matchMedia = jest.fn(() => media);
function Probe() { return React.createElement("MotionPolicy", { value: useReducedMotion() }); }

afterEach(() => {
  if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
  else Reflect.deleteProperty(globalThis, "window");
  jest.clearAllMocks();
});

it("follows the web media preference live and removes its listener", () => {
  preference = false;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia } });
  const tree = actCreate(<Probe />);
  expect(tree.toJSON()).toMatchObject({ props: { value: false } });
  expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  act(() => { preference = true; listener?.(); });
  expect(tree.toJSON()).toMatchObject({ props: { value: true } });
  act(() => { preference = false; listener?.(); });
  expect(tree.toJSON()).toMatchObject({ props: { value: false } });
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledWith("change", listener);
});

it("keeps motion disabled when the browser preference API is unavailable", () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  const tree = actCreate(<Probe />);
  expect(tree.toJSON()).toMatchObject({ props: { value: true } });
  act(() => tree.unmount());
});
