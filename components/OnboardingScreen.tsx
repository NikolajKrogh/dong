import React, { useState } from "react";
import { View, Text, SafeAreaView, Pressable, StyleSheet, Image } from "react-native";
import { GestureDetector, Gesture, Directions } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from "react-native-reanimated";
import logo from "../assets/icons/logo_png/dong_logo.png";

const onboardingSteps = [
  {
    title: "Welcome to DONG",
    description: "A fun and interactive drinking game experience.",
  },
  {
    title: "Add Players",
    description: "Easily add players to your game with a few taps.",
  },
  {
    title: "Setup Your Game",
    description: "Select leagues, apply filters, and customize your game.",
  },
  {
    title: "Track Stats",
    description: "View game history and player stats in one place.",
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
          {screenIndex === 0 && <Image source={logo} style={styles.logo} />}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  logo: {
    width: "60%", // Adjusted to be responsive
    height: undefined, // Maintain aspect ratio
    aspectRatio: 1, // Ensures the logo is a square
    marginBottom: 20,
    resizeMode: "contain", // Ensures the logo fits within its bounds
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#0275d8",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#6c757d",
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
    backgroundColor: "#0275d8",
    borderRadius: 10,
    marginHorizontal: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default OnboardingScreen;