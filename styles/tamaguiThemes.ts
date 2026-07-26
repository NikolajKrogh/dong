import { colors as base } from "./palette";
import { darkColors } from "./theme";

/**
 * Tamagui theme definitions mapped from the DONG design language.
 * These mirror the existing palette/theme values so migrated surfaces
 * stay visually consistent.
 */

export const lightTheme = {
  background: base.background,
  backgroundLight: base.backgroundLight,
  backgroundSubtle: base.backgroundSubtle,
  surface: base.surface,
  darkSurface: base.darkSurface,
  toastBackground: base.toastBackground,
  backgroundModalOverlay: base.backgroundModalOverlay,

  color: base.textPrimary,
  colorSecondary: base.textSecondary,
  colorMuted: base.textMuted,
  colorDisabled: base.textDisabled,
  colorLight: base.textLight,
  colorPlaceholder: base.textPlaceholder,
  colorLink: base.textLink,

  borderColor: base.border,
  borderColorLight: base.borderLight,
  borderColorLighter: base.borderLighter,
  borderColorSubtle: base.borderSubtle,

  primary: base.primary,
  primaryLight: base.primaryLight,
  primaryLighter: base.primaryLighter,
  primaryDark: base.primaryDark,
  primaryFocus: base.primaryFocus,
  primaryTransparentLight: base.primaryTransparentLight,

  success: base.success,
  successLight: base.successLight,
  danger: base.danger,
  dangerLight: base.dangerLight,
  warning: base.warning,
  warningLight: base.warningLight,
  info: base.info,
  infoLight: base.infoLight,
} as const;

export const darkTheme = {
  background: darkColors.background,
  backgroundLight: darkColors.backgroundLight,
  backgroundSubtle: darkColors.backgroundSubtle,
  surface: darkColors.surface,
  darkSurface: darkColors.darkSurface,
  toastBackground: darkColors.toastBackground,
  backgroundModalOverlay: base.backgroundModalOverlay,

  color: darkColors.textPrimary,
  colorSecondary: darkColors.textSecondary,
  colorMuted: darkColors.textMuted,
  colorDisabled: darkColors.textDisabled,
  colorLight: base.textLight,
  colorPlaceholder: base.textPlaceholder,
  colorLink: base.textLink,

  borderColor: darkColors.border,
  borderColorLight: darkColors.borderLight,
  borderColorLighter: darkColors.borderLighter,
  borderColorSubtle: darkColors.borderSubtle,

  primary: base.primary,
  primaryLight: darkColors.primaryLight,
  primaryLighter: darkColors.primaryLighter,
  primaryDark: darkColors.primaryDark,
  primaryFocus: base.primaryFocus,
  primaryTransparentLight: darkColors.primaryTransparentLight,

  success: base.success,
  successLight: darkColors.successLight,
  danger: base.danger,
  dangerLight: darkColors.dangerLight,
  warning: base.warning,
  warningLight: darkColors.warningLight,
  info: base.info,
  infoLight: darkColors.infoLight,
} as const;
