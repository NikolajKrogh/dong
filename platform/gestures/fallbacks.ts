import { getRuntimePlatform } from "../environment";

import type {
  CapabilityDescriptor,
  CapabilityFallback,
  CapabilityImplementation,
  GestureFallbackConfig,
  GestureKind,
  SupportedPlatform,
} from "../types";
import {
  CAPABILITY_NAMES,
  CAPABILITY_OUTCOME_GUARANTEES,
  SUPPORTED_PLATFORMS,
} from "../types";

const gestureOutcomes: Record<GestureKind, string> = {
  gestureRoot:
    "The application shell can still render and receive touch input.",
  onboardingSwipe:
    "Players can still move through onboarding with visible skip and continue controls.",
  tabSwipe: "Players can still switch between tabs with visible tab buttons.",
};

export const GESTURE_FALLBACKS: Record<
  GestureKind,
  Record<SupportedPlatform, GestureFallbackConfig>
> = {
  gestureRoot: {
    ios: {
      kind: "gestureRoot",
      platform: "ios",
      enabled: true,
      fallbackType: "alternateUI",
      preservedOutcome: gestureOutcomes.gestureRoot,
      usesPrimaryControls: false,
      touchAction: "none",
    },
    android: {
      kind: "gestureRoot",
      platform: "android",
      enabled: true,
      fallbackType: "alternateUI",
      preservedOutcome: gestureOutcomes.gestureRoot,
      usesPrimaryControls: false,
      touchAction: "none",
    },
    web: {
      kind: "gestureRoot",
      platform: "web",
      enabled: false,
      fallbackType: "primaryControlOnly",
      preservedOutcome: gestureOutcomes.gestureRoot,
      usesPrimaryControls: true,
      touchAction: "none",
    },
  },
  onboardingSwipe: {
    ios: {
      kind: "onboardingSwipe",
      platform: "ios",
      enabled: true,
      fallbackType: "alternateUI",
      preservedOutcome: gestureOutcomes.onboardingSwipe,
      usesPrimaryControls: true,
      touchAction: "none",
    },
    android: {
      kind: "onboardingSwipe",
      platform: "android",
      enabled: true,
      fallbackType: "alternateUI",
      preservedOutcome: gestureOutcomes.onboardingSwipe,
      usesPrimaryControls: true,
      touchAction: "none",
    },
    web: {
      kind: "onboardingSwipe",
      platform: "web",
      enabled: false,
      fallbackType: "primaryControlOnly",
      preservedOutcome: gestureOutcomes.onboardingSwipe,
      usesPrimaryControls: true,
      touchAction: "none",
    },
  },
  tabSwipe: {
    ios: {
      kind: "tabSwipe",
      platform: "ios",
      enabled: true,
      fallbackType: "alternateUI",
      preservedOutcome: gestureOutcomes.tabSwipe,
      usesPrimaryControls: true,
      touchAction: "pan-y",
    },
    android: {
      kind: "tabSwipe",
      platform: "android",
      enabled: true,
      fallbackType: "alternateUI",
      preservedOutcome: gestureOutcomes.tabSwipe,
      usesPrimaryControls: true,
      touchAction: "pan-y",
    },
    web: {
      kind: "tabSwipe",
      platform: "web",
      enabled: false,
      fallbackType: "primaryControlOnly",
      preservedOutcome: gestureOutcomes.tabSwipe,
      usesPrimaryControls: true,
      touchAction: "pan-y",
    },
  },
};

export const GESTURE_IMPLEMENTATIONS: CapabilityImplementation[] = [
  {
    capability: "gesture",
    platform: "ios",
    driver: "react-native gesture wrappers",
    entryPoint: "platform/gestures/PlatformGestureView",
    behaviorClass: "full",
    notes: "Keeps swipe-enhanced onboarding and tab navigation on iOS.",
  },
  {
    capability: "gesture",
    platform: "android",
    driver: "react-native gesture wrappers",
    entryPoint: "platform/gestures/PlatformGestureView",
    behaviorClass: "full",
    notes: "Keeps swipe-enhanced onboarding and tab navigation on Android.",
  },
  {
    capability: "gesture",
    platform: "web",
    driver: "PanResponder plus visible primary controls",
    entryPoint: "platform/gestures/PlatformSwipeTabs",
    behaviorClass: "degraded",
    notes:
      "Prefers visible buttons and web-safe interaction over native-parity gestures.",
  },
];

export const GESTURE_CAPABILITY_FALLBACKS: CapabilityFallback[] = [
  {
    capability: "gesture",
    platform: "web",
    trigger:
      "Onboarding progression is rendered on a platform where gesture enhancement is disabled.",
    fallbackType: "primaryControlOnly",
    preservedOutcome: GESTURE_FALLBACKS.onboardingSwipe.web.preservedOutcome,
    userVisibility: "implicit",
  },
  {
    capability: "gesture",
    platform: "web",
    trigger:
      "Tab navigation is rendered on a platform where swipe enhancement is disabled.",
    fallbackType: "primaryControlOnly",
    preservedOutcome: GESTURE_FALLBACKS.tabSwipe.web.preservedOutcome,
    userVisibility: "implicit",
  },
];

export const GESTURE_CAPABILITY_DESCRIPTOR: CapabilityDescriptor = {
  capability: "gesture",
  consumerFacingName: CAPABILITY_NAMES.gesture,
  supportedPlatforms: [...SUPPORTED_PLATFORMS],
  fallbackPlatforms: ["web"],
  outcomeGuarantee: CAPABILITY_OUTCOME_GUARANTEES.gesture,
  implementations: GESTURE_IMPLEMENTATIONS,
  fallbacks: GESTURE_CAPABILITY_FALLBACKS,
};

export const getGestureFallback = (
  kind: GestureKind,
  platform: SupportedPlatform = getRuntimePlatform(),
): GestureFallbackConfig => {
  return GESTURE_FALLBACKS[kind][platform];
};

export const supportsGestureEnhancement = (
  kind: GestureKind,
  platform: SupportedPlatform = getRuntimePlatform(),
): boolean => {
  return getGestureFallback(kind, platform).enabled;
};
