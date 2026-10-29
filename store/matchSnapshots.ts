import type { SavedMatch } from "../types/footballMatch";
import type { Match } from "./gameStore";

function captureSavedMatch(match: Match, savedById: Map<string, SavedMatch>): Match {
  const snapshot = match.catalogMatchId ? savedById.get(match.catalogMatchId) : undefined;
  if (!snapshot) return match;

  const previous = match.catalogSnapshot;
  if (previous && BigInt(snapshot.observationVersion) < BigInt(previous.observationVersion)) return match;

  const observationMovedBackwards = previous
    && snapshot.observationVersion === previous.observationVersion
    && snapshot.freshness.observedAt
    && previous.freshness.observedAt
    && Date.parse(snapshot.freshness.observedAt) < Date.parse(previous.freshness.observedAt);
  if (observationMovedBackwards) return match;

  const newDetails = snapshot.historyDetails;
  const previousDetails = previous?.historyDetails;
  const hasOlderUsefulDetails = previousDetails
    && (!newDetails || ["unavailable", "pending", "deferred"].includes(newDetails.availability));
  const captured = {
    ...snapshot,
    ...(hasOlderUsefulDetails ? { historyDetails: previousDetails } : {}),
  };
  if (JSON.stringify(captured) === JSON.stringify(previous)) return match;

  // Keep historical snapshots independent from later API response objects.
  const copy = JSON.parse(JSON.stringify(captured)) as SavedMatch;
  return { ...match, catalogSnapshot: copy };
}

export function captureSavedMatchList(matches: Match[], savedById: Map<string, SavedMatch>): Match[] {
  const captured = matches.map(match => captureSavedMatch(match, savedById));
  return captured.every((match, index) => match === matches[index]) ? matches : captured;
}
