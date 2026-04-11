import { Platform } from "react-native";

import type { SupportedPlatform } from "./types";

export const isWebPlatform = Platform.OS === "web";
export const canUseDOM =
  globalThis.window !== undefined && globalThis.document !== undefined;
export const hasPageVisibilityAPI =
  canUseDOM && typeof document.visibilityState === "string";

export const getRuntimePlatform = (): SupportedPlatform => {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return Platform.OS;
  }

  return "web";
};

export const getDocumentVisibilityState = (): string | undefined => {
  if (!hasPageVisibilityAPI) {
    return undefined;
  }

  return document.visibilityState;
};
