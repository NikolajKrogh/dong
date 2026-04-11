import React from "react";
import { Text, View } from "react-native";

import { useColors } from "../../app/style/theme";
import type { AnimationKind } from "../types";
import { getAnimationFallback } from "./fallbacks";

interface PlatformAnimationProps {
  kind: AnimationKind;
  source: object;
  style?: any;
  autoPlay?: boolean;
  loop?: boolean;
  fallback?: React.ReactNode;
  testID?: string;
}

export const PlatformAnimation: React.FC<PlatformAnimationProps> = ({
  kind,
  source: _source,
  style,
  autoPlay: _autoPlay = true,
  loop: _loop = false,
  fallback,
  testID,
}) => {
  const colors = useColors();
  const fallbackConfig = getAnimationFallback(kind);

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
};

export default PlatformAnimation;
