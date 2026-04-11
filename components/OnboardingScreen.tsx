import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "../app/style/theme";
import { PlatformGestureView } from "../platform";

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
  const colors = useColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
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
          width: "100%",
          height: undefined,
          aspectRatio: 1,
          resizeMode: "contain",
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
          boxShadow: `0px 2px 6px ${colors.black}33`,
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
      }),
    [colors],
  );
  const [screenIndex, setScreenIndex] = useState(0);
  const data = onboardingSteps[screenIndex];

  const onContinue = () => {
    if (screenIndex === onboardingSteps.length - 1) {
      onFinish();
    } else {
      setScreenIndex((currentIndex) => currentIndex + 1);
    }
  };

  const onBack = () => {
    if (screenIndex > 0) {
      setScreenIndex((currentIndex) => currentIndex - 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <PlatformGestureView
        kind="onboardingSwipe"
        onSwipeLeft={onContinue}
        onSwipeRight={onBack}
      >
        <View style={styles.content}>
          {data.image && <Image source={data.image} style={styles.logo} />}
          <View>
            <Text style={styles.title}>{data.title}</Text>
          </View>
          <View>
            <Text style={styles.description}>{data.description}</Text>
          </View>
          <View style={styles.buttons}>
            <Pressable onPress={onFinish} style={styles.button}>
              <Text style={styles.buttonText}>Skip</Text>
            </Pressable>
            <Pressable onPress={onContinue} style={styles.button}>
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </PlatformGestureView>
      <View style={styles.progressBarContainer}>
        {onboardingSteps.map((step, index) => (
          <View
            key={step.title}
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

export default OnboardingScreen;
