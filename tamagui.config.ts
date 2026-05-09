import { createTamagui } from "tamagui";
import { darkTheme, lightTheme } from "./app/style/tamaguiThemes";
import { tokens } from "./app/style/tamaguiTokens";

const config = createTamagui({
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
