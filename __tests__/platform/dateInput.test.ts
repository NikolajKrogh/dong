import {
  coerceDateInputDate,
  formatDateIsoValue,
  formatTimeIsoValue,
  parseDateIsoValue,
  parseTimeIsoValue,
} from "../../platform/date-input/normalizeValue";
import { createReactNativePlatformMock } from "../../test-utils/platform";

describe("platform date input adapters", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("formats and parses date and time values consistently", () => {
    const date = new Date(2026, 3, 11, 9, 5);

    expect(formatDateIsoValue(date)).toBe("2026-04-11");
    expect(formatTimeIsoValue(date)).toBe("09:05");
    expect(parseDateIsoValue("2026-04-11").getDate()).toBe(11);
    expect(parseTimeIsoValue("09:05", new Date(2026, 3, 11)).getHours()).toBe(9);
    expect(coerceDateInputDate("2026-04-11T09:05:00.000Z") instanceof Date).toBe(
      true
    );
  });

  it("uses the web picker fallback component on web", () => {
    const webPicker = jest.fn(() => null);

    jest.doMock("react-native", () => createReactNativePlatformMock("web"));
    jest.doMock("../../app/style/theme", () => ({
      useColors: () => ({
        surface: "#ffffff",
        textPrimary: "#111111",
        textSecondary: "#333333",
        backgroundSubtle: "#eeeeee",
        primary: "#123456",
        white: "#ffffff",
      }),
    }));
    jest.doMock("react-native-ui-datepicker", () => ({
      __esModule: true,
      default: webPicker,
    }));

    jest.isolateModules(() => {
      const React = require("react");
      const TestRenderer = require("react-test-renderer");
      const { PlatformDatePicker } = require("../../platform/date-input/PlatformDatePicker");

      TestRenderer.create(
        React.createElement(PlatformDatePicker, {
          open: true,
          date: new Date(2026, 3, 11),
          onCancel: jest.fn(),
          onConfirm: jest.fn(),
        })
      );
    });

    expect(webPicker).toHaveBeenCalled();
  });

  it("uses the native date picker on native platforms", () => {
    const nativePicker = jest.fn(() => null);

    jest.doMock("react-native", () => createReactNativePlatformMock("ios"));
    jest.doMock("../../app/style/theme", () => ({
      useColors: () => ({
        surface: "#ffffff",
        textPrimary: "#111111",
        textSecondary: "#333333",
        backgroundSubtle: "#eeeeee",
        primary: "#123456",
        white: "#ffffff",
      }),
    }));
    jest.doMock("react-native-date-picker", () => ({
      __esModule: true,
      default: nativePicker,
    }));

    jest.isolateModules(() => {
      const React = require("react");
      const TestRenderer = require("react-test-renderer");
      const { PlatformTimePicker } = require("../../platform/date-input/PlatformTimePicker");

      TestRenderer.create(
        React.createElement(PlatformTimePicker, {
          open: true,
          date: new Date(2026, 3, 11, 9, 5),
          onCancel: jest.fn(),
          onConfirm: jest.fn(),
        })
      );
    });

    expect(nativePicker).toHaveBeenCalled();
  });
});