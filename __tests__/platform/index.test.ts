import * as platform from "../../platform";

describe("platform public API", () => {
  it("exposes shared adapters and capability descriptors from the barrel", () => {
    expect(platform.PlatformAnimation).toBeDefined();
    expect(platform.PlatformDatePicker).toBeDefined();
    expect(platform.PlatformSwipeTabs).toBeDefined();
    expect(platform.useGoalSound).toBeDefined();
    expect(platform.useAppVisibility).toBeDefined();

    expect(platform.PLATFORM_CAPABILITY_LIST).toHaveLength(
      platform.CAPABILITY_IDS.length,
    );
    expect(platform.getCapabilityDescriptor("audio")).toMatchObject({
      capability: "audio",
      consumerFacingName: platform.CAPABILITY_NAMES.audio,
    });
  });
});
