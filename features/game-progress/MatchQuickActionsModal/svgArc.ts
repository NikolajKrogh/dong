/**
 * @file SVG arc geometry helpers used by circular/doughnut chart visualizations.
 */

/**
 * Convert polar coordinates to cartesian for an SVG arc.
 * @param {number} centerX X coordinate of center.
 * @param {number} centerY Y coordinate of center.
 * @param {number} radius Arc radius.
 * @param {number} angleInDegrees Angle in degrees.
 * @returns {{x:number,y:number}} Cartesian coordinates.
 */
export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

/**
 * Describe an SVG arc path segment.
 * Handles full-circle edge cases by slightly shrinking span.
 * @param {number} x Center X.
 * @param {number} y Center Y.
 * @param {number} radius Arc radius.
 * @param {number} startAngle Starting angle (deg).
 * @param {number} endAngle Ending angle (deg).
 * @param {boolean} [counterClockwise=false] Direction flag; true = CCW.
 * @returns {string} SVG path definition or empty string if no arc span.
 */
export function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterClockwise: boolean = false,
): string {
  if (startAngle === endAngle || Math.abs(startAngle - endAngle) < 0.01) {
    return ""; // No arc to draw
  }
  // Ensure endAngle is slightly different from startAngle if it's a full circle from 0 to 360
  if (
    Math.abs(endAngle - startAngle - 360) < 0.01 ||
    Math.abs(endAngle - startAngle + 360) < 0.01
  ) {
    endAngle = startAngle + (endAngle > startAngle ? 359.99 : -359.99);
  } else if (endAngle >= 360 && startAngle === 0) {
    endAngle = 359.99;
  }

  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);

  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
  const sweepFlag = counterClockwise ? "1" : "0"; // 0 for clockwise, 1 for counter-clockwise

  const d = [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    sweepFlag,
    end.x,
    end.y,
  ].join(" ");

  return d;
}
