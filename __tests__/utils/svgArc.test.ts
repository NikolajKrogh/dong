import { describeArc, polarToCartesian } from "../../utils/svgArc";

describe("polarToCartesian", () => {
  it.each([
    { angle: 0, x: 50, y: 10 },
    { angle: 90, x: 90, y: 50 },
    { angle: 180, x: 50, y: 90 },
  ])("returns ($x, $y) for angle $angle", ({ angle, x, y }) => {
    const point = polarToCartesian(50, 50, 40, angle);
    expect(point.x).toBeCloseTo(x);
    expect(point.y).toBeCloseTo(y);
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

  it.each([360, -360])("handles a full-circle span of %s without NaN coordinates", (angle) => {
    const path = describeArc(50, 50, 40, 0, angle);
    expect(path).not.toContain("NaN");
    expect(path.length).toBeGreaterThan(0);
  });
});
