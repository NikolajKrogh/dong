import { createSoundController } from "../../platform/audio/createSoundController";

describe("platform audio adapters", () => {
  it("plays the goal sound only when playback is allowed", async () => {
    let playbackStatusHandler:
      | ((status: {
          isLoaded: boolean;
          isPlaying?: boolean;
          positionMillis?: number;
          durationMillis?: number;
        }) => void)
      | undefined;

    const sound = {
      playAsync: jest.fn().mockResolvedValue(undefined),
      stopAsync: jest.fn().mockResolvedValue(undefined),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
      getStatusAsync: jest.fn().mockResolvedValue({
        isLoaded: true,
        isPlaying: false,
      }),
      setOnPlaybackStatusUpdate: jest.fn((callback) => {
        playbackStatusHandler = callback;
      }),
    };

    const audioModule = {
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
      Sound: {
        createAsync: jest.fn().mockResolvedValue({ sound }),
      },
      InterruptionModeIOS: { MixWithOthers: "mix" },
      InterruptionModeAndroid: { DuckOthers: "duck" },
    };

    const playbackTransitions: boolean[] = [];
    const controller = createSoundController({
      audioModule,
      onPlaybackStateChange: (isPlaying) => playbackTransitions.push(isPlaying),
    });

    await expect(
      controller.play({
        enabled: true,
        isPlaying: false,
        visibilityState: "active",
      }),
    ).resolves.toBe(true);

    expect(audioModule.setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(audioModule.Sound.createAsync).toHaveBeenCalledTimes(1);
    expect(sound.playAsync).toHaveBeenCalledTimes(1);
    expect(controller.getIsPlaying()).toBe(true);
    expect(playbackTransitions).toContain(true);

    playbackStatusHandler?.({
      isLoaded: true,
      isPlaying: false,
      positionMillis: 1200,
      durationMillis: 1200,
    });

    await Promise.resolve();

    expect(sound.unloadAsync).toHaveBeenCalledTimes(1);
    expect(controller.getIsPlaying()).toBe(false);
    expect(playbackTransitions).toContain(false);
  });

  it("does not start playback while hidden", async () => {
    const audioModule = {
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
      Sound: {
        createAsync: jest.fn(),
      },
    };

    const controller = createSoundController({ audioModule });
    await expect(
      controller.play({
        enabled: true,
        isPlaying: false,
        visibilityState: "hidden",
      }),
    ).resolves.toBe(false);

    expect(audioModule.setAudioModeAsync).not.toHaveBeenCalled();
    expect(audioModule.Sound.createAsync).not.toHaveBeenCalled();
  });

  it("stops and unloads the current sound", async () => {
    const sound = {
      playAsync: jest.fn().mockResolvedValue(undefined),
      stopAsync: jest.fn().mockResolvedValue(undefined),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
      getStatusAsync: jest.fn().mockResolvedValue({
        isLoaded: true,
        isPlaying: true,
      }),
      setOnPlaybackStatusUpdate: jest.fn(),
    };

    const audioModule = {
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
      Sound: {
        createAsync: jest.fn().mockResolvedValue({ sound }),
      },
    };

    const controller = createSoundController({ audioModule });
    await controller.play({
      enabled: true,
      isPlaying: false,
      visibilityState: "active",
    });

    await controller.stop();

    expect(sound.stopAsync).toHaveBeenCalledTimes(1);
    expect(sound.unloadAsync).toHaveBeenCalledTimes(1);
    expect(controller.getIsPlaying()).toBe(false);
  });
});
