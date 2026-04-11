export const SUPPORTED_PLATFORMS = ["ios", "android", "web"] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const CAPABILITY_IDS = [
  "audio",
  "dateInput",
  "animation",
  "visibility",
  "gesture",
] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export type CapabilityBehaviorClass = "full" | "degraded" | "noOp";
export type CapabilityFallbackType =
  | "alternateUI"
  | "reducedAnimation"
  | "noOpWithSignal"
  | "primaryControlOnly";
export type CapabilityUserVisibility = "silent" | "implicit" | "explicit";

export interface CapabilityImplementation {
  capability: CapabilityId;
  platform: SupportedPlatform;
  driver: string;
  entryPoint: string;
  behaviorClass: CapabilityBehaviorClass;
  notes?: string;
}

export interface CapabilityFallback {
  capability: CapabilityId;
  platform: SupportedPlatform;
  trigger: string;
  fallbackType: CapabilityFallbackType;
  preservedOutcome: string;
  userVisibility: CapabilityUserVisibility;
}

export interface CapabilityDescriptor {
  capability: CapabilityId;
  consumerFacingName: string;
  supportedPlatforms: SupportedPlatform[];
  fallbackPlatforms: SupportedPlatform[];
  outcomeGuarantee: string;
  implementations: CapabilityImplementation[];
  fallbacks: CapabilityFallback[];
}

export const CAPABILITY_NAMES: Record<CapabilityId, string> = {
  audio: "Goal sound playback",
  dateInput: "Shared date and time input",
  animation: "Decorative animation feedback",
  visibility: "Unified app visibility state",
  gesture: "Gesture-enhanced navigation",
};

export const CAPABILITY_OUTCOME_GUARANTEES: Record<CapabilityId, string> = {
  audio:
    "Screens can request cue playback and stop playback without handling platform-specific audio details.",
  dateInput:
    "Screens receive stable date and time values regardless of which picker renders on the current platform.",
  animation:
    "Decorative motion never blocks a screen from communicating splash or loading state.",
  visibility:
    "Foreground-sensitive behavior can rely on one normalized visibility signal across native and web.",
  gesture:
    "Gesture enhancements never become the only path for onboarding or tab navigation tasks.",
};

export const CORE_CAPABILITY_DESCRIPTORS: Record<
  Exclude<CapabilityId, "animation" | "gesture">,
  CapabilityDescriptor
> = {
  audio: {
    capability: "audio",
    consumerFacingName: CAPABILITY_NAMES.audio,
    supportedPlatforms: [...SUPPORTED_PLATFORMS],
    fallbackPlatforms: ["web"],
    outcomeGuarantee: CAPABILITY_OUTCOME_GUARANTEES.audio,
    implementations: [
      {
        capability: "audio",
        platform: "ios",
        driver: "expo-av",
        entryPoint: "platform/audio/useGoalSound",
        behaviorClass: "full",
        notes: "Keeps native audio mode setup inside the adapter.",
      },
      {
        capability: "audio",
        platform: "android",
        driver: "expo-av",
        entryPoint: "platform/audio/useGoalSound",
        behaviorClass: "full",
        notes: "Keeps ducking and interruption handling inside the adapter.",
      },
      {
        capability: "audio",
        platform: "web",
        driver: "expo-av",
        entryPoint: "platform/audio/useGoalSound",
        behaviorClass: "degraded",
        notes:
          "Playback may be skipped when browser autoplay restrictions block immediate audio.",
      },
    ],
    fallbacks: [
      {
        capability: "audio",
        platform: "web",
        trigger:
          "Browser playback restrictions or unavailable immediate audio focus.",
        fallbackType: "noOpWithSignal",
        preservedOutcome:
          "Goal handling, score updates, and toast feedback continue even when sound playback is skipped.",
        userVisibility: "implicit",
      },
    ],
  },
  dateInput: {
    capability: "dateInput",
    consumerFacingName: CAPABILITY_NAMES.dateInput,
    supportedPlatforms: [...SUPPORTED_PLATFORMS],
    fallbackPlatforms: ["web"],
    outcomeGuarantee: CAPABILITY_OUTCOME_GUARANTEES.dateInput,
    implementations: [
      {
        capability: "dateInput",
        platform: "ios",
        driver: "react-native-date-picker",
        entryPoint: "platform/date-input/PlatformDatePicker",
        behaviorClass: "full",
        notes: "Preserves the current native modal picker interaction.",
      },
      {
        capability: "dateInput",
        platform: "android",
        driver: "react-native-date-picker",
        entryPoint: "platform/date-input/PlatformDatePicker",
        behaviorClass: "full",
        notes: "Preserves the current native modal picker interaction.",
      },
      {
        capability: "dateInput",
        platform: "web",
        driver: "react-native-ui-datepicker",
        entryPoint: "platform/date-input/PlatformDatePicker",
        behaviorClass: "degraded",
        notes:
          "Uses a supported web picker while keeping the same outward value contract.",
      },
    ],
    fallbacks: [
      {
        capability: "dateInput",
        platform: "web",
        trigger:
          "Web uses a supported picker surface instead of the native modal date picker.",
        fallbackType: "alternateUI",
        preservedOutcome:
          "Players can still choose stable date and time values that drive the same filtering logic.",
        userVisibility: "implicit",
      },
    ],
  },
  visibility: {
    capability: "visibility",
    consumerFacingName: CAPABILITY_NAMES.visibility,
    supportedPlatforms: [...SUPPORTED_PLATFORMS],
    fallbackPlatforms: [],
    outcomeGuarantee: CAPABILITY_OUTCOME_GUARANTEES.visibility,
    implementations: [
      {
        capability: "visibility",
        platform: "ios",
        driver: "AppState",
        entryPoint: "platform/visibility/useAppVisibility",
        behaviorClass: "full",
        notes:
          "Normalizes foreground and background transitions for native app state.",
      },
      {
        capability: "visibility",
        platform: "android",
        driver: "AppState",
        entryPoint: "platform/visibility/useAppVisibility",
        behaviorClass: "full",
        notes:
          "Normalizes foreground and background transitions for native app state.",
      },
      {
        capability: "visibility",
        platform: "web",
        driver: "document.visibilityState",
        entryPoint: "platform/visibility/useAppVisibility",
        behaviorClass: "full",
        notes:
          "Maps browser tab visibility into the same app-facing visibility contract.",
      },
    ],
    fallbacks: [],
  },
};

export type VisibilityState = "active" | "inactive" | "background" | "hidden";
export type VisibilitySource = "appState" | "document";

export interface VisibilitySnapshot {
  state: VisibilityState;
  source: VisibilitySource;
  isInteractive: boolean;
  capturedAt: number;
}

export type DateInputMode = "date" | "time";

export interface DateInputValue {
  mode: DateInputMode;
  displayValue: string;
  isoValue: string;
  isEmptyAllowed: boolean;
  validationRule: string;
}

export type AnimationKind = "splash" | "loading";

export interface AnimationFallbackConfig {
  kind: AnimationKind;
  platform: SupportedPlatform;
  useNativeRenderer: boolean;
  fallbackType: Extract<
    CapabilityFallbackType,
    "alternateUI" | "reducedAnimation"
  >;
  preservedOutcome: string;
  accessibilityLabel: string;
}

export type GestureKind = "gestureRoot" | "onboardingSwipe" | "tabSwipe";

export interface GestureFallbackConfig {
  kind: GestureKind;
  platform: SupportedPlatform;
  enabled: boolean;
  fallbackType: Extract<
    CapabilityFallbackType,
    "alternateUI" | "primaryControlOnly"
  >;
  preservedOutcome: string;
  usesPrimaryControls: boolean;
  touchAction?: "none" | "pan-y";
}
