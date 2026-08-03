/**
 * Kickoff-time formatting shared by every surface that renders a match card.
 *
 * Extracted from `components/setupGame/MatchItem.tsx` when the wizard and the
 * multiplayer room converged on `components/matchSelection/SelectableMatchList`
 * as their one match renderer. Sharing the formatter is load-bearing rather than
 * tidiness: `Match.startTime` carries a *different shape* depending on which path
 * produced it (see the note on `Match.startTime` in `store/store.ts`) —
 *
 *  * match discovery stores a local `"HH:MM"` display string
 *    (`hooks/useMatchProcessing.ts` ← `MatchData.time`),
 *  * a room's pool stores the provider's full ISO instant
 *    (`hooks/useRoomMatchPool.ts` ← `RoomMatchSummary.kickoffAt`),
 *  * a hand-typed fixture has none at all.
 *
 * A naive `new Date(startTime)` therefore renders the two surfaces differently,
 * which is exactly what "identical experience" has to rule out. The cascade of
 * fallbacks below is what makes the loose contract work; keep all four.
 */

/** Locale form used for every kickoff, e.g. `"08:30 PM"`. */
const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

/**
 * Renders a kickoff for display, or `null` when there is nothing to show.
 *
 * @param startTime A full ISO instant, a bare `HH:MM`, an ESPN-style
 *   `…T19:00Z`, or anything else. Absent/empty yields `null`.
 */
export const formatMatchTime = (startTime?: string): string | null => {
  if (!startTime) return null;

  try {
    // 1. A real instant (the room's kickoffAt, and most ISO strings).
    const date = new Date(startTime);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("en-US", TIME_FORMAT);
    }

    // 2. A bare clock time — already display-ready, and what match discovery
    //    hands the single-player wizard.
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(startTime)) {
      return startTime;
    }

    // 3. An ESPN-shaped string Date could not parse: pull the UTC time out and
    //    move it into the viewer's zone.
    const espnMatch = /T(\d{2}:\d{2})Z/.exec(startTime);
    if (espnMatch?.[1]) {
      const [hours, minutes] = espnMatch[1].split(":").map(Number);
      const localDate = new Date();
      localDate.setUTCHours(hours, minutes);
      return localDate.toLocaleTimeString("en-US", TIME_FORMAT);
    }

    // 4. Unrecognised: show it verbatim rather than hiding the fixture's time.
    return startTime;
  } catch (error) {
    console.log("Time formatting error:", error, "for time:", startTime);
    return startTime;
  }
};

export default formatMatchTime;
