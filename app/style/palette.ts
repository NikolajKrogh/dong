/**
 * @file Centralized color palette for the entire application.
 * This file consolidates colors from all style files to create a single source of truth.
 */
export const colors = {
  // --- Primary ---
  primary: "#0275d8",
  primaryLight: "#e3f2fd",
  primaryLighter: "#f0f8ff",
  primaryDark: "#0056b3",
  primaryFocus: "#1976d2",
  primaryTransparentLight: "rgba(2, 117, 216, 0.08)",

  // --- Secondary & Grays ---
  secondary: "#6c757d",
  lightGray: "#f8f9fa", // Alias for backgroundLight
  mediumGray: "#e9ecef", // Alias for borderSubtle
  darkGray: "#adb5bd", // Alias for textDisabled
  neutralGray: "#ccc",

  // --- Status: Success ---
  success: "#28a745",
  successLight: "#e8f5e9",
  successText: "#fff",
  successDarkText: "#155724",
  successOwedText: "#388e3c",

  // --- Status: Danger/Error ---
  danger: "#dc3545",
  dangerLight: "#ffebee",
  dangerText: "#fff",
  dangerOwedText: "#d32f2f",
  error: "#dc3545", // Alias for danger

  // --- Status: Warning ---
  warning: "#ffc107",
  warningLight: "#fff8e1",
  warningText: "#212529",

  // --- Status: Info ---
  info: "#17a2b8",
  infoLight: "#e0f7fa",

  // --- Backgrounds ---
  background: "#f5f5f5",
  backgroundLight: "#f8f9fa",
  backgroundSubtle: "#f0f0f0",
  surface: "#fff",
  darkSurface: "#333",
  toastBackground: "#222222",
  backgroundModalOverlay: "rgba(0, 0, 0, 0.5)",

  // --- Text ---
  textPrimary: "#212529",
  textSecondary: "#333",
  textMuted: "#6c757d",
  textDisabled: "#adb5bd",
  textLight: "#fff",
  textPlaceholder: "#999",
  textLink: "#0275d8",

  // --- Borders ---
  border: "#ddd",
  borderLight: "#e0e0e0",
  borderLighter: "#eee",
  borderSubtle: "#e9ecef",

  // --- Component Specific ---
  awayTeam: "#fd7e14",
  liveIndicator: "#e74c3c",
  owedPositiveBorder: "#e57373",
  owedZeroBorder: "#81c784",
  playerItemOddBackground: "#fff8f0",
  countBadgeBorder: "#81d4fa",
  compactMatchItemSelectedBorder: "#b3d7ff",
  processingIndicatorBorder: "#b8daff",

  // --- Switch (from userPreferences) ---
  switchTrackOff: "#d1d1d1",
  switchTrackOn: "#a3c9f0",
  thumbOn: "#0275d8",
  thumbOff: "#f4f3f4",

  // --- History Specific (Medals) ---
  gold: "#ffc107",
  silver: "#adb5bd",
  bronze: "#cd7f32",

  // --- General ---
  white: "#fff",
  black: "#000",
};
