import { Platform, type ViewStyle } from "react-native";

export function hexWithAlpha(color: string, opacity: number): string {
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) {
    throw new Error("Expected a 3- or 6-digit hex color");
  }

  const hex = color.slice(1);

  const rgb = hex.length === 3
    ? [...hex].map((channel) => channel.repeat(2)).join("")
    : hex;
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, "0");

  return `#${rgb}${alpha}`;
}

export function androidElevationFallback(
  elevation: number,
): Pick<ViewStyle, "elevation"> {
  return Platform.OS === "android" && Number(Platform.Version) < 28
    ? { elevation }
    : {};
}
