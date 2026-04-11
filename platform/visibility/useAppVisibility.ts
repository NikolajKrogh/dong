import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  canUseDOM,
  getDocumentVisibilityState,
  isWebPlatform,
} from "../environment";
import type { VisibilitySnapshot } from "../types";
import {
  createAppStateSnapshot,
  createDocumentVisibilitySnapshot,
} from "./normalizeVisibility";

export const getCurrentVisibilitySnapshot = (): VisibilitySnapshot => {
  if (isWebPlatform && canUseDOM) {
    return createDocumentVisibilitySnapshot(getDocumentVisibilityState());
  }

  return createAppStateSnapshot(AppState.currentState);
};

export const useAppVisibility = () => {
  const [snapshot, setSnapshot] = useState<VisibilitySnapshot>(
    getCurrentVisibilitySnapshot,
  );

  useEffect(() => {
    if (isWebPlatform && canUseDOM) {
      const handleVisibilityChange = () => {
        setSnapshot(
          createDocumentVisibilitySnapshot(getDocumentVisibilityState()),
        );
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
    }

    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        setSnapshot(createAppStateSnapshot(state));
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    snapshot,
    visibilityState: snapshot.state,
    isInteractive: snapshot.isInteractive,
  };
};
