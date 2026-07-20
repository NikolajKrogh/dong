import { describeArc, polarToCartesian } from "../../utils/svgArc";

describe("polarToCartesian", () => {
  it("returns the top point for angle 0", () => {
    const point = polarToCartesian(50, 50, 40, 0);
    expect(point.x).toBeCloseTo(50);
    expect(point.y).toBeCloseTo(10);
  });

  it("returns the right point for angle 90", () => {
    const point = polarToCartesian(50, 50, 40, 90);
    expect(point.x).toBeCloseTo(90);
    expect(point.y).toBeCloseTo(50);
  });

  it("returns the bottom point for angle 180", () => {
    const point = polarToCartesian(50, 50, 40, 180);
    expect(point.x).toBeCloseTo(50);
    expect(point.y).toBeCloseTo(90);
  });
});

describe("describeArc", () => {
  it("returns an empty string when start and end angles are equal", () => {
    expect(describeArc(50, 50, 40, 90, 90)).toBe("");
  });

  it("returns an empty string when start and end angles are within the epsilon", () => {
    expect(describeArc(50, 50, 40, 90, 90.005)).toBe("");
  });

  it("produces a path string for a normal clockwise arc", () => {
    const path = describeArc(50, 50, 40, 0, 90);
    expect(path).toMatch(/^M .* A 40 40 0 0 0 .*$/);
  });

  it("produces a path string for a counter-clockwise arc", () => {
    const path = describeArc(50, 50, 40, 0, -90, true);
    expect(path).toMatch(/^M .* A 40 40 0 0 1 .*$/);
  });

  it("sets the large-arc-flag when the span exceeds 180 degrees", () => {
    const path = describeArc(50, 50, 40, 0, 270);
    const flag = path.split(" ")[7];
    expect(flag).toBe("1");
  });

  it("sets no large-arc-flag when the span is 180 degrees or less", () => {
    const path = describeArc(50, 50, 40, 0, 90);
    const flag = path.split(" ")[7];
    expect(flag).toBe("0");
  });

  it("handles a full-circle span (360 degrees) without producing NaN coordinates", () => {
    const path = describeArc(50, 50, 40, 0, 360);
    expect(path).not.toContain("NaN");
    expect(path.length).toBeGreaterThan(0);
  });

  it("handles a negative full-circle span (-360 degrees) without producing NaN coordinates", () => {
    const path = describeArc(50, 50, 40, 0, -360);
    expect(path).not.toContain("NaN");
    expect(path.length).toBeGreaterThan(0);
  });
});
