import type { FootballMatchService, MatchDiscoveryResult, MatchLifecycle } from "../../types/footballMatch";
import { getFootballMatchService } from "./footballMatchService";

interface MatchDiscoveryRequest {
  leagueCodes: string[];
  requestedAt?: string | null;
}

interface NormalizedMatchScore {
  home: number | null;
  away: number | null;
}

type NormalizedMatchStatus = MatchLifecycle;

export interface NormalizedMatch {
  id: string;
  catalogMatchId?: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startDateTime: string;
  status: NormalizedMatchStatus;
  score?: NormalizedMatchScore;
  venue?: string;
}

interface NormalizedMatchDiscoveryResult extends Omit<MatchDiscoveryResult, "matches"> {
  matches: NormalizedMatch[];
}

export interface MatchDiscoveryApiClient {
  discoverMatches(request: MatchDiscoveryRequest): Promise<NormalizedMatchDiscoveryResult>;
}


export const createMatchDiscoveryApiClient = (
  footballMatchService: Pick<FootballMatchService, "discoverMatches"> = getFootballMatchService(),
): MatchDiscoveryApiClient => {
  return {
    async discoverMatches(request) {
      const codes = [...new Set(request.leagueCodes.map(code => code.trim()).filter(Boolean))];
      if (!codes.length) return { matches: [], groups: [], availability: "available", retryAfterSeconds: null };
      // Preserve the selected calendar date, including offset-aware legacy callers.
      const date = request.requestedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const result = await footballMatchService.discoverMatches({ leagueCodes: codes, date });
      return { ...result, matches: result.matches.map(match => ({
        id: match.identity.sourceEventId,
        catalogMatchId: match.catalogMatchId,
        league: match.identity.leagueCode,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        startDateTime: match.kickoffAt ?? "",
        status: match.lifecycle,
        ...(match.homeScore !== null || match.awayScore !== null ? { score: { home: match.homeScore, away: match.awayScore } } : {}),
        ...(match.venue?.name ? { venue: match.venue.name } : {}),
      })) };
    },
  };
};
