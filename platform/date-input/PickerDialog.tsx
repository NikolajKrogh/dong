import React from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { useColors } from "../../styles/theme";
import { PickerTheme } from "./PickerTheme";

export function PickerDialog({
  title,
  onDismiss,
  children,
  calendar = false,
  testID,
}: {
  title: string;
  onDismiss: () => void;
  children: React.ReactNode;
  calendar?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const { height } = useWindowDimensions();
  return (
    <PickerTheme>
      <Modal
        transparent
        visible
        animationType="fade"
        onRequestClose={onDismiss}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss picker"
            onPress={onDismiss}
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: colors.backgroundModalOverlay,
            }}
          />
          <View
            testID={testID}
            style={{
              width: "100%",
              maxWidth: calendar ? 400 : 640,
              ...(calendar ? { height: Math.min(520, height - 48) } : {}),
              borderRadius: 28,
              overflow: "hidden",
              backgroundColor: colors.surface,
              paddingBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: 24,
              }}
            >
              <Text variant="titleMedium" style={{ flex: 1 }}>
                {title}
              </Text>
              <IconButton
                icon="close"
                accessibilityLabel="Close"
                onPress={onDismiss}
              />
            </View>
            {children}
          </View>
        </View>
      </Modal>
    </PickerTheme>
  );
}
