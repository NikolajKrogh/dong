import { getHistoryTimestamp } from "./historyDate";

/**
 * Format date for list item.
 * @description Produces a short month/day/year localized date string for history lists.
 * @param {string} dateString ISO date string.
 * @returns {string} Localized short date string.
 */
export const formatHistoryDate = (dateString: string): string => {
  const timestamp = getHistoryTimestamp(dateString);
  if (timestamp === null) return "Completion date unknown";

  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format date for modal title.
 * @description Full verbose date with weekday and time for detailed modal display.
 * @param {string} dateString ISO date string.
 * @returns {string} Localized verbose date/time string.
 */
export const formatModalDate = (dateString: string): string => {
  const timestamp = getHistoryTimestamp(dateString);
  if (timestamp === null) return "Completion date unknown";

  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
