import { createTokens } from "tamagui";

export const tokens = createTokens({
  color: {
    // Brand
    primary: "#0275d8",
    primaryLight: "#e3f2fd",
    primaryLighter: "#f0f8ff",
    primaryDark: "#0056b3",
    primaryFocus: "#1976d2",
    primaryTransparentLight: "rgba(2, 117, 216, 0.08)",

    // Grays
    secondary: "#6c757d",
    lightGray: "#f8f9fa",
    mediumGray: "#e9ecef",
    darkGray: "#adb5bd",
    neutralGray: "#ccc",

    // Status
    success: "#28a745",
    successLight: "#e8f5e9",
    danger: "#dc3545",
    dangerLight: "#ffebee",
    warning: "#ffc107",
    warningLight: "#fff8e1",
    info: "#17a2b8",
    infoLight: "#e0f7fa",

    // Surfaces
    background: "#f5f5f5",
    backgroundLight: "#f8f9fa",
    backgroundSubtle: "#f0f0f0",
    surface: "#fff",
    darkSurface: "#333",
    toastBackground: "#222222",
    backgroundModalOverlay: "rgba(0, 0, 0, 0.5)",

    // Text
    textPrimary: "#212529",
    textSecondary: "#333",
    textMuted: "#6c757d",
    textDisabled: "#adb5bd",
    textLight: "#fff",
    textPlaceholder: "#999",
    textLink: "#0275d8",

    // Borders
    border: "#ddd",
    borderLight: "#e0e0e0",
    borderLighter: "#eee",
    borderSubtle: "#e9ecef",

    // Component specific
    awayTeam: "#fd7e14",
    liveIndicator: "#e74c3c",
    gold: "#ffc107",
    silver: "#adb5bd",
    bronze: "#cd7f32",

    white: "#fff",
    black: "#000",
  },

  space: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    true: 16,
  },

  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    true: 16,
  },

  radius: {
    0: 0,
    1: 4,
    2: 6,
    3: 8,
    4: 10,
    5: 12,
    6: 16,
    7: 18,
    8: 20,
    9: 30,
    true: 8,
  },

  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
});
