import { webcrypto } from 'node:crypto';
import { replaceSoloTracking, type SoloTrackingDatabase, type TrackingKeyring } from '../../supabase/functions/_shared/football-matches/footballMatchService';

const crypto = webcrypto as unknown as Crypto;
const request = { operationId: '00000000-0000-4030-8000-000000000501', creationNonce: 'A'.repeat(43), catalogMatchIds: ['1'] };
const prepared = { ok: true, issuanceId: '00000000-0000-4030-8000-000000000601', signingKeyId: 'one', selectionVersion: 1, isReplay: false, catalogMatchIds: ['1'], expiresAt: '2026-10-26T18:00:00Z', state: 'active' };
const keyring: TrackingKeyring = { currentKeyId: 'one', keys: { one: Buffer.alloc(32, 7).toString('base64url'), two: Buffer.alloc(32, 8).toString('base64url') } };
function database(): jest.Mocked<SoloTrackingDatabase> {
  return { prepareSolo: jest.fn().mockResolvedValue(prepared), finalizeSolo: jest.fn().mockResolvedValue(prepared), replaceSolo: jest.fn().mockResolvedValue({ ...prepared, selectionVersion: 2, state: 'ended', catalogMatchIds: [] }) };
}

describe('issuance-bound solo capabilities', () => {
  it.each([0, 1, 31, 33, 64])('rejects a canonical %i-byte nonce before allocating a tracking grant', async byteCount => {
    const db = database();
    const creationNonce = Buffer.alloc(byteCount).toString('base64url');
    await expect(replaceSoloTracking({ ...request, creationNonce }, { database: db, keyring, crypto }))
      .rejects.toMatchObject({ code: 'invalid_selection' });
    expect(db.prepareSolo).not.toHaveBeenCalled();
  });

  it('normalizes identifiers before hashing and preparing a grant', async () => {
    const db = database();
    await replaceSoloTracking({
      ...request, operationId: 'ABCDEFAB-ABCD-4ABC-8ABC-ABCDEFABCDEF', catalogMatchIds: ['2', '1', '2'],
    }, { database: db, keyring, crypto });
    expect(db.prepareSolo).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'abcdefab-abcd-4abc-8abc-abcdefabcdef', catalogMatchIds: ['1', '2'],
    }));
  });

  it.each([
    { operationId: '00000000-0000-1030-8000-000000000501' },
    { catalogMatchIds: ['9223372036854775808'] },
    { catalogMatchIds: ['01'] },
    { catalogMatchIds: Array.from({ length: 21 }, () => '1') },
  ])('rejects malformed selection fields before allocating a grant: %j', async fields => {
    const db = database();
    await expect(replaceSoloTracking({ ...request, ...fields }, { database: db, keyring, crypto }))
      .rejects.toMatchObject({ code: 'invalid_selection' });
    expect(db.prepareSolo).not.toHaveBeenCalled();
  });

  it('keeps database-issued identifiers distinct from request bigint validation', async () => {
    const db = database();
    db.finalizeSolo.mockResolvedValue({ ...prepared, catalogMatchIds: ['9999999999999999999'] });
    expect(await replaceSoloTracking(request, { database: db, keyring, crypto }))
      .toMatchObject({ catalogMatchIds: ['9999999999999999999'] });
  });

  it('maps invalid prepared issuance UUIDs to configuration errors', async () => {
    const db = database();
    db.prepareSolo.mockResolvedValue({ ...prepared, issuanceId: '00000000-0000-1030-8000-000000000601' });
    await expect(replaceSoloTracking(request, { database: db, keyring, crypto }))
      .rejects.toMatchObject({ code: 'configuration_required' });
    expect(db.finalizeSolo).not.toHaveBeenCalled();
  });

  it.each([
    { selectionVersion: Number.MAX_SAFE_INTEGER + 1 },
    { catalogMatchIds: ['01'] },
    { state: 'unknown' },
  ])('maps malformed database grant fields to safe transport errors: %j', async fields => {
    const db = database();
    db.finalizeSolo.mockResolvedValue({ ...prepared, ...fields });
    await expect(replaceSoloTracking(request, { database: db, keyring, crypto }))
      .rejects.toMatchObject({ code: 'transport_unavailable' });
  });

  it('reconstructs the same capability only for the same issuance and binds a new post-cleanup issuance to a different token', async () => {
    const db = database();
    const first = await replaceSoloTracking(request, { database: db, keyring, crypto });
    db.prepareSolo.mockResolvedValue({ ...prepared, isReplay: true });
    db.finalizeSolo.mockResolvedValue({ ...prepared, isReplay: true });
    const replay = await replaceSoloTracking(request, { database: db, keyring, crypto });
    expect(replay.grantToken).toBe(first.grantToken);
    expect(replay.isReplay).toBe(true);
    db.prepareSolo.mockResolvedValue({ ...prepared, issuanceId: '00000000-0000-4030-8000-000000000602' });
    db.finalizeSolo.mockResolvedValue(prepared);
    const fresh = await replaceSoloTracking(request, { database: db, keyring, crypto });
    expect(fresh.grantToken).not.toBe(first.grantToken);
    const storedInputs = JSON.stringify([...db.prepareSolo.mock.calls, ...db.finalizeSolo.mock.calls]);
    expect(storedInputs).not.toContain(first.grantToken);
    expect(storedInputs).not.toContain(request.creationNonce);
    expect(Object.keys(first).sort()).toEqual(['catalogMatchIds','expiresAt','grantToken','isReplay','selectionVersion','state']);
  });

  it('uses the issuance key across rotation and fails closed if its retiring key is unavailable', async () => {
    const db = database();
    const original = await replaceSoloTracking(request, { database: db, keyring, crypto });
    const rotated = { ...keyring, currentKeyId: 'two' };
    expect((await replaceSoloTracking(request, { database: db, keyring: rotated, crypto })).grantToken).toBe(original.grantToken);
    db.finalizeSolo.mockClear();
    await expect(replaceSoloTracking(request, { database: db, keyring: { currentKeyId: 'two', keys: { two: keyring.keys.two } }, crypto })).rejects.toMatchObject({ code: 'configuration_required' });
    expect(db.finalizeSolo).not.toHaveBeenCalled();
  });

  it('replaces/ends only through the stored token digest and original operation/version', async () => {
    const db = database();
    const grant = await replaceSoloTracking(request, { database: db, keyring, crypto });
    const tokenDigest = db.finalizeSolo.mock.calls[0][0].tokenDigest;
    db.prepareSolo.mockClear();
    const ended = await replaceSoloTracking({ operationId: '00000000-0000-4030-8000-000000000502', grantToken: grant.grantToken, expectedSelectionVersion: 1, catalogMatchIds: [] }, { database: db, keyring, crypto });
    expect(ended).toMatchObject({ state: 'ended', selectionVersion: 2, grantToken: grant.grantToken });
    expect(db.replaceSolo).toHaveBeenCalledWith(expect.objectContaining({ tokenDigest, expectedVersion: 1, operationId: '00000000-0000-4030-8000-000000000502', catalogMatchIds: [] }));
    expect(db.prepareSolo).not.toHaveBeenCalled();
  });

  it('rejects malformed nonce authority before allocating and returns safe errors without credential data', async () => {
    const db = database();
    await expect(replaceSoloTracking({ ...request, creationNonce: 'B'.repeat(43) }, { database: db, keyring, crypto })).rejects.toMatchObject({ code: 'invalid_selection' });
    expect(db.prepareSolo).not.toHaveBeenCalled();
    db.prepareSolo.mockRejectedValue(new Error('postgres://private-password and provider body'));
    await expect(replaceSoloTracking(request, { database: db, keyring, crypto })).rejects.toMatchObject({ code: 'transport_unavailable', message: 'transport_unavailable' });
  });
});
