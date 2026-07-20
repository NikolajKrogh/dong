import { useCallback, useEffect, useRef, useState } from "react";

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
  const controllerRef = useRef(
    createSoundController({
      audioModule: audioModule ?? getExpoAudioModule(),
      onError,
      onPlaybackStateChange: setIsSoundPlaying,
    }),
  );

  useEffect(() => {
    const controller = controllerRef.current;

    return () => {
      void controller.dispose();
    };
  }, []);

  useEffect(() => {
    if (!enabled || visibilityState !== "active") {
      void controllerRef.current.stop();
    }
  }, [enabled, visibilityState]);

  const playGoalSound = useCallback(() => {
    return controllerRef.current.play({
      enabled,
      isPlaying: controllerRef.current.getIsPlaying(),
      visibilityState,
      request,
    });
  }, [enabled, request, visibilityState]);

  const stopGoalSound = useCallback(() => {
    return controllerRef.current.stop();
  }, []);

  return {
    isSoundPlaying,
    playGoalSound,
    stopGoalSound,
  };
};
