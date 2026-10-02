import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "../../styles/theme";
import { isWebPlatform } from "../environment";
import { coerceDateInputDate } from "./normalizeValue";

interface PlatformTimePickerProps {
  open: boolean;
  date: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load only the selected platform library; a missing optional native module has a safe fallback.
    return require("react-native-date-picker")
      .default as React.ComponentType<any>;
  } catch {
    return null;
  }
};

const loadWebDatePicker = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load the web picker only on web; native uses a separate module.
    return require("react-native-ui-datepicker")
      .default as React.ComponentType<any>;
  } catch {
    return null;
  }
};

const NativeDatePicker = isWebPlatform ? null : loadNativeDatePicker();
const WebDatePicker = isWebPlatform ? loadWebDatePicker() : null;

export const PlatformTimePicker: React.FC<PlatformTimePickerProps> = ({
  open,
  date,
  onConfirm,
  onCancel,
  title = "Select time",
  testID,
}) => {
  const colors = useColors();
  const [draftDate, setDraftDate] = useState(date);

  const [previous, setPrevious] = useState({ date, open });
  if (previous.date !== date || previous.open !== open) {
    setPrevious({ date, open });
    if (open) setDraftDate(date);
  }

  if (!isWebPlatform) {
      if (!NativeDatePicker) {
      return null;
    }

    return (
      <NativeDatePicker
        modal
        mode="time"
        open={open}
        date={date}
        onConfirm={onConfirm}
        onCancel={onCancel}
        testID={testID}
      />
    );
  }

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
            initialView="time"
            timePicker
            date={draftDate}
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
