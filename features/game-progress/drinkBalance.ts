import type { Match } from "../../store/gameStore";

/** Score requirements and user-entered consumption have independent owners. */
export function calculateDrinkBalance(
  matches: Pick<Match, "id" | "homeGoals" | "awayGoals">[],
  commonMatchId: string | null,
  assignedMatchIds: string[],
  consumed: number,
) {
  const assigned = new Set(assignedMatchIds);
  const required = matches.reduce((total, match) => {
    const weight = match.id === commonMatchId ? 1 : assigned.has(match.id) ? 0.5 : 0;
    return total + weight * ((match.homeGoals ?? 0) + (match.awayGoals ?? 0));
  }, 0);
  const remaining = Math.max(0, required - consumed);
  const ahead = Math.max(0, consumed - required);
  let label = "Completed";
  if (ahead > 0) label = `${ahead.toFixed(1)} ahead`;
  else if (remaining > 0) label = `${remaining.toFixed(1)} more`;
  return {
    required, consumed, remaining, ahead,
    percentComplete: required > 0 ? Math.min(100, consumed / required * 100) : 100,
    label,
  };
}
