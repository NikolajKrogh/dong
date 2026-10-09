import React from "react";
import TestRenderer from "react-test-renderer";
import { Modal } from "react-native";
import { Calendar, TimePicker } from "react-native-paper-dates";
import { actCreate } from "../../test-utils/render";
import { PlatformDatePicker } from "../../platform/date-input/PlatformDatePicker";
import { PlatformTimePicker } from "../../platform/date-input/PlatformTimePicker";
import { PickerDialog } from "../../platform/date-input/PickerDialog";
import {
  formatDateIsoValue,
  formatTimeIsoValue,
} from "../../platform/date-input/normalizeValue";

jest.mock("../../platform/date-input/PickerTheme", () => ({
  PickerTheme: ({ children }: { children: unknown }) => children,
}));
jest.mock("react-native-paper-dates", () => ({
  Calendar: jest.fn(() => null),
  TimePicker: jest.fn(() => null),
}));

describe("automatic schedule selection", () => {
  beforeEach(() => jest.clearAllMocks());
  it("shows a transparent centered dialog and supports Android Back", () => {
    const onDismiss = jest.fn();
    const renderer = actCreate(
      <PickerDialog title="Select date" onDismiss={onDismiss} calendar>
        <></>
      </PickerDialog>,
    );
    const modal = renderer.root.findByType(Modal);
    expect(modal.props.transparent).toBe(true);
    modal.props.onRequestClose();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
  it("applies a selected date immediately and forwards bounds", () => {
    const date = new Date(2026, 9, 9);
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    actCreate(
      <PlatformDatePicker
        open
        date={date}
        minimumDate={date}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const props = jest.mocked(Calendar).mock.calls[0][0];
    expect(props.validRange?.startDate).toBe(date);
    if (props.mode !== "single") throw new Error("Expected single mode");
    props.onChange({ date: undefined });
    expect(onConfirm).not.toHaveBeenCalled();
    props.onChange({ date: new Date(2026, 9, 11) });
    expect(formatDateIsoValue(onConfirm.mock.calls[0][0])).toBe("2026-10-11");
  });
  it("waits until the minute gesture ends before applying local time", () => {
    const date = new Date(2026, 9, 9, 15, 0, 30);
    const onConfirm = jest.fn();
    const renderer = actCreate(
      <PlatformTimePicker
        open
        date={date}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    let props = jest.mocked(TimePicker).mock.calls.at(-1)![0];
    expect(props.use24HourClock).toBe(true);
    TestRenderer.act(() =>
      props.onChange({ hours: 14, minutes: 0, focused: "minutes" }),
    );
    expect(onConfirm).not.toHaveBeenCalled();
    props = jest.mocked(TimePicker).mock.calls.at(-1)![0];
    TestRenderer.act(() => props.onChange({ hours: 14, minutes: 30 }));
    expect(onConfirm).not.toHaveBeenCalled();
    const gesture = renderer.root.findAll(
      (node) => typeof node.props.onTouchEnd === "function",
    )[0];
    TestRenderer.act(() => {
      gesture.props.onTouchEnd();
      gesture.props.onPointerUp();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const selected = onConfirm.mock.calls[0][0];
    expect(formatTimeIsoValue(selected)).toBe("14:30");
    expect(formatDateIsoValue(selected)).toBe("2026-10-09");
    expect(selected.getSeconds()).toBe(0);
    expect(date.getHours()).toBe(15);
  });
  it("unmounts closed pickers to discard unfinished drafts", () => {
    const props = {
      date: new Date(),
      onConfirm: jest.fn(),
      onCancel: jest.fn(),
    };
    actCreate(<PlatformDatePicker {...props} open={false} />);
    actCreate(<PlatformTimePicker {...props} open={false} />);
    expect(Calendar).not.toHaveBeenCalled();
    expect(TimePicker).not.toHaveBeenCalled();
  });
});
