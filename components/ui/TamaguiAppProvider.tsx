import React from "react";
import { TamaguiProvider } from "tamagui";
import config from "../../tamagui.config";
import { useGameStore } from "../../store/store";

/**
 * Root Tamagui provider that reads the persisted theme from Zustand
 * and applies it to the entire component tree.
 */
export function TamaguiAppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useGameStore((s) => s.theme);

  return (
    <TamaguiProvider config={config} defaultTheme={theme}>
      {children}
    </TamaguiProvider>
  );
}
