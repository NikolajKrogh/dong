import { useCallback, useEffect, useState } from "react";

import type { VisibilityState } from "../types";
import { createSoundController } from "./createSoundController";
import type { AudioModuleLike, GoalSoundRequest } from "./types";

interface UseGoalSoundOptions {
  enabled: boolean;
  visibilityState: VisibilityState;
  request?: GoalSoundRequest;
  audioModule?: AudioModuleLike | null;
  onError?: (error: unknown) => void;
}

const getExpoAudioModule = (): AudioModuleLike | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Resolve the optional native audio module lazily so unsupported runtimes retain the silent fallback.
    const expoAudio = require("expo-audio");

    return {
      createPlayer: (asset) => expoAudio.createAudioPlayer(asset),
      setAudioModeAsync: expoAudio.setAudioModeAsync,
    };
  } catch {
    return null;
  }
};

export const useGoalSound = ({
  enabled,
  visibilityState,
  request,
  audioModule,
  onError,
}: UseGoalSoundOptions) => {
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [controller] = useState(() =>
    createSoundController({
      audioModule: audioModule ?? getExpoAudioModule(),
      onError,
      onPlaybackStateChange: setIsSoundPlaying,
    }),
  );

  useEffect(() => {
    return () => {
      void controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    if (!enabled || visibilityState !== "active") {
      void controller.stop();
    }
  }, [controller, enabled, visibilityState]);

  const playGoalSound = useCallback(() => {
    return controller.play({
      enabled,
      isPlaying: controller.getIsPlaying(),
      visibilityState,
      request,
    });
  }, [controller, enabled, request, visibilityState]);

  const stopGoalSound = useCallback(() => {
    return controller.stop();
  }, [controller]);

  return {
    isSoundPlaying,
    playGoalSound,
    stopGoalSound,
  };
};
