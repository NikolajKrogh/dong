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
  playing?: boolean;
  currentTime?: number;
  duration?: number;
  didJustFinish?: boolean;
}

export interface AudioPlayerLike {
  playing: boolean;
  volume: number;
  play(): void;
  pause(): void;
  remove(): void;
  addListener(
    event: "playbackStatusUpdate",
    listener: (status: AudioPlaybackStatus) => void,
  ): { remove(): void };
}

export interface AudioModuleLike {
  createPlayer(asset: number): AudioPlayerLike;
  setAudioModeAsync(config: Record<string, unknown>): Promise<unknown>;
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
