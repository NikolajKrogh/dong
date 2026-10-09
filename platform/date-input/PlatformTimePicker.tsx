import React, { useRef, useState } from "react";
import { View } from "react-native";
import { TimePicker } from "react-native-paper-dates";
import { PickerDialog } from "./PickerDialog";
interface PlatformTimePickerProps {
  open: boolean;
  date: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  title?: string;
  testID?: string;
}
function Clock({
  date,
  onConfirm,
}: {
  date: Date;
  onConfirm: (date: Date) => void;
}) {
  const [time, setTime] = useState({
    hours: date.getHours(),
    minutes: date.getMinutes(),
  });
  const [focused, setFocused] = useState<"hours" | "minutes">("hours");
  const draft = useRef(time);
  const committed = useRef(false);
  const finishMinuteSelection = () => {
    if (focused !== "minutes" || committed.current) return;
    committed.current = true;
    const selected = new Date(date);
    selected.setHours(draft.current.hours, draft.current.minutes, 0, 0);
    onConfirm(selected);
  };
  return (
    <View
      onTouchEnd={finishMinuteSelection}
      onPointerUp={finishMinuteSelection}
    >
      <TimePicker
        locale="en"
        inputType="picker"
        focused={focused}
        onFocusInput={setFocused}
        hours={time.hours}
        minutes={time.minutes}
        use24HourClock
        onChange={({ hours, minutes, focused: nextFocus }) => {
          draft.current = { hours, minutes };
          setTime({ hours, minutes });
          if (nextFocus) setFocused(nextFocus);
        }}
      />
    </View>
  );
}
export const PlatformTimePicker: React.FC<PlatformTimePickerProps> = ({
  open,
  date,
  onConfirm,
  onCancel,
  title = "Select time",
  testID,
}) => {
  if (!open) return null;
  return (
    <PickerDialog title={title} onDismiss={onCancel} testID={testID}>
      <Clock date={date} onConfirm={onConfirm} />
    </PickerDialog>
  );
};
