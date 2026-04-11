import { ANIMATION_CAPABILITY_DESCRIPTOR } from "./animation";
import { GESTURE_CAPABILITY_DESCRIPTOR } from "./gestures";
import {
  CAPABILITY_IDS,
  type CapabilityDescriptor,
  type CapabilityId,
  CORE_CAPABILITY_DESCRIPTORS,
} from "./types";

export * from "./types";
export * from "./environment";
export * from "./audio";
export * from "./date-input";
export * from "./animation";
export * from "./visibility";
export * from "./gestures";

export const PLATFORM_CAPABILITY_DESCRIPTORS: Record<
  CapabilityId,
  CapabilityDescriptor
> = {
  ...CORE_CAPABILITY_DESCRIPTORS,
  animation: ANIMATION_CAPABILITY_DESCRIPTOR,
  gesture: GESTURE_CAPABILITY_DESCRIPTOR,
};

export const PLATFORM_CAPABILITY_LIST = CAPABILITY_IDS.map(
  (capability) => PLATFORM_CAPABILITY_DESCRIPTORS[capability],
);

export const getCapabilityDescriptor = (
  capability: CapabilityId,
): CapabilityDescriptor => {
  return PLATFORM_CAPABILITY_DESCRIPTORS[capability];
};
