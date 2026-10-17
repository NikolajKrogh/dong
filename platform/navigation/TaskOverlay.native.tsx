import React, { useCallback } from "react";
import { BackHandler, Keyboard } from "react-native";
import { useFocusEffect } from "expo-router";

import type { TaskOverlayProps } from "./taskNavigation.shared";

export function TaskOverlay({ open, onClose, children }: TaskOverlayProps) {
  useFocusEffect(useCallback(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (Keyboard.isVisible()) Keyboard.dismiss();
      else onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, open]));
  return <>{children({
    open,
    dismiss: onClose,
    runAfterDismiss: (action) => { onClose(); action(); },
  })}</>;
}
