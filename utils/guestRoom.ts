import AsyncStorage from "@react-native-async-storage/async-storage";
import { clear as clearCredential, generateToken, read as readCredential, write as writeCredential } from "../platform/guestCredential";
import type { GuestCredentialRecord } from "../platform/guestCredential/types";

import type {
  GuestRoomErrorCode,
  GuestRoomJoinResponse,
  GuestRoomSessionGrant,
} from "../types/guestRoom";

export const GUEST_ROOM_SESSION_GRANT_STORAGE_KEY =
  "dong:guest-room-session-grant" as const;

const GUEST_ROOM_ERROR_MESSAGES: Record<GuestRoomErrorCode, string> = {
  room_not_found: "We couldn't find that room. Check the code and try again.",
  room_not_joinable: "This room is no longer accepting guest joins.",
  guest_name_required: "Enter a guest name to join the room.",
  guest_token_expired:
    "Your guest access expired. Rejoin the room to continue.",
  room_unavailable: "This room is unavailable. Check the code or ask the host for a new invitation.",
  rate_limited: "Too many attempts. Please wait before trying again.",
  protected_storage_unavailable: "Secure guest storage is unavailable on this device. Guest access was not saved.",
  secure_random_unavailable: "Secure guest access is unavailable on this device. Please try again later.",
  guest_access_lost: "Your guest access is no longer valid. Ask the host for a fresh invitation.",
  not_permitted: "You cannot leave while this game is in progress. Your guest access remains active.",
  invalid_request: "Unable to continue guest access right now. Try again.",
  unknown_error: "Unable to join the room right now. Try again.",
};

const GUEST_ROOM_KNOWN_ERRORS = new Set<string>([
  "room_not_found",
  "room_not_joinable",
  "guest_name_required",
  "guest_token_expired",
  "guest_token_required",
  "room_unavailable",
  "rate_limited",
  "protected_storage_unavailable",
  "secure_random_unavailable",
  "guest_access_lost",
  "not_permitted",
  "invalid_request",
]);

export class GuestRoomAccessError extends Error {
  constructor(
    readonly code: GuestRoomErrorCode,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = "GuestRoomAccessError";
  }
}

export const boundedGuestRetrySeconds = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.min(300, Math.ceil(value))
    : null;

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const readGuestRoomErrorToken = (value: unknown) => {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const normalizedValue = value.trim();

  return GUEST_ROOM_KNOWN_ERRORS.has(normalizedValue) ? normalizedValue : null;
};

const coerceGuestRoomErrorCode = (
  value: unknown,
): GuestRoomErrorCode | null => {
  const errorToken = readGuestRoomErrorToken(value);

  if (!errorToken) {
    return null;
  }

  if (errorToken === "guest_token_required") {
    return "unknown_error";
  }

  return errorToken as GuestRoomErrorCode;
};

const readGuestRoomErrorCodeFromObject = (value: Record<string, unknown>) => {
  for (const propertyName of ["message", "details", "hint", "code"]) {
    const propertyCode = coerceGuestRoomErrorCode(value[propertyName]);

    if (propertyCode) {
      return propertyCode;
    }
  }

  return null;
};

export const normalizeGuestRoomJoinCode = (
  value: string | null | undefined,
) => {
  const normalizedValue = value?.trim().toUpperCase() ?? "";

  return normalizedValue.length > 0 ? normalizedValue : null;
};

export const normalizeGuestRoomDisplayName = (
  value: string | null | undefined,
) => {
  const normalizedValue = value?.trim() ?? "";

  return normalizedValue.length > 0 ? normalizedValue : null;
};

export const createGuestRoomToken = async () => generateToken();

export const createGuestRoomRotationId = async () => {
  const hex = await generateToken();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export const buildGuestRoomSessionGrant = (
  response: GuestRoomJoinResponse,
): GuestRoomSessionGrant => ({
  guestToken: response.guestToken,
  participantId: response.participantId,
  sessionId: response.sessionId,
  joinCode: response.joinCode,
  displayName: response.displayName,
  grantExpiresAt: response.grantExpiresAt,
});

export const getGuestRoomErrorCode = (error: unknown): GuestRoomErrorCode => {
  const directCode = coerceGuestRoomErrorCode(error);

  if (directCode) {
    return directCode;
  }

  if (error instanceof Error) {
    const errorMessageCode = coerceGuestRoomErrorCode(error.message);

    if (errorMessageCode) {
      return errorMessageCode;
    }
  }

  if (error && typeof error === "object") {
    const objectCode = readGuestRoomErrorCodeFromObject(
      error as Record<string, unknown>,
    );

    if (objectCode) {
      return objectCode;
    }
  }

  return "unknown_error";
};

export const getGuestRoomErrorMessage = (
  error: unknown,
  fallbackMessage = GUEST_ROOM_ERROR_MESSAGES.unknown_error,
) => {
  const errorCode = getGuestRoomErrorCode(error);

  if (errorCode === "unknown_error") {
    return fallbackMessage;
  }

  if (errorCode === "rate_limited") {
    const retry = error && typeof error === "object" && "retryAfterSeconds" in error
      ? boundedGuestRetrySeconds((error as { retryAfterSeconds?: unknown }).retryAfterSeconds)
      : null;
    if (retry !== null) return `Too many attempts. Try again in ${retry} seconds.`;
  }

  return GUEST_ROOM_ERROR_MESSAGES[errorCode] ?? fallbackMessage;
};

export const isExpiredGuestRoomError = (error: unknown) => {
  return ["guest_token_expired", "guest_access_lost"].includes(getGuestRoomErrorCode(error));
};

const isGuestRoomSessionGrant = (
  value: unknown,
): value is GuestRoomSessionGrant => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isNonEmptyString(candidate.guestToken) &&
    isNonEmptyString(candidate.participantId) &&
    isNonEmptyString(candidate.sessionId) &&
    isNonEmptyString(candidate.joinCode) &&
    isNonEmptyString(candidate.displayName)
  );
};

export const readGuestRoomSessionGrant = async (): Promise<GuestRoomSessionGrant | null> => {
  const record = await readCredential();
  if (!record || record.kind !== "joined") return null;
  return {
    guestToken: record.token,
    participantId: record.participantId,
    sessionId: record.sessionId,
    joinCode: record.joinCode,
    displayName: record.displayName,
    grantExpiresAt: record.grantExpiresAt,
  } satisfies GuestRoomSessionGrant;
};

export const readGuestRoomPendingJoin = async () => {
  const record = await readCredential();
  return record?.kind === "pending_join" ? record : null;
};

export const saveGuestRoomPendingJoin = async (joinCode: string, displayName: string, token: string) => {
  await writeCredential({ kind: "pending_join", joinCode, displayName, token });
};

export const readGuestRoomPendingLeave = async (): Promise<GuestRoomSessionGrant | null> => {
  const record = await readCredential();
  if (record?.kind !== "pending_leave") return null;
  return {
    guestToken: record.token,
    participantId: record.participantId,
    sessionId: record.sessionId,
    joinCode: record.joinCode,
    displayName: record.displayName,
    grantExpiresAt: record.grantExpiresAt,
  };
};

export const saveGuestRoomPendingLeave = async (grant: GuestRoomSessionGrant): Promise<void> => {
  await writeCredential({
    kind: "pending_leave", token: grant.guestToken,
    participantId: grant.participantId, sessionId: grant.sessionId,
    joinCode: grant.joinCode, displayName: grant.displayName,
    grantExpiresAt: grant.grantExpiresAt,
  });
};

export const readGuestRoomPendingRotation = async (): Promise<Extract<GuestCredentialRecord, { kind: "pending_rotation" }> | null> => {
  const record = await readCredential();
  return record?.kind === "pending_rotation" ? record : null;
};

export const saveGuestRoomPendingRotation = async (
  grant: GuestRoomSessionGrant,
  replacementToken: string,
  operationId: string,
): Promise<void> => {
  if (!grant.grantExpiresAt) throw new Error("invalid_request");
  await writeCredential({
    kind: "pending_rotation", token: grant.guestToken,
    replacementToken, operationId,
    participantId: grant.participantId, sessionId: grant.sessionId,
    joinCode: grant.joinCode, displayName: grant.displayName,
    grantExpiresAt: grant.grantExpiresAt,
  });
};

/** Read and erase the old plaintext value before any network operation. */
export const readAndRemoveLegacyGuestRoomSessionGrant = async (): Promise<GuestRoomSessionGrant | null> => {
  const storedValue = await AsyncStorage.getItem(GUEST_ROOM_SESSION_GRANT_STORAGE_KEY);
  if (storedValue === null) return null;
  await AsyncStorage.removeItem(GUEST_ROOM_SESSION_GRANT_STORAGE_KEY);
  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (!isGuestRoomSessionGrant(parsed)) return null;
    return {
      ...parsed,
      joinCode: normalizeGuestRoomJoinCode(parsed.joinCode) ?? parsed.joinCode,
      displayName: normalizeGuestRoomDisplayName(parsed.displayName) ?? parsed.displayName,
    };
  } catch {
    return null;
  }
};

export const saveGuestRoomSessionGrant = async (
  grant: GuestRoomSessionGrant,
) => {
  await writeCredential({
    kind: "joined",
    token: grant.guestToken,
    participantId: grant.participantId,
    sessionId: grant.sessionId,
    joinCode: grant.joinCode,
    displayName: grant.displayName,
    grantExpiresAt: grant.grantExpiresAt,
  });

  return grant;
};

export const clearGuestRoomSessionGrant = async () => {
  await clearCredential();
  await AsyncStorage.removeItem(GUEST_ROOM_SESSION_GRANT_STORAGE_KEY);
};
