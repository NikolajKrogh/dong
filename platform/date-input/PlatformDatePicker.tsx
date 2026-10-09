import React from "react";
import { Calendar } from "react-native-paper-dates";
import { PickerDialog } from "./PickerDialog";
interface PlatformDatePickerProps {
  open: boolean;
  date: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
  testID?: string;
}
export const PlatformDatePicker: React.FC<PlatformDatePickerProps> = ({
  open,
  date,
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate,
  title = "Select date",
  testID,
}) => {
  if (!open) return null;
  return (
    <PickerDialog title={title} onDismiss={onCancel} calendar testID={testID}>
      <Calendar
        locale="en"
        mode="single"
        date={date}
        startWeekOnMonday
        validRange={{ startDate: minimumDate, endDate: maximumDate }}
        onChange={({ date: selected }) => {
          if (selected) onConfirm(selected);
        }}
      />
    </PickerDialog>
  );
};
