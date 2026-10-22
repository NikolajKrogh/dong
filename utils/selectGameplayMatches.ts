export function selectGameplayMatches<T extends { id: string }>(
  matches: T[],
  commonMatchId: string | null,
  playerAssignments: Record<string, string[]>,
): T[] {
  const assignedMatchIds = new Set(Object.values(playerAssignments).flat());
  return matches.filter(
    (match) => assignedMatchIds.has(match.id) || match.id === commonMatchId,
  );
}
