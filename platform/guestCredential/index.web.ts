import {
  decodeGuestCredentialRecord,
  encodeGuestCredentialRecord,
  GUEST_CREDENTIAL_STORAGE_KEY,
  GuestCredentialError,
  type GuestCredentialRecord,
} from "./types";

const sessionStore = (): Storage => {
  try {
    if (typeof window === "undefined" || !window.isSecureContext) throw new Error("insecure context");
    return window.sessionStorage;
  } catch {
    throw new GuestCredentialError("protected_storage_unavailable");
  }
};

export const generateToken = async (): Promise<string> => {
  try {
    if (typeof window === "undefined" || !window.isSecureContext || typeof globalThis.crypto?.getRandomValues !== "function") {
      throw new Error("secure randomness unavailable");
    }
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    throw new GuestCredentialError("secure_random_unavailable");
  }
};

export const read = async (): Promise<GuestCredentialRecord | null> => {
  try {
    const raw = sessionStore().getItem(GUEST_CREDENTIAL_STORAGE_KEY);
    const record = decodeGuestCredentialRecord(raw);
    if (raw && !record) throw new Error("invalid session record");
    return record;
  } catch {
    throw new GuestCredentialError("protected_storage_unavailable");
  }
};

export const write = async (record: GuestCredentialRecord): Promise<void> => {
  try {
    sessionStore().setItem(GUEST_CREDENTIAL_STORAGE_KEY, encodeGuestCredentialRecord(record));
  } catch {
    throw new GuestCredentialError("protected_storage_unavailable");
  }
};

export const clear = async (): Promise<void> => {
  try {
    sessionStore().removeItem(GUEST_CREDENTIAL_STORAGE_KEY);
  } catch {
    throw new GuestCredentialError("protected_storage_unavailable");
  }
};

export const stageRotation = async (record: Extract<GuestCredentialRecord, { kind: "pending_rotation" }>) => write(record);
