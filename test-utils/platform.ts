import { getAnimationFallback } from "../platform/animation/fallbacks";
import { getGestureFallback } from "../platform/gestures/fallbacks";

import type {
  AnimationKind,
  GestureKind,
  SupportedPlatform,
  VisibilitySnapshot,
} from "../platform/types";

export const createMockVisibilitySnapshot = (
  overrides: Partial<VisibilitySnapshot> = {}
): VisibilitySnapshot => ({
  state: "active",
  source: "appState",
  isInteractive: true,
  capturedAt: 0,
  ...overrides,
});

export const createReactNativePlatformMock = (os: SupportedPlatform) => {
  class MockAnimatedValue {
    private currentValue: number;

    constructor(initialValue: number) {
      this.currentValue = initialValue;
    }

    setValue = jest.fn((nextValue: number) => {
      this.currentValue = nextValue;
    });

    __getValue = () => this.currentValue;
  }

  const createImmediateAnimation = () => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      callback?.({ finished: true });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  });

  return {
    Platform: {
      OS: os,
      select: <T>(config: Record<string, T> & { default?: T }) => {
        return config[os] ?? config.default;
      },
    },
    View: "View",
    Text: "Text",
    Modal: "Modal",
    Pressable: "Pressable",
    TouchableOpacity: "TouchableOpacity",
    ScrollView: "ScrollView",
    AppState: {
      currentState: "active",
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    Dimensions: {
      get: () => ({ width: 400, height: 800 }),
    },
    StyleSheet: {
      create: <T>(styles: T) => styles,
    },
    PanResponder: {
      create: (handlers: Record<string, unknown>) => ({
        panHandlers: handlers,
      }),
    },
    Animated: {
      Value: MockAnimatedValue,
      View: "Animated.View",
      timing: jest.fn(createImmediateAnimation),
      spring: jest.fn(createImmediateAnimation),
      parallel: jest.fn(() => createImmediateAnimation()),
    },
  };
};

export const createDocumentVisibilityMock = (visibilityState = "visible") => ({
  visibilityState,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
});

export const getAnimationFallbackFor = (
  kind: AnimationKind,
  platform: SupportedPlatform
) => {
  return getAnimationFallback(kind, platform);
};

export const getGestureFallbackFor = (
  kind: GestureKind,
  platform: SupportedPlatform
) => {
  return getGestureFallback(kind, platform);
};