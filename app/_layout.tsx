import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Your existing app content */}
      <Stack
        screenOptions={{
          headerShown: false, // This hides the header on all screens
        }}
      />
    </GestureHandlerRootView>
  );
}
