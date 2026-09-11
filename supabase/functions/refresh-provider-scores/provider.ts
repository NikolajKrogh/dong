export const DEFAULT_ESPN_BASE_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer";

export const DEFAULT_SUPPORTED_LEAGUES = [
  "eng.1", "eng.2", "eng.3", "eng.4", "eng.league_cup", "eng.fa",
  "esp.1", "esp.2", "esp.copa_del_rey", "ger.1", "ger.2",
  "ger.dfb_pokal", "ita.1", "ita.2", "ita.coppa_italia", "fra.1",
  "fra.2", "fra.coupe_de_france", "por.1", "ned.1", "ned.cup",
  "sco.1", "sco.3", "sco.4", "bel.1", "rus.1", "tur.1", "gre.1",
  "sui.1", "aut.1", "den.1", "nor.1", "swe.1", "irl.1",
  "uefa.champions", "uefa.europa", "uefa.europa.conf", "uefa.wchampions",
  "usa.1", "usa.nwsl", "usa.usl.1", "usa.usl.l1", "usa.open",
  "usa.nwsl.cup", "mex.1", "mex.2", "mex.copa_mx",
  "concacaf.champions", "concacaf.gold", "crc.1", "hon.1", "gua.1",
  "slv.1", "bra.1", "bra.2", "bra.copa_do_brazil", "bra.camp.gaucho",
  "bra.camp.paulista", "bra.camp.carioca", "bra.camp.mineiro", "arg.1",
  "arg.2", "arg.3", "arg.4", "arg.5", "arg.copa", "arg.copa_lpf",
  "col.1", "col.2", "col.copa", "chi.1", "chi.copa_chi", "ecu.1",
  "uru.1", "ven.1", "par.1", "per.1", "bol.1",
  "conmebol.libertadores", "conmebol.sudamericana", "conmebol.america",
  "fifa.world", "fifa.cwc", "fifa.worldq.uefa", "fifa.worldq.concacaf",
  "fifa.worldq.conmebol", "fifa.worldq.afc", "fifa.worldq.caf",
  "fifa.worldq.ofc", "fifa.wwc", "fifa.world.u20", "fifa.world.u17",
  "fifa.olympics", "fifa.w.olympics", "fifa.friendly", "fifa.friendly.w",
  "uefa.euro", "uefa.nations", "uefa.euro_u21", "uefa.euro.u19",
  "uefa.euroq", "uefa.weuro", "concacaf.womens.championship",
  "club.friendly", "afc.champions", "afc.cup", "afc.asian.cup",
  "afc.cupq", "ksa.1", "aus.1", "aus.w.1", "jpn.1", "chn.1",
  "ind.1", "idn.1", "mys.1", "sgp.1", "tha.1", "aff.championship",
  "caf.champions", "caf.nations",
] as const;

export interface ClaimedProviderMatch {
  matchId: string;
  provider: string;
  sourceMatchId: string;
  sourceLeagueCode: string | null;
  kickoffAt: string;
}

export interface ProviderObservation {
  matchId: string;
  sourceMatchId: string;
  sourceLeagueCode: string;
  homeScore: number;
  awayScore: number;
}

export interface ProviderWarning {
  leagueCode?: string;
  code:
    | "provider_unavailable"
    | "invalid_provider_response"
    | "match_not_found";
}

export interface FetchTarget {
  leagueCode: string;
  date: string;
}

interface EspnCompetitor {
  homeAway?: unknown;
  score?: { value?: unknown } | unknown;
}

interface EspnEvent {
  id?: unknown;
  competitions?: { competitors?: EspnCompetitor[] }[];
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

export interface ScoreboardResult {
  target: FetchTarget;
  scoreboard?: unknown;
  error?: "provider_unavailable" | "invalid_provider_response";
  failureReason?: "timeout" | "network_error" | "http_error" | "invalid_json";
}

export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuidV4 = (value: unknown): value is string =>
  typeof value === "string" && UUID_V4_PATTERN.test(value);

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export const parseSupportedLeagues = (configured?: string | null): string[] => {
  const candidates = configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : [...DEFAULT_SUPPORTED_LEAGUES];
  return [...new Set(candidates)].filter((value) =>
    /^[a-z0-9._-]+$/i.test(value)
  );
};

const resolveDate = (kickoffAt: string): string | null => {
  const instant = new Date(kickoffAt);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString().slice(0, 10).replaceAll("-", "");
};

export const buildFetchTargets = (
  matches: ClaimedProviderMatch[],
  supportedLeagues: readonly string[],
): FetchTarget[] => {
  const allowlist = new Set(supportedLeagues);
  const targets = new Map<string, FetchTarget>();
  for (const match of matches) {
    const date = resolveDate(match.kickoffAt);
    if (!date) continue;
    const leagues = match.sourceLeagueCode
      ? [match.sourceLeagueCode]
      : supportedLeagues;
    for (const leagueCode of leagues) {
      if (!allowlist.has(leagueCode)) continue;
      targets.set(`${leagueCode}:${date}`, { leagueCode, date });
    }
  }
  return [...targets.values()];
};

const parseScore = (value: unknown): number | null => {
  const raw = typeof value === "object" && value !== null && "value" in value
    ? (value as { value?: unknown }).value
    : value;
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const scoreFor = (event: EspnEvent, side: "home" | "away"): number | null => {
  for (const competition of event.competitions ?? []) {
    const competitor = (competition.competitors ?? []).find(
      (candidate) => candidate.homeAway === side,
    );
    const score = parseScore(competitor?.score);
    if (score !== null) return score;
  }
  return null;
};

export const normalizeProviderResults = (
  matches: ClaimedProviderMatch[],
  results: ScoreboardResult[],
): { observations: ProviderObservation[]; warnings: ProviderWarning[] } => {
  const warnings: ProviderWarning[] = results
    .filter((result) => result.error)
    .map((result) => ({
      leagueCode: result.target.leagueCode,
      code: result.error!,
    }));
  const candidates = new Map<string, ProviderObservation[]>();

  for (const result of results) {
    if (result.error) continue;
    const scoreboard = result.scoreboard as EspnScoreboard;
    if (!scoreboard || !Array.isArray(scoreboard.events)) {
      warnings.push({
        leagueCode: result.target.leagueCode,
        code: "invalid_provider_response",
      });
      continue;
    }
    for (const event of scoreboard.events) {
      if (typeof event?.id !== "string") continue;
      const homeScore = scoreFor(event, "home");
      const awayScore = scoreFor(event, "away");
      if (homeScore === null || awayScore === null) continue;
      for (const match of matches) {
        if (
          match.provider.toLowerCase() !== "espn" ||
          match.sourceMatchId !== event.id ||
          (match.sourceLeagueCode !== null &&
            match.sourceLeagueCode !== result.target.leagueCode)
        ) {
          continue;
        }
        const list = candidates.get(match.matchId) ?? [];
        list.push({
          matchId: match.matchId,
          sourceMatchId: match.sourceMatchId,
          sourceLeagueCode: result.target.leagueCode,
          homeScore,
          awayScore,
        });
        candidates.set(match.matchId, list);
      }
    }
  }

  const observations: ProviderObservation[] = [];
  for (const match of matches) {
    const unique = new Map(
      (candidates.get(match.matchId) ?? []).map((candidate) => [
        `${candidate.sourceLeagueCode}:${candidate.homeScore}:${candidate.awayScore}`,
        candidate,
      ]),
    );
    if (unique.size === 1) {
      observations.push([...unique.values()][0]);
    } else {
      warnings.push({
        leagueCode: match.sourceLeagueCode ?? undefined,
        code: "match_not_found",
      });
    }
  }
  return { observations, warnings };
};

export const fetchScoreboards = async (
  targets: FetchTarget[],
  options: {
    baseUrl: string;
    concurrency?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<ScoreboardResult[]> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 4));
  const timeoutMs = options.timeoutMs ?? 5_000;
  const results: ScoreboardResult[] = new Array(targets.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < targets.length) {
      const index = nextIndex++;
      const target = targets[index];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const baseUrl = options.baseUrl.replace(/\/$/, "");
        const response = await fetchImpl(
          `${baseUrl}/${encodeURIComponent(target.leagueCode)}/scoreboard?dates=${target.date}`,
          { headers: { Accept: "application/json" }, signal: controller.signal },
        );
        if (!response.ok) {
          results[index] = {
            target,
            error: "provider_unavailable",
            failureReason: "http_error",
          };
          continue;
        }
        try {
          results[index] = { target, scoreboard: await response.json() };
        } catch {
          results[index] = {
            target,
            error: "invalid_provider_response",
            failureReason: "invalid_json",
          };
        }
      } catch {
        results[index] = {
          target,
          error: "provider_unavailable",
          failureReason: controller.signal.aborted ? "timeout" : "network_error",
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()),
  );
  return results;
};
