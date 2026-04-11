import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "../../app/style/theme";
import { isWebPlatform } from "../environment";
import { coerceDateInputDate } from "./normalizeValue";

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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  content: {
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

const loadNativeDatePicker = () => {
  try {
    return require("react-native-date-picker")
      .default as React.ComponentType<any>;
  } catch {
    return null;
  }
};

const loadWebDatePicker = () => {
  try {
    return require("react-native-ui-datepicker")
      .default as React.ComponentType<any>;
  } catch {
    return null;
  }
};

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
  const colors = useColors();
  const [draftDate, setDraftDate] = useState(date);

  useEffect(() => {
    if (open) {
      setDraftDate(date);
    }
  }, [date, open]);

  if (!isWebPlatform) {
    const NativeDatePicker = loadNativeDatePicker();
    if (!NativeDatePicker) {
      return null;
    }

    return (
      <NativeDatePicker
        modal
        mode="date"
        open={open}
        date={date}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onConfirm={onConfirm}
        onCancel={onCancel}
        testID={testID}
      />
    );
  }

  const WebDatePicker = loadWebDatePicker();
  if (!open || !WebDatePicker) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[styles.content, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}
          testID={testID}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <WebDatePicker
            mode="single"
            date={draftDate}
            minDate={minimumDate}
            maxDate={maximumDate}
            onChange={({ date: nextDate }: { date?: unknown }) => {
              setDraftDate(coerceDateInputDate(nextDate, draftDate));
            }}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.backgroundSubtle },
              ]}
              onPress={onCancel}
            >
              <Text
                style={[styles.actionText, { color: colors.textSecondary }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => onConfirm(draftDate)}
            >
              <Text style={[styles.actionText, { color: colors.white }]}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default PlatformDatePicker;
