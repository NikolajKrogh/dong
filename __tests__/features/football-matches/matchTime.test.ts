import { describe, expect, it, jest } from "@jest/globals";
import { formatMatchTime } from "../../../features/football-matches/matchTime";

describe("formatMatchTime", () => {
  it.each([undefined, "", "   "])("omits absent kickoff %p", value => {
    expect(formatMatchTime(value)).toBeNull();
  });

  it.each([
    ["00:00", "00:00"], ["9:05", "09:05"], ["15:00:30", "15:00"],
    ["23:59:59", "23:59"], [" 9:05 ", "09:05"],
    ["8:30 PM", "20:30"], ["8:30am", "08:30"],
    ["12:00 AM", "00:00"], ["12:00 PM", "12:00"],
  ])("normalizes clock %s without timezone conversion", (input, expected) => {
    expect(formatMatchTime(input)).toBe(expected);
  });

  it.each(["24:00", "25:30", "9:60", "09:05:60", "0:30 AM", "13:00 PM"])(
    "omits invalid clock %s rather than inventing midnight", input => {
      expect(formatMatchTime(input)).toBeNull();
    },
  );

  it.each([[0, 0, "00:00"], [9, 5, "09:05"], [12, 0, "12:00"], [23, 59, "23:59"]])(
    "formats a real instant in the viewer timezone (%s:%s)", (hour, minute, expected) => {
      const instant = new Date(2026, 0, 15, Number(hour), Number(minute)).toISOString();
      expect(formatMatchTime(instant)).toBe(expected);
    },
  );

  it("preserves timezone date rollover when an offset identifies an instant", () => {
    const input = "2026-01-15T00:30:00+14:00";
    const local = new Date(input);
    const expected = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
    expect(formatMatchTime(input)).toBe(expected);
  });

  it("converts the recognized ESPN fallback from UTC", () => {
    const local = new Date();
    local.setUTCHours(19, 0, 0, 0);
    const expected = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
    expect(formatMatchTime("not-a-date T19:00Z trailing")).toBe(expected);
    expect(formatMatchTime("not-a-date T25:00Z trailing")).toBeNull();
  });

  it("preserves descriptive unknown kickoff labels", () => {
    expect(formatMatchTime("kick-off TBC")).toBe("kick-off TBC");
    expect(formatMatchTime("May 12")).toBe("May 12");
    expect(formatMatchTime("2026-01-15")).toBeNull();
    expect(formatMatchTime("2026-13-15T09:30:00Z")).toBeNull();
  });

  it("does not depend on the device locale formatter", () => {
    const spy = jest.spyOn(Date.prototype, "toLocaleTimeString").mockImplementation(() => {
      throw new Error("locale formatter unavailable");
    });
    try {
      const instant = new Date(2026, 0, 15, 20, 30).toISOString();
      expect(formatMatchTime(instant)).toBe("20:30");
    } finally {
      spy.mockRestore();
    }
  });
});
