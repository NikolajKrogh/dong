import type { AppStateStatus } from "react-native";

import type {
  VisibilitySnapshot,
  VisibilitySource,
  VisibilityState,
} from "./types";

export const isInteractiveVisibility = (state: VisibilityState): boolean => {
  return state === "active";
};

export const normalizeAppState = (
  state: AppStateStatus | null | undefined,
): VisibilityState => {
  switch (state) {
    case "active":
      return "active";
    case "background":
      return "background";
    default:
      return "inactive";
  }
};

export const normalizeDocumentVisibility = (
  state: string | null | undefined,
): VisibilityState => {
  return state === "visible" ? "active" : "hidden";
};

export const createVisibilitySnapshot = (
  state: VisibilityState,
  source: VisibilitySource,
  capturedAt = Date.now(),
): VisibilitySnapshot => ({
  state,
  source,
  isInteractive: isInteractiveVisibility(state),
  capturedAt,
});

export const createAppStateSnapshot = (
  state: AppStateStatus | null | undefined,
  capturedAt = Date.now(),
): VisibilitySnapshot => {
  return createVisibilitySnapshot(
    normalizeAppState(state),
    "appState",
    capturedAt,
  );
};

export const createDocumentVisibilitySnapshot = (
  state: string | null | undefined,
  capturedAt = Date.now(),
): VisibilitySnapshot => {
  return createVisibilitySnapshot(
    normalizeDocumentVisibility(state),
    "document",
    capturedAt,
  );
};
