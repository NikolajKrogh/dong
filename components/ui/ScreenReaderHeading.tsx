import React from "react";
import { Platform } from "react-native";

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

export function ScreenReaderHeading({ children }: { children: string }) {
  return Platform.OS === "web" ? <h1 style={visuallyHidden}>{children}</h1> : null;
}
