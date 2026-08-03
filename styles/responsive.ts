export const WIDE_LAYOUT_MIN_WIDTH = 1024;

export const isWideLayout = (width: number) => {
  return width >= WIDE_LAYOUT_MIN_WIDTH;
};
