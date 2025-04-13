import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="userPreferences"
          options={{ title: "Preferences" }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
