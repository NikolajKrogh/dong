/** No raw token or join code is ever included in this error's message. */
export class GuestCredentialError extends Error {
  constructor(
    readonly code: "secure_random_unavailable" | "protected_storage_unavailable",
  ) {
    super(code);
    this.name = "GuestCredentialError";
  }
}

export type GuestCredentialRecord =
  | {
      kind: "pending_join";
      token: string;
      joinCode: string;
      displayName: string;
    }
  | {
      kind: "joined";
      token: string;
      participantId: string;
      sessionId: string;
      joinCode: string;
      displayName: string;
      grantExpiresAt?: string;
    }
  | {
      kind: "pending_rotation";
      token: string;
      replacementToken: string;
      operationId: string;
      participantId: string;
      sessionId: string;
      joinCode: string;
      displayName: string;
      grantExpiresAt: string;
    }
  | {
      kind: "pending_leave";
      token: string;
      participantId: string;
      sessionId: string;
      joinCode: string;
      displayName: string;
      grantExpiresAt?: string;
    };

export const GUEST_CREDENTIAL_STORAGE_KEY = "dong.guest-credential.v1";

const isGuestCredentialRecord = (value: unknown): value is GuestCredentialRecord => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const has = (key: string) => typeof record[key] === "string" && (record[key] as string).length > 0;
  if (!has("token") || !has("joinCode") || !has("displayName")) return false;
  if (record.kind === "pending_join") return true;
  if (!has("participantId") || !has("sessionId")) return false;
  if (record.kind === "joined" || record.kind === "pending_leave") return true;
  return record.kind === "pending_rotation" && has("replacementToken") && has("operationId") && has("grantExpiresAt");
};

export const encodeGuestCredentialRecord = (record: GuestCredentialRecord) => JSON.stringify(record);

export const decodeGuestCredentialRecord = (raw: string | null): GuestCredentialRecord | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGuestCredentialRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
