import React, { useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";
import {
  GestureDetector,
  Gesture,
  Directions,
} from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { colors } from "../app/style/palette";

const onboardingSteps = [
  {
    title: "Welcome to DONG",
    description:
      "DONG is a Danish football drinking game where goals mean beers. Pick matches, follow the action, and drink up when your teams score!",
    image: require("../assets/onboarding/screen1.png"),
  },
  {
    title: "Add Players",
    description:
      "Start by adding your friends. Each player picks matches and competes to see who ends up with the most goals—and beers!",
    image: require("../assets/onboarding/screen2.png"),
  },
  {
    title: "Set Up Your Game",
    description:
      "Choose multiple leagues, and select a number of matches. Everyone also drinks to the shared match — Which is chosen by everyone.",
    image: require("../assets/onboarding/screen3.png"),
  },
  {
    title: "Track Stats",
    description:
      "Keep track of goals, beers consumed, and who’s winning. Check past games to see which of your friends is the reigning DONG champion!",
    image: require("../assets/onboarding/screen4.png"),
  },
];

const OnboardingScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [screenIndex, setScreenIndex] = useState(0);
  const data = onboardingSteps[screenIndex];

  const onContinue = () => {
    if (screenIndex === onboardingSteps.length - 1) {
      onFinish();
    } else {
      setScreenIndex(screenIndex + 1);
    }
  };

  const onBack = () => {
    if (screenIndex > 0) {
      setScreenIndex(screenIndex - 1);
    }
  };

  const swipes = Gesture.Simultaneous(
    Gesture.Fling()
      .runOnJS(true)
      .direction(Directions.LEFT)
      .onEnd(() => {
        onContinue();
      }),
    Gesture.Fling()
      .runOnJS(true)
      .direction(Directions.RIGHT)
      .onEnd(() => {
        onBack();
      })
  );

  return (
    <SafeAreaView style={styles.container}>
      <GestureDetector gesture={swipes}>
        <View style={styles.content}>
          {data.image && <Image source={data.image} style={styles.logo} />}
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Text style={styles.title}>{data.title}</Text>
          </Animated.View>
          <Animated.View entering={SlideInRight} exiting={SlideOutLeft}>
            <Text style={styles.description}>{data.description}</Text>
          </Animated.View>
          <View style={styles.buttons}>
            <Pressable onPress={onFinish} style={styles.button}>
              <Text style={styles.buttonText}>Skip</Text>
            </Pressable>
            <Pressable onPress={onContinue} style={styles.button}>
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </GestureDetector>
      <View style={styles.progressBarContainer}>
        {onboardingSteps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === screenIndex ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  logo: {
    width: "100%", // Adjusted to fit within the screen
    height: undefined, // Maintain aspect ratio
    aspectRatio: 1, // Ensures the logo maintains its proportions
    resizeMode: "contain", // Ensures the image fits within the bounds
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 24,
    textAlign: "center",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginHorizontal: 10,
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  progressBarContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: colors.surface,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: colors.primary,
  },
  inactiveDot: {
    backgroundColor: colors.border,
  },
});

export default OnboardingScreen;
