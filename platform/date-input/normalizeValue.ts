import type { DateInputValue } from "../types";

const padNumber = (value: number): string => String(value).padStart(2, "0");

export const coerceDateInputDate = (
  value: unknown,
  fallback = new Date(),
): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const nextDate = new Date(value);
    return Number.isNaN(nextDate.getTime()) ? fallback : nextDate;
  }

  if (typeof value === "string") {
    const nextDate = new Date(value);
    return Number.isNaN(nextDate.getTime()) ? fallback : nextDate;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const nextDate = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(nextDate.getTime()) ? fallback : nextDate;
  }

  return fallback;
};

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

export const createDateInputValue = (
  date: Date,
  options: { isEmptyAllowed?: boolean; locale?: string } = {},
): DateInputValue => ({
  mode: "date",
  displayValue: date.toLocaleDateString(options.locale ?? "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  isoValue: formatDateIsoValue(date),
  isEmptyAllowed: options.isEmptyAllowed ?? false,
  validationRule: "yyyy-mm-dd",
});

export const createTimeInputValue = (
  date: Date,
  options: { isEmptyAllowed?: boolean; locale?: string } = {},
): DateInputValue => ({
  mode: "time",
  displayValue: date.toLocaleTimeString(options.locale ?? "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  isoValue: formatTimeIsoValue(date),
  isEmptyAllowed: options.isEmptyAllowed ?? false,
  validationRule: "HH:MM",
});

export const normalizeDateInputValue = (
  value: string | null | undefined,
  fallback = new Date(),
): DateInputValue => {
  return createDateInputValue(parseDateIsoValue(value, fallback));
};

export const normalizeTimeInputValue = (
  value: string | null | undefined,
  fallback = new Date(),
): DateInputValue => {
  return createTimeInputValue(parseTimeIsoValue(value, fallback));
};
