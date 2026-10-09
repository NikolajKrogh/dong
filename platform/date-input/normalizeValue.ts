const padNumber = (value: number): string => String(value).padStart(2, "0");

export const formatDateIsoValue = (date: Date): string => {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
    date.getDate(),
  )}`;
};

export const formatTimeIsoValue = (date: Date): string => {
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
};

export const parseDateIsoValue = (
  value: string | null | undefined,
  fallback = new Date(),
): Date => {
  if (!value) {
    return fallback;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return fallback;
  }

  return new Date(year, month - 1, day);
};

export const parseTimeIsoValue = (
  value: string | null | undefined,
  fallback = new Date(),
): Date => {
  if (!value) {
    return fallback;
  }

  const [hours, minutes] = value.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return fallback;
  }

  const nextValue = new Date(fallback);
  nextValue.setHours(hours, minutes, 0, 0);
  return nextValue;
};
