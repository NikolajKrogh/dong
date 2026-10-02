import { Stack } from "expo-router";
import Toast from "react-native-toast-message";
import RandomMatchesToast from "../components/setupGame/RandomMatchesToast";
import { goalToastConfig } from "../components/gameProgress/GoalToast";
import { PlatformGestureRoot } from "../platform";
import { TamaguiAppProvider } from "../components/ui";
import { AccountAuthProvider } from "../hooks/useAccountAuth";
import { useGuestRoomEndedNavigation } from "../hooks/useGuestRoomEndedNavigation";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import QueryLifecycle from '../lib/QueryLifecycle';

const toastConfig = {
  // Setup Game toasts
  ...RandomMatchesToast,
  // Game Progress goal toast uses the built-in 'success' type
  success: goalToastConfig.success,
};

/**
 * Root layout configuring navigation stack and global toast providers.
 * @component
 * @description Wraps the app in TamaguiAppProvider (themed from persisted store),
 * a gesture handler root, sets initial stack routes, hides headers (handled by
 * custom screens), and registers themed toast types.
 */
export default function Layout() {
  useGuestRoomEndedNavigation();
  return (
    <QueryClientProvider client={queryClient}>
    <QueryLifecycle />
    <AccountAuthProvider>
      <TamaguiAppProvider>
        <PlatformGestureRoot style={{ flex: 1 }}>
          <Stack
            initialRouteName="index"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen
              name="userPreferences"
              options={{ title: "Preferences" }}
            />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
          </Stack>
          <Toast config={toastConfig as any} />
        </PlatformGestureRoot>
      </TamaguiAppProvider>
    </AccountAuthProvider>
    </QueryClientProvider>
  );
}
