import {
  PLATFORM_CAPABILITY_DESCRIPTORS,
  getAnimationFallback,
  getGestureFallback,
} from "../../platform";

describe("platform fallback metadata", () => {
  it("keeps animation descriptor metadata aligned with web fallbacks", () => {
    const animationDescriptor = PLATFORM_CAPABILITY_DESCRIPTORS.animation;
    const loadingFallback = getAnimationFallback("loading", "web");

    expect(animationDescriptor.fallbackPlatforms).toContain("web");
    expect(animationDescriptor.fallbacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "web",
          fallbackType: "alternateUI",
          preservedOutcome: loadingFallback.preservedOutcome,
        }),
      ]),
    );
  });

  it("keeps gesture descriptor metadata aligned with primary-control fallbacks", () => {
    const gestureDescriptor = PLATFORM_CAPABILITY_DESCRIPTORS.gesture;
    const webTabFallback = getGestureFallback("tabSwipe", "web");

    expect(gestureDescriptor.fallbackPlatforms).toContain("web");
    expect(gestureDescriptor.fallbacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "web",
          fallbackType: webTabFallback.fallbackType,
          preservedOutcome: webTabFallback.preservedOutcome,
        }),
      ]),
    );
  });
});
