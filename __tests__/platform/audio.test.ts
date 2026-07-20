import { createSoundController } from "../../platform/audio/createSoundController";
import type { AudioPlaybackStatus } from "../../platform/audio/types";

describe("platform audio adapters", () => {
  it("plays the goal sound only when playback is allowed", async () => {
    let playbackStatusHandler: ((status: AudioPlaybackStatus) => void) | undefined;

    const player = {
      playing: false,
      volume: 1,
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn((_event: string, callback: (status: AudioPlaybackStatus) => void) => {
        playbackStatusHandler = callback;
        return { remove: jest.fn() };
      }),
    };

    const audioModule = {
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
      createPlayer: jest.fn().mockReturnValue(player),
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
    expect(audioModule.createPlayer).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(controller.getIsPlaying()).toBe(true);
    expect(playbackTransitions).toContain(true);

    playbackStatusHandler?.({
      isLoaded: true,
      playing: false,
      currentTime: 1.2,
      duration: 1.2,
      didJustFinish: true,
    });

    await Promise.resolve();

    expect(player.remove).toHaveBeenCalledTimes(1);
    expect(controller.getIsPlaying()).toBe(false);
    expect(playbackTransitions).toContain(false);
  });

  it("does not start playback while hidden", async () => {
    const audioModule = {
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
      createPlayer: jest.fn(),
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
    expect(audioModule.createPlayer).not.toHaveBeenCalled();
  });

  it("stops and removes the current player", async () => {
    const player = {
      playing: true,
      volume: 1,
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    };

    const audioModule = {
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
      createPlayer: jest.fn().mockReturnValue(player),
    };

    const controller = createSoundController({ audioModule });
    await controller.play({
      enabled: true,
      isPlaying: false,
      visibilityState: "active",
    });

    await controller.stop();

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.remove).toHaveBeenCalledTimes(1);
    expect(controller.getIsPlaying()).toBe(false);
  });
});
