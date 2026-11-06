import { Buffer } from 'node:buffer';
import { decodeCanonicalBase64Url } from '../../../../shared/encoding/base64url.ts';
import type { GoalNotificationProof } from './contracts.ts';

export async function sha256Hex(value: Uint8Array<ArrayBuffer>): Promise<string> {
  return Buffer.from(await crypto.subtle.digest('SHA-256', value)).toString('hex');
}

export function decodeCapability(value: string): Uint8Array<ArrayBuffer> {
  const bytes = decodeCanonicalBase64Url(value);
  if (bytes?.length !== 32) throw new Error('invalid_capability');
  return bytes;
}

export interface GoalNotificationAuthority {
  kind: GoalNotificationProof['kind'];
  game: string | null;
  account: string | null;
  authSession: string | null;
  grantDigest: string | null;
}

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function resolveGoalNotificationAuthority(
  proof: GoalNotificationProof,
  request: Request,
  config: { authUrl: string; publicKey: string; fetch?: typeof fetch },
): Promise<GoalNotificationAuthority | null> {
  if (proof.kind !== 'registered') {
    const bytes = proof.kind === 'guest'
      ? new TextEncoder().encode(proof.guestToken)
      : decodeCapability(proof.grantToken);
    return {
      kind: proof.kind,
      game: proof.kind === 'guest' ? proof.sessionId : null,
      account: null,
      authSession: null,
      grantDigest: await sha256Hex(bytes),
    };
  }

  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ') || bearer.length > 8192) return null;
  const claimsBytes = decodeCanonicalBase64Url(bearer.slice(7).split('.')[1]);
  if (!claimsBytes) return null;
  let claims: { sub?: unknown; session_id?: unknown };
  try { claims = JSON.parse(new TextDecoder().decode(claimsBytes)); } catch { return null; }
  if (
    !claims || typeof claims.sub !== 'string' || typeof claims.session_id !== 'string' ||
    !uuid.test(claims.sub) || !uuid.test(claims.session_id)
  ) return null;

  // Verify the same JWT with Auth before trusting its session ID. SQL then
  // checks that the session still exists and owns an active room participant.
  const response = await (config.fetch ?? fetch)(config.authUrl + '/auth/v1/user', {
    headers: { authorization: bearer, apikey: config.publicKey },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    return null;
  }
  const user = await response.json();
  if (user?.id !== claims.sub) return null;
  return {
    kind: 'registered', game: proof.sessionId, account: claims.sub,
    authSession: claims.session_id, grantDigest: null,
  };
}
