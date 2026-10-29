import { getFootballMatchService } from "./footballMatchService";
import type { FootballMatchService, MatchDiscoveryResult, SavedMatch } from "../../types/footballMatch";

export interface MatchDiscoveryRequest {
  leagueCodes: string[];
  requestedAt?: string | null;
}

interface NormalizedMatchScore {
  home: number;
  away: number;
}

type NormalizedMatchStatus =
  | "scheduled"
  | "live"
  | "final"
  | "postponed"
  | "canceled";

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

function normalizedStatus(lifecycle: SavedMatch["lifecycle"]): NormalizedMatchStatus {
  if (lifecycle === "finished") return "final";
  if (lifecycle === "live") return "live";
  if (lifecycle === "postponed") return "postponed";
  if (lifecycle === "canceled" || lifecycle === "abandoned") return "canceled";
  return "scheduled";
}

let cachedMatchDiscoveryApiClient: MatchDiscoveryApiClient | null = null;

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
        status: normalizedStatus(match.lifecycle),
        ...(match.homeScore !== null && match.awayScore !== null ? { score: { home: match.homeScore, away: match.awayScore } } : {}),
        ...(match.venue?.name ? { venue: match.venue.name } : {}),
      })) };
    },
  };
};

export const getMatchDiscoveryApiClient = () => {
  cachedMatchDiscoveryApiClient ??= createMatchDiscoveryApiClient();

  return cachedMatchDiscoveryApiClient;
};
