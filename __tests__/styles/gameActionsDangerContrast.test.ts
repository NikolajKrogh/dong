import { darkTheme, lightTheme } from "../../styles/tamaguiThemes";

const luminance = (hex: string) => {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

it.each([lightTheme, darkTheme])(
  "keeps the game-actions danger label readable against its row",
  (theme) => {
    expect(contrastRatio(theme.dangerForeground, theme.dangerLight)).toBeGreaterThanOrEqual(4.5);
  },
);
