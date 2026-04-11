import {
  type AudioModuleLike,
  canPlayAudio,
  type GoalSoundRequest,
  type GoalSoundPlayOptions,
  type SoundController,
  type AudioPlaybackStatus,
  type SoundInstance,
} from "./types";

const defaultGoalSoundRequest: GoalSoundRequest = {
  asset: require("../../assets/sounds/dong.mp3"),
  volume: 1,
  shouldMixWithOthers: true,
};

const isPlaybackComplete = (status: AudioPlaybackStatus): boolean => {
  return (
    status.isLoaded &&
    !status.isPlaying &&
    typeof status.positionMillis === "number" &&
    typeof status.durationMillis === "number" &&
    status.positionMillis >= status.durationMillis
  );
};

interface CreateSoundControllerOptions {
  audioModule?: AudioModuleLike | null;
  onError?: (error: unknown) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export const createSoundController = ({
  audioModule,
  onError,
  onPlaybackStateChange,
}: CreateSoundControllerOptions = {}): SoundController => {
  let sound: SoundInstance | null = null;
  let isPlaying = false;

  const setPlayingState = (nextState: boolean) => {
    isPlaying = nextState;
    onPlaybackStateChange?.(nextState);
  };

  const stop = async () => {
    if (!sound) {
      setPlayingState(false);
      return;
    }

    const currentSound = sound;
    sound = null;
    setPlayingState(false);

    try {
      const status = await currentSound.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await currentSound.stopAsync();
        }
        await currentSound.unloadAsync();
      }
    } catch (error) {
      onError?.(error);
    }
  };

  const bindPlaybackListener = (createdSound: SoundInstance) => {
    createdSound.setOnPlaybackStatusUpdate((status) => {
      if (isPlaybackComplete(status)) {
        void stop();
      }
    });
  };

  return {
    async play({ request = defaultGoalSoundRequest, ...gate }: GoalSoundPlayOptions) {
      if (!audioModule || !canPlayAudio({ ...gate, isPlaying })) {
        return false;
      }

      await stop();
      setPlayingState(true);

      try {
        await audioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeIOS:
            audioModule.InterruptionModeIOS?.MixWithOthers,
          interruptionModeAndroid:
            audioModule.InterruptionModeAndroid?.DuckOthers,
        });

        const { sound: createdSound } = await audioModule.Sound.createAsync(
          request.asset,
          {
            volume: request.volume ?? 1,
          }
        );

        sound = createdSound;
        bindPlaybackListener(createdSound);
        await createdSound.playAsync();
        return true;
      } catch (error) {
        sound = null;
        setPlayingState(false);
        onError?.(error);
        return false;
      }
    },
    stop,
    dispose: stop,
    getIsPlaying: () => isPlaying,
  };
};