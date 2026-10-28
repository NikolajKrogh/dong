import { describe, expect, it, jest } from "@jest/globals";

import { formatMatchTime } from "../../../features/football-matches/matchTime";

/**
 * `Match.startTime` is deliberately loose — match discovery writes a local
 * "HH:MM", a room's pool writes a full ISO instant, and a hand-typed fixture
 * writes nothing. These tests pin each branch so the wizard and the multiplayer
 * room cannot start rendering the same fixture differently.
 */
describe("formatMatchTime", () => {
  describe("absent kickoff", () => {
    it.each([
      ["undefined", undefined],
      ["empty string", ""],
    ])("returns null for %s", (_label, value) => {
      expect(formatMatchTime(value)).toBeNull();
    });
  });

  describe("a real instant (the room's kickoffAt)", () => {
    it("formats to a 12-hour clock time", () => {
      // Asserted loosely on purpose: the exact hour depends on the runner's
      // timezone, so pinning "11:30 AM" would make this test machine-specific.
      const formatted = formatMatchTime("2026-08-22T11:30:00.000Z");

      expect(formatted).toMatch(/^\d{2}:\d{2} (AM|PM)$/);
    });

    it("reflects the instant, not the literal characters", () => {
      const noon = formatMatchTime("2026-08-22T12:00:00.000Z");
      const midnight = formatMatchTime("2026-08-22T00:00:00.000Z");

      expect(noon).not.toEqual(midnight);
    });
  });

  describe("a bare clock time (match discovery's display string)", () => {
    it.each(["15:00", "9:05", "15:00:00"])(
      "passes %s through untouched",
      (value) => {
        expect(formatMatchTime(value)).toBe(value);
      },
    );


  });

  describe("an ESPN-shaped string Date cannot parse", () => {
    it("extracts the UTC time and formats it", () => {
      const formatted = formatMatchTime("not-a-date T19:00Z trailing");

      expect(formatted).toMatch(/^\d{2}:\d{2} (AM|PM)$/);
    });
  });

  describe("unrecognised input", () => {
    it("returns the raw string rather than hiding the fixture's time", () => {
      expect(formatMatchTime("kick-off TBC")).toBe("kick-off TBC");
    });

    it("returns the raw string when formatting throws", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const timeSpy = jest.spyOn(Date.prototype, "toLocaleTimeString").mockImplementation(() => {
        throw new Error("boom");
      });

      try {
        expect(formatMatchTime("2026-08-22T11:30:00.000Z")).toBe(
          "2026-08-22T11:30:00.000Z",
        );
      } finally {
        timeSpy.mockRestore();
        logSpy.mockRestore();
      }
    });
  });
});
