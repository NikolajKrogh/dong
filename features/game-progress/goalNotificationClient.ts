import { getSupabaseClient, getSupabasePublicConfig } from "../../lib/supabase";
import { useGameStore } from "../../store/gameStore";

type GameProof =
  | { kind: "registered"; sessionId: string }
  | { kind: "guest"; sessionId: string; guestToken: string }
  | { kind: "solo"; grantToken: string };

export interface NotificationIdentity {
  owner: string;
  proof: GameProof;
  bearer?: string;
}

export async function readNotificationIdentity(): Promise<NotificationIdentity | null> {
  const { activeGameContext: game, soloTracking } = useGameStore.getState();
  if (game.mode === "solo") {
    const grant = soloTracking?.grant;
    if (grant?.state !== "active" || Date.parse(grant.expiresAt) <= Date.now()) return null;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(grant.grantToken));
    const owner = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return {
      owner: "solo:" + owner,
      proof: { kind: "solo", grantToken: grant.grantToken },
    };
  }
  if (!game.sessionId) return null;
  if (game.accessKind === "guest") {
    const { readGuestRoomSessionGrant } = await import("../rooms/guestRoomService");
    const grant = await readGuestRoomSessionGrant();
    if (!grant || grant.sessionId !== game.sessionId || grant.participantId !== game.participantId) return null;
    return {
      owner: "guest:" + grant.participantId,
      proof: { kind: "guest", sessionId: game.sessionId, guestToken: grant.guestToken },
    };
  }
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session) return null;
  return {
    owner: "account:" + session.user.id,
    proof: { kind: "registered", sessionId: game.sessionId },
    bearer: session.access_token,
  };
}

export async function invokeGoalNotification<T>(
  body: object, bearer?: string,
): Promise<T> {
  const { url, apiKey } = getSupabasePublicConfig();
  const response = await fetch(new URL("/functions/v1/goal-notifications", url), {
    method: "POST",
    headers: {
      apikey: apiKey,
      "content-type": "application/json",
      ...(bearer ? { authorization: "Bearer " + bearer } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.code === "rate_limited" ? "rate_limited" : "unavailable");
  }
  return payload as T;
}
