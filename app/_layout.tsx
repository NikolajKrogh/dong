import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import RandomMatchesToast from "../components/setupGame/RandomMatchesToast";
import { goalToastConfig } from "../components/gameProgress/GoalToast";
import { Slot } from "expo-router";

const toastConfig = {
  // Setup Game toasts
  ...RandomMatchesToast,
  // Game Progress goal toast uses the built-in 'success' type
  success: goalToastConfig.success,
};

/**
 * Root layout configuring navigation stack and global toast providers.
 * @component
 * @description Wraps the app in a gesture handler root, sets initial stack routes, hides headers (handled by custom screens), and registers themed toast types (random match assignment + goal toasts). Also mounts a hidden `_style` route group to prevent style utility folders from becoming user-visible screens.
 */
export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="userPreferences"
          options={{ title: "Preferences" }}
        />
        {/* Group to prevent style files from being treated as routes */}
        <Stack.Screen name="_style" options={{ headerShown: false }} />
      </Stack>
      <Toast config={toastConfig as any} />
    </GestureHandlerRootView>
  );
}
