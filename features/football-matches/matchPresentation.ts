import type { Match } from "../../store/gameStore";
import type { MatchLifecycle } from "../../types/footballMatch";
import type { MatchWithScore } from "../../types/matchScores";

export const MATCH_LIFECYCLE_LABELS: Record<MatchLifecycle, string> = {
  scheduled: "Scheduled", live: "Live", delayed: "Delayed", suspended: "Suspended",
  postponed: "Postponed", finished: "Finished", canceled: "Canceled",
  abandoned: "Abandoned", unknown: "Unknown",
};

export function formatMatchScore(score: number | null | undefined): string {
  return score == null ? "—" : String(score);
}

/** Current public facts may be unknown while accepted gameplay goals remain known. */
export function getMatchPresentation(match: Match, liveMatch?: MatchWithScore) {
  const snapshot = liveMatch ?? match.catalogSnapshot;
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  if (snapshot) {
    homeScore = snapshot.homeScore;
    awayScore = snapshot.awayScore;
  } else if (!match.catalogMatchId) {
    homeScore = match.homeGoals;
    awayScore = match.awayGoals;
  }
  const lifecycle = snapshot?.lifecycle;
  let displayStatus = lifecycle ? MATCH_LIFECYCLE_LABELS[lifecycle] : "?";
  if ((!lifecycle || lifecycle === "live") && liveMatch?.minutesPlayed) displayStatus = liveMatch.minutesPlayed;
  const showStatus = Boolean(lifecycle || ["FT", "HT"].includes(displayStatus) || liveMatch?.isLive);
  return { homeScore, awayScore, displayStatus, showStatus };
}
