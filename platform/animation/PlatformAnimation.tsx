import React, { useState } from "react";
import { Text, View } from "react-native";
import LottieView from "lottie-react-native";

import { useColors } from "../../styles/theme";
import type { AnimationKind } from "../types";
import { getAnimationFallback } from "./fallbacks";
import { useReducedMotion } from "./useReducedMotion";

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
  const reduceMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={kind === "loading" ? "Loading matches and teams" : fallbackConfig.accessibilityLabel}
      style={style}
      testID={testID}
    >
      {kind === "loading" && source && !reduceMotion && !failed ? (
        <LottieView
          source={source}
          autoPlay={autoPlay}
          loop={loop}
          webStyle={{ width: "100%", height: "100%" }}
          onAnimationFailure={() => setFailed(true)}
        />
      ) : fallback ?? (
        <Text style={{ color: colors.textPrimary, textAlign: "center" }}>
          {fallbackConfig.accessibilityLabel}
        </Text>
      )}
    </View>
  );
};
