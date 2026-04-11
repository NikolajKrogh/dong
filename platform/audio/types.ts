import type { VisibilityState } from "../types";

export interface AudioPlaybackGate {
  enabled: boolean;
  isPlaying: boolean;
  visibilityState: VisibilityState;
}

export interface GoalSoundRequest {
  asset: number;
  volume?: number;
  shouldMixWithOthers?: boolean;
}

export interface AudioPlaybackStatus {
  isLoaded: boolean;
  isPlaying?: boolean;
  positionMillis?: number;
  durationMillis?: number;
}

export interface SoundInstance {
  playAsync(): Promise<unknown>;
  stopAsync(): Promise<unknown>;
  unloadAsync(): Promise<unknown>;
  getStatusAsync(): Promise<AudioPlaybackStatus>;
  setOnPlaybackStatusUpdate(
    callback: (status: AudioPlaybackStatus) => void,
  ): void;
}

export interface AudioModuleLike {
  Sound: {
    createAsync(
      asset: number,
      initialStatus?: Record<string, unknown>,
    ): Promise<{ sound: SoundInstance }>;
  };
  setAudioModeAsync(config: Record<string, unknown>): Promise<unknown>;
  InterruptionModeIOS?: {
    MixWithOthers?: unknown;
  };
  InterruptionModeAndroid?: {
    DuckOthers?: unknown;
  };
}

export interface GoalSoundPlayOptions extends AudioPlaybackGate {
  request?: GoalSoundRequest;
}

export interface SoundController {
  play(options: GoalSoundPlayOptions): Promise<boolean>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  getIsPlaying(): boolean;
}

export const canPlayAudio = ({
  enabled,
  isPlaying,
  visibilityState,
}: AudioPlaybackGate): boolean => {
  return enabled && !isPlaying && visibilityState === "active";
};
