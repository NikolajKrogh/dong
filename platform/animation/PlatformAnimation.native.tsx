import React from "react";
import { Text, View } from "react-native";

import { useColors } from "../../styles/theme";
import type { AnimationKind } from "../types";
import { getAnimationFallback } from "./fallbacks";
import LottieView from "lottie-react-native";

interface PlatformAnimationProps {
  kind: AnimationKind;
  source?: React.ComponentProps<typeof LottieView>["source"];
  style?: any;
  autoPlay?: boolean;
  loop?: boolean;
  fallback?: React.ReactNode;
  testID?: string;
}

export const PlatformAnimation: React.FC<PlatformAnimationProps> = ({
  kind,
  source,
  style,
  autoPlay = true,
  loop = false,
  fallback,
  testID,
}) => {
  const colors = useColors();
  const fallbackConfig = getAnimationFallback(kind);

  if (!fallbackConfig.useNativeRenderer || source === undefined) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={fallbackConfig.accessibilityLabel}
        style={style}
        testID={testID}
      >
        {fallback ?? (
          <Text style={{ color: colors.textPrimary, textAlign: "center" }}>
            {fallbackConfig.accessibilityLabel}
          </Text>
        )}
      </View>
    );
  }

  return (
    <LottieView
      autoPlay={autoPlay}
      loop={loop}
      source={source}
      style={style}
      testID={testID}
    />
  );
};

export default PlatformAnimation;
