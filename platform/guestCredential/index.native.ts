import { getRandomBytesAsync } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import {
  decodeGuestCredentialRecord,
  encodeGuestCredentialRecord,
  GUEST_CREDENTIAL_STORAGE_KEY,
  GuestCredentialError,
  type GuestCredentialRecord,
} from "./types";

export const generateToken = async (): Promise<string> => {
  try {
    const bytes = await getRandomBytesAsync(32);
    if (bytes.length !== 32) throw new Error("incorrect random byte count");
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    throw new GuestCredentialError("secure_random_unavailable");
  }
};

export const read = async (): Promise<GuestCredentialRecord | null> => {
  try {
    const raw = await SecureStore.getItemAsync(GUEST_CREDENTIAL_STORAGE_KEY);
    const record = decodeGuestCredentialRecord(raw);
    if (raw && !record) throw new Error("invalid protected record");
    return record;
  } catch {
    throw new GuestCredentialError("protected_storage_unavailable");
  }
};

export const write = async (record: GuestCredentialRecord): Promise<void> => {
  try {
    await SecureStore.setItemAsync(GUEST_CREDENTIAL_STORAGE_KEY, encodeGuestCredentialRecord(record));
  } catch {
    throw new GuestCredentialError("protected_storage_unavailable");
  }
};

export const clear = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(GUEST_CREDENTIAL_STORAGE_KEY);
  } catch {
    throw new GuestCredentialError("protected_storage_unavailable");
  }
};

export const stageRotation = async (record: Extract<GuestCredentialRecord, { kind: "pending_rotation" }>) => write(record);
