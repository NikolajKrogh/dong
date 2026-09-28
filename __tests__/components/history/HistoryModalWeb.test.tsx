/** @jest-environment jsdom */
import React from "react";
import { act } from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

// Exercise the installed Modal primitives that our native frame delegates to.
jest.mock("react-native-web/dist/cjs/exports/View", () => "div");
jest.mock(
  "react-native-web/dist/cjs/exports/createElement",
  () => require("react").createElement,
);
jest.mock("react-native-web/dist/cjs/exports/StyleSheet", () => ({
  create: (value: unknown) => value,
}));
jest.mock("react-native-web/dist/cjs/modules/canUseDom", () => true);
jest.mock("react-native-web/dist/cjs/exports/UIManager", () => ({
  focus: (element: HTMLElement) => element.focus(),
}));
const ModalContent = require("react-native-web/dist/cjs/exports/Modal/ModalContent");
const ModalFocusTrap = require("react-native-web/dist/cjs/exports/Modal/ModalFocusTrap");

it("routes Escape only to the active modal and removes the listener on unmount", () => {
  const onClose = jest.fn();
  const inactiveClose = jest.fn();
  const renderer = actCreate(
    <>
      <ModalContent active onRequestClose={onClose} />
      <ModalContent active={false} onRequestClose={inactiveClose} />
    </>,
  );
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(inactiveClose).not.toHaveBeenCalled();
  act(() => renderer.unmount());
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("restores focus to the opener on dismissal", () => {
  const opener = document.createElement("button");
  const other = document.createElement("button");
  document.body.append(opener, other);
  opener.focus();
  const renderer = actCreate(<ModalFocusTrap active />);
  other.focus();
  act(() => renderer.unmount());
  expect(document.activeElement).toBe(opener);
  opener.remove();
  other.remove();
});
