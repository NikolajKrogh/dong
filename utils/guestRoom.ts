import AsyncStorage from "@react-native-async-storage/async-storage";

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
  unknown_error: "Unable to join the room right now. Try again.",
};

const GUEST_ROOM_KNOWN_ERRORS = new Set<string>([
  "room_not_found",
  "room_not_joinable",
  "guest_name_required",
  "guest_token_expired",
  "guest_token_required",
]);

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

export const createGuestRoomToken = () => {
  const cryptoObject = globalThis.crypto as
    | { getRandomValues?: (array: Uint8Array) => Uint8Array }
    | undefined;

  if (cryptoObject?.getRandomValues) {
    const bytes = cryptoObject.getRandomValues(new Uint8Array(18));

    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 36);
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 16)}`;
};

export const buildGuestRoomSessionGrant = (
  response: GuestRoomJoinResponse,
): GuestRoomSessionGrant => ({
  guestToken: response.guestToken,
  participantId: response.participantId,
  sessionId: response.sessionId,
  joinCode: response.joinCode,
  displayName: response.displayName,
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

  return GUEST_ROOM_ERROR_MESSAGES[errorCode] ?? fallbackMessage;
};

export const isExpiredGuestRoomError = (error: unknown) => {
  return getGuestRoomErrorCode(error) === "guest_token_expired";
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

export const readGuestRoomSessionGrant = async () => {
  const storedValue = await AsyncStorage.getItem(
    GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
  );

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;

    if (!isGuestRoomSessionGrant(parsedValue)) {
      await AsyncStorage.removeItem(GUEST_ROOM_SESSION_GRANT_STORAGE_KEY);
      return null;
    }

    return {
      ...parsedValue,
      joinCode:
        normalizeGuestRoomJoinCode(parsedValue.joinCode) ??
        parsedValue.joinCode,
      displayName:
        normalizeGuestRoomDisplayName(parsedValue.displayName) ??
        parsedValue.displayName,
    } satisfies GuestRoomSessionGrant;
  } catch {
    await AsyncStorage.removeItem(GUEST_ROOM_SESSION_GRANT_STORAGE_KEY);
    return null;
  }
};

export const saveGuestRoomSessionGrant = async (
  grant: GuestRoomSessionGrant,
) => {
  await AsyncStorage.setItem(
    GUEST_ROOM_SESSION_GRANT_STORAGE_KEY,
    JSON.stringify(grant),
  );

  return grant;
};

export const clearGuestRoomSessionGrant = async () => {
  await AsyncStorage.removeItem(GUEST_ROOM_SESSION_GRANT_STORAGE_KEY);
};
