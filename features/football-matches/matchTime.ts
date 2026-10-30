function formatClockTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Preserve the viewer's timezone while making clock output independent of locale settings. */
export function formatMatchTime(startTime?: string): string | null {
  if (!startTime?.trim()) return null;

  const clockMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(startTime.trim());
  if (clockMatch) {
    let hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]);
    const seconds = Number(clockMatch[3] ?? 0);
    const period = clockMatch[4]?.toUpperCase();
    if (minutes > 59 || seconds > 59 || (period ? hours < 1 || hours > 12 : hours > 23)) {
      return null;
    }
    if (period) hours = hours % 12 + (period === "PM" ? 12 : 0);
    return formatClockTime(hours, minutes);
  }

  if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(startTime.trim())) {
    if (!startTime.includes("T")) return null;
    const kickoffDate = new Date(startTime);
    return Number.isNaN(kickoffDate.getTime()) ? null : formatClockTime(kickoffDate.getHours(), kickoffDate.getMinutes());
  }

  const utcClockMatch = /T(\d{2}):(\d{2})Z/.exec(startTime);
  if (utcClockMatch) {
    const hours = Number(utcClockMatch[1]);
    const minutes = Number(utcClockMatch[2]);
    if (hours > 23 || minutes > 59) return null;
    const localKickoff = new Date();
    localKickoff.setUTCHours(hours, minutes, 0, 0);
    return formatClockTime(localKickoff.getHours(), localKickoff.getMinutes());
  }

  return startTime;
}
