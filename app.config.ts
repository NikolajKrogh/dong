import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: "DONG",
  slug: "dong",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icons/ios_light.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    icon: {
      dark: "./assets/icons/ios_light.png",
      light: "./assets/icons/ios_dark.png",
      tinted: "./assets/icons/ios_tinted.png",
    },
  },
  android: {
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      foregroundImage: "./assets/icons/android.png",
      monochromeImage: "./assets/icons/android.png",
      backgroundColor: "#FCE38A",
    },
    package:
      process.env.NODE_ENV === "development"
        ? "com.krogh.dong.dev"
        : "com.krogh.dong",
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/icons/ios_light.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/icons/splash_screen_dark.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          image: "./assets/icons/splash_screen_light.png",
          backgroundColor: "#000000",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: "2a98aee4-0b06-44a8-a102-1eeaa14e6f85",
    },
  },
   "owner": "olivervn1"
});