export interface CommandApiConfig {
  baseUrl: string;
}

export interface CommandApiErrorResponse {
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface MatchDiscoveryRequest {
  leagueCodes: string[];
  requestedAt?: string | null;
}

export interface NormalizedMatchScore {
  home: number;
  away: number;
}

export type NormalizedMatchStatus =
  | "scheduled"
  | "live"
  | "final"
  | "postponed"
  | "canceled";

export interface NormalizedMatch {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startDateTime: string;
  status: NormalizedMatchStatus;
  score?: NormalizedMatchScore;
  venue?: string;
}

export interface MatchDiscoveryApiClient {
  discoverMatches(request: MatchDiscoveryRequest): Promise<NormalizedMatch[]>;
}

let cachedMatchDiscoveryApiClient: MatchDiscoveryApiClient | null = null;

const readTrimmedEnvValue = (value: string | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
};

const readCommandApiBaseUrl = () => {
  return readTrimmedEnvValue(process.env.EXPO_PUBLIC_COMMAND_API_URL);
};

export const hasCommandApiConfig = () => {
  return Boolean(readCommandApiBaseUrl());
};

export const getCommandApiConfig = (): CommandApiConfig => {
  const baseUrl = readCommandApiBaseUrl();

  if (!baseUrl) {
    throw new Error(
      "Missing command API configuration. Set EXPO_PUBLIC_COMMAND_API_URL to the running Java service base URL.",
    );
  }

  return { baseUrl };
};

export const buildMatchDiscoveryUrl = (
  config: CommandApiConfig,
  request: MatchDiscoveryRequest,
) => {
  const normalizedBaseUrl = config.baseUrl.endsWith("/")
    ? config.baseUrl.slice(0, -1)
    : config.baseUrl;

  const queryParts = request.leagueCodes.map(
    (leagueCode) => `leagueCode=${encodeURIComponent(leagueCode)}`,
  );

  if (request.requestedAt) {
    queryParts.push(`requestedAt=${encodeURIComponent(request.requestedAt)}`);
  }

  const queryString = queryParts.join("&");

  return queryString.length > 0
    ? `${normalizedBaseUrl}/v1/matches?${queryString}`
    : `${normalizedBaseUrl}/v1/matches`;
};

const readErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as CommandApiErrorResponse;

    if (typeof payload.message === "string") {
      const trimmedMessage = payload.message.trim();

      if (trimmedMessage.length > 0) {
        return trimmedMessage;
      }
    }
  } catch {
    // Ignore non-JSON or empty error bodies and fall back to the status text.
  }

  return `Command API request failed with status ${response.status}.`;
};

const MATCH_DISCOVERY_TIMEOUT_MS = 10_000;

export const createMatchDiscoveryApiClient = (
  fetchFn: typeof fetch = fetch,
  config: CommandApiConfig = getCommandApiConfig(),
): MatchDiscoveryApiClient => {
  return {
    async discoverMatches(request) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        MATCH_DISCOVERY_TIMEOUT_MS,
      );
      let response: Response;

      try {
        response = await fetchFn(buildMatchDiscoveryUrl(config, request), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });
      } catch (error) {
        // A stalled connection aborts via the timeout above; surface it as a
        // clear, client-safe message rather than the raw AbortError.
        if (controller.signal.aborted) {
          throw new Error("Match discovery request timed out.");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      return (await response.json()) as NormalizedMatch[];
    },
  };
};

export const getMatchDiscoveryApiClient = () => {
  cachedMatchDiscoveryApiClient ??= createMatchDiscoveryApiClient();

  return cachedMatchDiscoveryApiClient;
};