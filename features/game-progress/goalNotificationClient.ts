import { goalNotifications as browser } from "../../platform/notifications/goalNotifications";
import type { InstallationControl, SavedEnrollment } from "../../platform/notifications/goalNotificationBrowser";
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

export type NotificationScope = "assigned_and_common" | "all_room_matches";

export type GoalGameBinding = {
  status: "bound";
  revision: number;
  liveEnabled: boolean;
  testEnabled: boolean;
  scope: NotificationScope | null;
  scopeRevision: number | null;
};

export function bindGoalNotifications(
  installation: InstallationControl, identity: NotificationIdentity, expectedAssociationRevision: number | null,
) {
  const { matches, commonMatchId, commonMatchNotificationsEnabled, soloTracking } = useGameStore.getState();
  const common = matches.find(match => match.id === commonMatchId)?.catalogMatchId;
  const admitted = soloTracking?.grant?.state === "active" && common
    && soloTracking.grant.catalogMatchIds.includes(common) ? common : undefined;
  return invokeGoalNotification<GoalGameBinding | { status: "stale_binding"; revision: number | null; sameGame: boolean }>({
    operation: "bind", installation, proof: identity.proof, expectedAssociationRevision,
    notifyCommonMatch: commonMatchNotificationsEnabled,
    ...(identity.proof.kind === "solo" && admitted ? { commonCatalogMatchId: admitted } : {}),
  }, identity.bearer);
}

export async function stopGoalNotificationInstallation(saved: SavedEnrollment) {
  if (!saved.installation) return;
  browser.save({ ...saved, pendingStop: true });
  const unsubscribe = browser.unsubscribe().catch(() => {});
  await invokeGoalNotification({ operation: "disable", installation: saved.installation });
  await unsubscribe;
  const current = browser.read();
  if (current?.installation?.id === saved.installation.id &&
      current.installation.generation === saved.installation.generation) browser.save(null);
}

export async function stopGoalNotificationsForAccount(accountId: string) {
  const saved = browser.read();
  if (saved?.owner === "account:" + accountId) await stopGoalNotificationInstallation(saved);
}
