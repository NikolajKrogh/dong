import React from "react";
import { Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import Svg, { Circle, Line } from "react-native-svg";
import { Text, YStack } from "tamagui";
import { ShellScreen } from "../components/ui/ShellScreen";
import { ShellActionButton } from "../components/ui/ShellActionButton";
import { useRoomEndedExit } from "../platform/navigation/useRoomEndedExit";
import { useColors } from "../styles/theme";

export default function RoomEndedScreen() {
  const router = useRouter();
  const colors = useColors();
  const { exit, seconds, progress, automatic } = useRoomEndedExit(() => router.replace("/"));
  return (
    <ShellScreen padded={false}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
          <YStack flex={1} width="100%" maxWidth={560} alignSelf="center" alignItems="center" justifyContent="center" gap="$5" paddingVertical="$5">
            <Image source={require("../assets/icons/logo_png/dong_logo.png")} accessibilityLabel="DONG" resizeMode="contain" style={{ width: "85%", maxWidth: 340, height: 110, marginBottom: 16 }} />
            <YStack backgroundColor="$primaryLight" borderRadius={100} padding="$5" accessible={false}>
              <Svg width={84} height={84} viewBox="0 0 84 84" accessible={false}>
                <Circle cx={42} cy={42} r={35} fill="none" stroke={colors.primary} strokeWidth={4} />
                <Circle cx={42} cy={27} r={3} fill={colors.primary} />
                <Line x1={42} y1={38} x2={42} y2={58} stroke={colors.primary} strokeWidth={5} strokeLinecap="round" />
              </Svg>
            </YStack>
            <Text accessibilityRole="header" color="$color" fontSize={30} fontWeight="700" textAlign="center">Game ended by host</Text>
            <Text color="$textMuted" fontSize={18} textAlign="center">
              {automatic ? "The host has ended this shared game. You’ll be returned to Home in a moment." : "The host has ended this shared game. Select Go to Home now when you’re ready."}
            </Text>
            {automatic && <YStack alignItems="center" gap="$3" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <YStack width={88} height={88} alignItems="center" justifyContent="center">
                <Svg width={88} height={88} viewBox="0 0 88 88" style={{ position: "absolute" }}>
                  <Circle cx={44} cy={44} r={39} fill="none" stroke={colors.primaryLight} strokeWidth={6} />
                  <Circle cx={44} cy={44} r={39} fill="none" stroke={colors.primary} strokeWidth={6} strokeDasharray={`${2 * Math.PI * 39}`} strokeDashoffset={2 * Math.PI * 39 * (1 - progress)} rotation={-90} origin="44,44" strokeLinecap="round" />
                </Svg>
                <Text color="$textMuted" fontSize={28} fontWeight="600">{seconds}</Text>
              </YStack>
              <Text color="$textMuted" fontSize={16}>Returning to Home…</Text>
            </YStack>}
            <ShellActionButton label="Go to Home now" accessibilityRole="button" accessibilityLabel="Go to Home now" onPress={exit} size="large" widthMode="wide" marginTop="$3" />
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </ShellScreen>
  );
}
