import { getRuntimePlatform } from "../environment";

import type {
  AnimationFallbackConfig,
  AnimationKind,
  CapabilityDescriptor,
  CapabilityFallback,
  CapabilityImplementation,
  SupportedPlatform,
} from "../types";
import {
  CAPABILITY_NAMES,
  CAPABILITY_OUTCOME_GUARANTEES,
  SUPPORTED_PLATFORMS,
} from "../types";

const animationOutcomes: Record<
  AnimationKind,
  Pick<AnimationFallbackConfig, "preservedOutcome" | "accessibilityLabel">
> = {
  splash: {
    preservedOutcome:
      "The splash state still communicates branding while the application is loading.",
    accessibilityLabel: "DONG splash fallback",
  },
  loading: {
    preservedOutcome:
      "The loading state still communicates that match data is being fetched.",
    accessibilityLabel: "DONG loading fallback",
  },
};

export const ANIMATION_FALLBACKS: Record<
  AnimationKind,
  Record<SupportedPlatform, AnimationFallbackConfig>
> = {
  splash: {
    ios: {
      kind: "splash",
      platform: "ios",
      useNativeRenderer: true,
      fallbackType: "reducedAnimation",
      ...animationOutcomes.splash,
    },
    android: {
      kind: "splash",
      platform: "android",
      useNativeRenderer: true,
      fallbackType: "reducedAnimation",
      ...animationOutcomes.splash,
    },
    web: {
      kind: "splash",
      platform: "web",
      useNativeRenderer: false,
      fallbackType: "alternateUI",
      ...animationOutcomes.splash,
    },
  },
  loading: {
    ios: {
      kind: "loading",
      platform: "ios",
      useNativeRenderer: true,
      fallbackType: "reducedAnimation",
      ...animationOutcomes.loading,
    },
    android: {
      kind: "loading",
      platform: "android",
      useNativeRenderer: true,
      fallbackType: "reducedAnimation",
      ...animationOutcomes.loading,
    },
    web: {
      kind: "loading",
      platform: "web",
      useNativeRenderer: false,
      fallbackType: "alternateUI",
      ...animationOutcomes.loading,
    },
  },
};

export const ANIMATION_IMPLEMENTATIONS: CapabilityImplementation[] = [
  {
    capability: "animation",
    platform: "ios",
    driver: "lottie-react-native",
    entryPoint: "platform/animation/PlatformAnimation",
    behaviorClass: "full",
    notes: "Keeps the existing native splash and loading motion on iOS.",
  },
  {
    capability: "animation",
    platform: "android",
    driver: "lottie-react-native",
    entryPoint: "platform/animation/PlatformAnimation",
    behaviorClass: "full",
    notes: "Keeps the existing native splash and loading motion on Android.",
  },
  {
    capability: "animation",
    platform: "web",
    driver: "platform fallback renderer",
    entryPoint: "platform/animation/PlatformAnimation",
    behaviorClass: "degraded",
    notes:
      "Uses an explicit static or icon fallback instead of the native Lottie runtime.",
  },
];

export const ANIMATION_CAPABILITY_FALLBACKS: CapabilityFallback[] = [
  {
    capability: "animation",
    platform: "web",
    trigger:
      "Splash branding is requested on a platform that does not use the native Lottie renderer.",
    fallbackType: "alternateUI",
    preservedOutcome: ANIMATION_FALLBACKS.splash.web.preservedOutcome,
    userVisibility: "implicit",
  },
  {
    capability: "animation",
    platform: "web",
    trigger:
      "Loading feedback is requested on a platform that does not use the native Lottie renderer.",
    fallbackType: "alternateUI",
    preservedOutcome: ANIMATION_FALLBACKS.loading.web.preservedOutcome,
    userVisibility: "implicit",
  },
];

export const ANIMATION_CAPABILITY_DESCRIPTOR: CapabilityDescriptor = {
  capability: "animation",
  consumerFacingName: CAPABILITY_NAMES.animation,
  supportedPlatforms: [...SUPPORTED_PLATFORMS],
  fallbackPlatforms: ["web"],
  outcomeGuarantee: CAPABILITY_OUTCOME_GUARANTEES.animation,
  implementations: ANIMATION_IMPLEMENTATIONS,
  fallbacks: ANIMATION_CAPABILITY_FALLBACKS,
};

export const getAnimationFallback = (
  kind: AnimationKind,
  platform: SupportedPlatform = getRuntimePlatform(),
): AnimationFallbackConfig => {
  return ANIMATION_FALLBACKS[kind][platform];
};

export const canUseNativeAnimation = (
  kind: AnimationKind,
  platform: SupportedPlatform = getRuntimePlatform(),
): boolean => {
  return getAnimationFallback(kind, platform).useNativeRenderer;
};
