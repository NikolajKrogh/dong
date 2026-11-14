import type { SavedMatchTeam } from "../../types/footballMatch";

export function teamLogoDetails(snapshot?: SavedMatchTeam, details?: SavedMatchTeam): SavedMatchTeam | undefined {
  if (!snapshot) return details;
  if (snapshot.logoUrl || !details?.logoUrl) return snapshot;
  if (snapshot.sourceTeamId && details.sourceTeamId && snapshot.sourceTeamId !== details.sourceTeamId) return snapshot;
  return { ...snapshot, logoUrl: details.logoUrl };
}
