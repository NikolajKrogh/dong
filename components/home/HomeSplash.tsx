import React, { useCallback, useEffect, useRef } from "react";
import { Image } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { PlatformAnimation } from "../../platform";
import createStyles from "../../app/style/indexStyles";

interface HomeSplashProps {
  styles: ReturnType<typeof createStyles>;
  onComplete: () => void;
}

export const HomeSplash: React.FC<HomeSplashProps> = ({
  styles,
  onComplete,
}) => {
  const opacity = useSharedValue(1);
  const hasCompletedRef = useRef(false);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const completeSplash = useCallback(() => {
    if (hasCompletedRef.current) {
      return;
    }

    hasCompletedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const splashFallbackTimer = setTimeout(completeSplash, 4500);

    opacity.value = withDelay(
      3000,
      withTiming(
        0,
        {
          duration: 1000,
          easing: Easing.out(Easing.quad),
        },
        (finished) => {
          if (finished) {
            runOnJS(completeSplash)();
          }
        },
      ),
    );

    return () => {
      clearTimeout(splashFallbackTimer);
    };
  }, [completeSplash, opacity]);

  return (
    <Animated.View style={[styles.splashContainer, animatedStyle]}>
      <PlatformAnimation
        kind="splash"
        source={require("../../assets/lottie/dong_logo_animation.json")}
        autoPlay
        loop={false}
        style={styles.splashAnimation}
        fallback={
          <Image
            source={require("../../assets/icons/logo_png/dong_logo.png")}
            style={styles.splashAnimation}
          />
        }
      />
    </Animated.View>
  );
};

export default HomeSplash;
