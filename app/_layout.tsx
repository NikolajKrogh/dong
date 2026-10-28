import { Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import { Platform } from "react-native";
import Toast from "react-native-toast-message";
import RandomMatchesToast from "../features/game-setup/RandomMatchesToast";
import { goalToastConfig } from "../components/gameProgress/GoalToast";
import { PlatformGestureRoot } from "../platform";
import { TamaguiAppProvider } from "../components/ui";
import { AccountAuthProvider } from "../features/account";
import { useGuestRoomEndedNavigation } from "../features/rooms/useGuestRoomEndedNavigation";
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
const pageTitles: Record<string, string> = {
  "/": "Home", "/setupGame": "Set up game", "/gameProgress": "Game progress",
  "/history": "History", "/friends": "Friends", "/friends/search": "Find friends",
  "/friends/blocked": "Blocked accounts", "/userPreferences": "Settings",
  "/userPreferences/profile": "Profile", "/userPreferences/leagues": "Default leagues",
  "/auth": "Sign in or create account", "/auth/onboarding": "Choose username",
  "/auth/reset-password": "Reset password", "/auth/change-password": "Change password",
};

export default function Layout() {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] ?? (pathname.startsWith("/lobby/") ? "Room" : "DONG");
  useGuestRoomEndedNavigation();
  return (
    <QueryClientProvider client={queryClient}>
    {Platform.OS === "web" && <Head><title>{pageTitle === "DONG" ? "DONG" : `${pageTitle} · DONG`}</title></Head>}
    <QueryLifecycle />
    <AccountAuthProvider>
      <TamaguiAppProvider>
        <PlatformGestureRoot style={{ flex: 1 }}>
          <Stack
            initialRouteName="index"
            screenOptions={{ headerShown: false, title: "DONG" }}
          >
            <Stack.Screen name="userPreferences" options={{ title: "Preferences" }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="taskOverlay" options={{ presentation: "transparentModal", headerShown: false, animation: "none" }} />
          </Stack>
          <Toast config={toastConfig as any} />
        </PlatformGestureRoot>
      </TamaguiAppProvider>
    </AccountAuthProvider>
    </QueryClientProvider>
  );
}
