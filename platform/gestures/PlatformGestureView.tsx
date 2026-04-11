import React, { useMemo } from "react";
import { PanResponder, View } from "react-native";

import type { GestureKind } from "../types";
import { supportsGestureEnhancement } from "./fallbacks";

interface PlatformGestureViewProps {
  kind?: Extract<GestureKind, "onboardingSwipe">;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
  testID?: string;
}

export const PlatformGestureView: React.FC<PlatformGestureViewProps> = ({
  kind = "onboardingSwipe",
  children,
  style,
  disabled = false,
  onSwipeLeft,
  onSwipeRight,
  swipeThreshold = 40,
  testID,
}) => {
  const panResponder = useMemo(() => {
    if (disabled || !supportsGestureEnhancement(kind)) {
      return null;
    }

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 12
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx <= -swipeThreshold) {
          onSwipeLeft?.();
        }

        if (gestureState.dx >= swipeThreshold) {
          onSwipeRight?.();
        }
      },
    });
  }, [disabled, kind, onSwipeLeft, onSwipeRight, swipeThreshold]);

  return (
    <View style={style} testID={testID} {...(panResponder?.panHandlers ?? {})}>
      {children}
    </View>
  );
};

export default PlatformGestureView;
