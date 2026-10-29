import { GameplayRpcError } from "../../types/room";

interface GameApiConfig {
  baseUrl: string;
}

interface GameApiErrorResponse {
  error?: string;
  message?: string;
  timestamp?: string;
}

const readTrimmedEnvValue = (value: string | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
};

const readGameApiBaseUrl = () => {
  return readTrimmedEnvValue(process.env.EXPO_PUBLIC_GAME_API_URL);
};



const getGameApiConfig = (): GameApiConfig => {
  const baseUrl = readGameApiBaseUrl();

  if (!baseUrl) {
    throw new Error(
      "Missing game API configuration. Set EXPO_PUBLIC_GAME_API_URL to the running Java service base URL.",
    );
  }

  return { baseUrl };
};

const readErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as GameApiErrorResponse;

    if (typeof payload.message === "string") {
      const trimmedMessage = payload.message.trim();

      if (trimmedMessage.length > 0) {
        return trimmedMessage;
      }
    }
  } catch {
    // Ignore non-JSON or empty error bodies and fall back to the status text.
  }

  return `Game API request failed with status ${response.status}.`;
};

interface StartGameResponse {
  actionType: string;
  roomId: string;
  idempotencyKey: string;
  status: string;
  timestamp: string;
}

export interface StartGameApiClient {
  /**
   * Requests that the host starts the room. `idempotencyKey` MUST be generated once per
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
  ): Promise<StartGameResponse>;
}

const START_GAME_TIMEOUT_MS = 30_000;

const createStartGameApiClient = (
  fetchFn: typeof fetch = fetch,
  config: GameApiConfig = getGameApiConfig(),
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
          `${normalizedBaseUrl}/v1/rooms/${encodeURIComponent(roomId)}/actions/start-game`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              payload: { relaxConstraints: relaxConstraints ?? false },
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
      return payload as StartGameResponse;
    },
  };
};

let cachedStartGameApiClient: StartGameApiClient | null = null;

export const getStartGameApiClient = () => {
  cachedStartGameApiClient ??= createStartGameApiClient();

  return cachedStartGameApiClient;
};
