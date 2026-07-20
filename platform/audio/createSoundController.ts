import {
  type AudioModuleLike,
  canPlayAudio,
  type GoalSoundRequest,
  type GoalSoundPlayOptions,
  type SoundController,
  type AudioPlayerLike,
} from "./types";

const defaultGoalSoundRequest: GoalSoundRequest = {
  asset: require("../../assets/sounds/dong.mp3"),
  volume: 1,
  shouldMixWithOthers: true,
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
  let player: AudioPlayerLike | null = null;
  let subscription: { remove(): void } | null = null;
  let isPlaying = false;

  const setPlayingState = (nextState: boolean) => {
    isPlaying = nextState;
    onPlaybackStateChange?.(nextState);
  };

  const stop = async () => {
    if (!player) {
      setPlayingState(false);
      return;
    }

    const currentPlayer = player;
    player = null;
    subscription?.remove();
    subscription = null;
    setPlayingState(false);

    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch (error) {
      onError?.(error);
    }
  };

  const bindPlaybackListener = (createdPlayer: AudioPlayerLike) => {
    subscription = createdPlayer.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
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
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: "mixWithOthers",
        });

        const createdPlayer = audioModule.createPlayer(request.asset);
        createdPlayer.volume = request.volume ?? 1;

        player = createdPlayer;
        bindPlaybackListener(createdPlayer);
        createdPlayer.play();
        return true;
      } catch (error) {
        player = null;
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
