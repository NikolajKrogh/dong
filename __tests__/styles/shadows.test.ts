import { Platform } from "react-native";
import { androidElevationFallback, hexWithAlpha } from "../../styles/shadows";

describe("hexWithAlpha", () => {
  it("expands a 3-digit color and appends the requested opacity", () => {
    expect(hexWithAlpha("#000", 0.2)).toBe("#00000033");
  });

  it("preserves a 6-digit color and appends the requested opacity", () => {
    expect(hexWithAlpha("#212529", 0.25)).toBe("#21252940");
  });

  it("rejects colors outside the palette's 3- and 6-digit hex formats", () => {
    expect(() => hexWithAlpha("#abcd", 0.2)).toThrow(
      "Expected a 3- or 6-digit hex color",
    );
    expect(() => hexWithAlpha("x123", 0.2)).toThrow(
      "Expected a 3- or 6-digit hex color",
    );
  });
});

describe("androidElevationFallback", () => {
  const originalOS = Object.getOwnPropertyDescriptor(Platform, "OS");
  const originalVersion = Object.getOwnPropertyDescriptor(Platform, "Version");

  const setPlatform = (os: string, version: number) => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      enumerable: true,
      value: os,
    });
    Object.defineProperty(Platform, "Version", {
      configurable: true,
      enumerable: true,
      value: version,
    });
  };

  afterEach(() => {
    if (originalOS) {
      Object.defineProperty(Platform, "OS", originalOS);
    } else {
      Reflect.deleteProperty(Platform, "OS");
    }

    if (originalVersion) {
      Object.defineProperty(Platform, "Version", originalVersion);
    } else {
      Reflect.deleteProperty(Platform, "Version");
    }
  });

  it("keeps elevation on Android versions before boxShadow support", () => {
    setPlatform("android", 27);

    expect(androidElevationFallback(4)).toEqual({ elevation: 4 });
  });

  it("uses boxShadow without elevation on Android 9 and newer", () => {
    setPlatform("android", 28);

    expect(androidElevationFallback(4)).toEqual({});
  });

  it("does not add elevation on web", () => {
    setPlatform("web", 27);

    expect(androidElevationFallback(4)).toEqual({});
  });

  it("does not add elevation on iOS", () => {
    setPlatform("ios", 27);

    expect(androidElevationFallback(4)).toEqual({});
  });
});
