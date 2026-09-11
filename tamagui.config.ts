import { createAnimations } from "@tamagui/animations-react-native";
import { createTamagui } from "tamagui";
import { darkTheme, lightTheme } from "./styles/tamaguiThemes";
import { tokens } from "./styles/tamaguiTokens";

const animations = createAnimations({
  quick: { type: "timing", duration: 180 },
  medium: { type: "timing", duration: 260 },
  slow: { type: "timing", duration: 420 },
});

const config = createTamagui({
  animations,
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  defaultTheme: "light",
});

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {
    readonly __configBrand?: never;
  }
}

export default config;
