import { createTamagui } from "tamagui";
import { tokens } from "./app/style/tamaguiTokens";
import { lightTheme, darkTheme } from "./app/style/tamaguiThemes";

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
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
