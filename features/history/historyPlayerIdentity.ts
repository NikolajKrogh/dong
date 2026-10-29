import {
  GameSession,
  Player
} from "./historyTypes";

/**
 * Returns the canonical key used to group a participant in history.
 * Registered cloud participants are grouped by account. Guests and local
 * players are scoped to a session so a reused display name or participant id
 * cannot join unrelated people.
 */
export const getPlayerIdentityKey = (
  player: Player,
  sessionId: string,
  position: number,
): string => {
  const accountId = player.accountId?.trim();
  if (player.membershipType === "registered" && accountId) {
    return JSON.stringify(["account", accountId]);
  }

  const participantId = player.id?.trim();
  if (participantId) {
    return JSON.stringify(["session", sessionId, "participant", participantId]);
  }

  return JSON.stringify(["session", sessionId, "position", position]);
};

/** Resolves a player from one game using the same key as lifetime stats. */
export const findPlayerByIdentityKey = (
  game: Pick<GameSession, "id" | "players">,
  identityKey: string,
): Player | undefined =>
  game.players.find(
    (player, position) =>
      getPlayerIdentityKey(player, game.id, position) === identityKey,
  );
