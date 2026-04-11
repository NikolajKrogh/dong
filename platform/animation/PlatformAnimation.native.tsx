import React from "react";

import type { AnimationKind } from "../types";
import LottieView from "lottie-react-native";

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
  kind: _kind,
  source,
  style,
  autoPlay = true,
  loop = false,
  fallback: _fallback,
  testID,
}) => {
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
