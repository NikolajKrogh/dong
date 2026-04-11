jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const { Animated } = require("react-native");

const createImmediateAnimation = () => ({
  start: (callback?: (result: { finished: boolean }) => void) => {
    callback?.({ finished: true });
  },
  stop: jest.fn(),
  reset: jest.fn(),
});

Animated.timing = jest.fn(createImmediateAnimation);
Animated.spring = jest.fn(createImmediateAnimation);
Animated.parallel = jest.fn(() => createImmediateAnimation());

const globalWithAnimation = globalThis as typeof globalThis & {
  requestAnimationFrame?: (callback: (time: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  matchMedia?: (query: string) => {
    matches: boolean;
    media: string;
    onchange: null;
    addListener: jest.Mock;
    removeListener: jest.Mock;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    dispatchEvent: jest.Mock;
  };
};

if (!globalWithAnimation.requestAnimationFrame) {
  globalWithAnimation.requestAnimationFrame = ((
    callback: (time: number) => void,
  ) => {
    return setTimeout(() => callback(Date.now()), 0) as unknown as number;
  }) as typeof globalWithAnimation.requestAnimationFrame;
}

if (!globalWithAnimation.cancelAnimationFrame) {
  globalWithAnimation.cancelAnimationFrame = ((handle: number) => {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  }) as typeof globalWithAnimation.cancelAnimationFrame;
}

if (!globalWithAnimation.matchMedia) {
  globalWithAnimation.matchMedia = jest
    .fn()
    .mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
}
