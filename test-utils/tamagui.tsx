import React from "react";
import { TamaguiProvider } from "tamagui";
import config from "../tamagui.config";

/**
 * Wraps children in a TamaguiProvider with the given theme for testing.
 * Falls back to "light" when no theme is specified.
 */
export function TamaguiTestProvider({
  children,
  theme = "light",
}: {
  children: React.ReactNode;
  theme?: "light" | "dark";
}) {
  return (
    <TamaguiProvider config={config} defaultTheme={theme}>
      {children}
    </TamaguiProvider>
  );
}
