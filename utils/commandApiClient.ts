import { getFootballMatchService } from "./footballMatchService";
import type { FootballMatchService, MatchDiscoveryResult, SavedMatch } from "../types/footballMatch";
import { GameplayRpcError } from "../types/room";

interface CommandApiConfig {
  baseUrl: string;
}

interface CommandApiErrorResponse {
  error?: string;
  message?: string;
  timestamp?: string;
}

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



const getCommandApiConfig = (): CommandApiConfig => {
  const baseUrl = readCommandApiBaseUrl();

  if (!baseUrl) {
    throw new Error(
      "Missing command API configuration. Set EXPO_PUBLIC_COMMAND_API_URL to the running Java service base URL.",
    );
  }

  return { baseUrl };
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

interface StartGameCommandResponse {
  commandType: string;
  roomId: string;
  idempotencyKey: string;
  status: string;
  timestamp: string;
}

export interface StartGameApiClient {
  /**
   * Submits the start-game command. `idempotencyKey` MUST be generated once per
   * logical attempt (see `generateIdempotencyKey`) and reused verbatim if the
   * caller retries that same attempt (e.g. after a timeout) — that is what makes
   * a double-submit safe server-side (FR-013/SC-005).
   *
   * `relaxConstraints` MUST be set only after the host has been shown the
   * room's assignment-plan shortfall (from the polled snapshot) and explicitly
   * chosen to proceed. The room is untouched until this call — there is no
   * separate "preview" request (FR-014, research.md R2).
   */
  startGame(
    roomId: string,
    accessToken: string,
    idempotencyKey: string,
    relaxConstraints?: boolean,
  ): Promise<StartGameCommandResponse>;
}

/** RFC 4122 v4 UUID. No crypto dependency required — this is an idempotency
 * correlation id, not a security credential. */
export const generateIdempotencyKey = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const random = (Math.random() * 16) | 0;
    const value = c === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const START_GAME_TIMEOUT_MS = 30_000;

const createStartGameApiClient = (
  fetchFn: typeof fetch = fetch,
  config: CommandApiConfig = getCommandApiConfig(),
): StartGameApiClient => {
  return {
    async startGame(roomId, accessToken, idempotencyKey, relaxConstraints) {
      const normalizedBaseUrl = config.baseUrl.endsWith("/")
        ? config.baseUrl.slice(0, -1)
        : config.baseUrl;

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        START_GAME_TIMEOUT_MS,
      );
      let response: Response;

      try {
        response = await fetchFn(
          `${normalizedBaseUrl}/v1/rooms/${encodeURIComponent(roomId)}/commands/start-game`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              relaxConstraints: relaxConstraints ?? false,
            }),
            signal: controller.signal,
          },
        );
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("Start game request timed out.");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = await response.json();
      // Java already performs the bounded pending continuation. Never multiply
      // those retries or mistake its final pending envelope for a started game.
      if (payload?.ok === false && payload.code === "room_processing_pending") {
        throw new GameplayRpcError("room_processing_pending", "Accepted match updates are still being applied. Try again shortly.");
      }
      return payload as StartGameCommandResponse;
    },
  };
};

let cachedStartGameApiClient: StartGameApiClient | null = null;

export const getStartGameApiClient = () => {
  cachedStartGameApiClient ??= createStartGameApiClient();

  return cachedStartGameApiClient;
};
