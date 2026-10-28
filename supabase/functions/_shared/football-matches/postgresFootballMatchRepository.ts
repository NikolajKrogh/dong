import postgres from 'npm:postgres@3.4.9';
import type { ClaimedRequest, DeferredWork, FootballMatchRepository, WorkerSlot } from './footballMatchService.ts';
import type { MatchDiscoveryResult, SavedMatchesResult } from '../../../../types/footballMatch.ts';

type SqlResult = Record<string, unknown>;
function object(value: unknown): SqlResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_database_result');
  return value as SqlResult;
}
function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('invalid_database_result');
  return value;
}
function deferred(value: SqlResult): DeferredWork {
  return { ok: false, code: requiredString(value.code) };
}

/** Use a dedicated server-only login granted match_catalog_backend, never a client/JWT key. */
export function createPostgresFootballMatchRepository(connectionString: string): FootballMatchRepository {
  const address = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(address.protocol)) throw new Error('configuration_required');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname.toLowerCase());
  const sslMode = address.searchParams.get('sslmode');
  if (!loopback && sslMode !== null && sslMode !== 'verify-full') throw new Error('configuration_required');
  // The pinned driver implements max_pipeline but omits it from its public types.
  const options = {
    prepare: false, max: 4, idle_timeout: 20, connect_timeout: 5,
    // Each call below is one atomic database function; do not add sql.begin here.
    // max_pipeline:1 still writes a second query before closing the connection's queue.
    // Zero prevents that Supavisor transaction-mode hazard; upstream zero/begin is broken.
    max_pipeline: 0,
    // PostgresJS ssl:'require' disables certificate verification. true keeps TLS
    // certificate/hostname verification; only explicit local loopback may use plaintext.
    ssl: !loopback,
    connection: { application_name: 'dong-match-catalog' },
  };
  const sql = postgres(connectionString, options);
  return {
    async prepareDiscovery(selection) {
      const [row] = await sql`select private.prepare_match_discovery(${sql.array(selection.leagueCodes)}::text[],${selection.date}::date) as result`;
      return row.result;
    },
    async readDiscovery(selection) {
      const [row] = await sql`select private.finish_match_discovery(${sql.array(selection.leagueCodes)}::text[],${selection.date}::date) as result`;
      return object(row.result) as unknown as MatchDiscoveryResult;
    },
    async readSaved(ids, projection) {
      const [row] = await sql`select private.read_saved_matches(${sql.array(ids)}::text[],${projection}) as result`;
      return object(row.result) as unknown as SavedMatchesResult;
    },
    async pendingRooms(groupIds) {
      const [row] = await sql`select private.pending_catalog_rooms(${groupIds === null ? null : sql.array(groupIds)}::bigint[]) as result`;
      if (!Array.isArray(row.result) || !row.result.every(id => typeof id === 'string')) throw new Error('invalid_database_result');
      return row.result;
    },
    async processRoom(roomId, workerToken, generation) {
      const [row] = await sql`select private.process_catalog_room(${roomId}::uuid,${workerToken}::uuid,${generation}::bigint) as result`;
      return row.result;
    },
    async beginDispatch(token, generation) {
      const [row] = await sql`select private.begin_catalog_dispatch(${token}::uuid,${generation}::bigint) as result`;
      const result = object(row.result);
      if (result.ok !== true) return deferred(result);
      if (!Array.isArray(result.groupIds) || !result.groupIds.every(id => typeof id === 'string')) throw new Error('invalid_database_result');
      return { ok: true, groupIds: result.groupIds };
    },
    async acquireSlot(purpose, generation) {
      const [row] = await sql`select private.acquire_provider_worker_slot(${purpose},${generation}) as result`;
      const result = object(row.result);
      if (result.ok !== true) return deferred(result);
      if (result.workerGeneration !== generation) throw new Error('invalid_database_result');
      return { ok: true, dispatchToken: requiredString(result.dispatchToken), workerGeneration: generation } satisfies WorkerSlot;
    },
    async releaseSlot(token, generation, outcome) {
      await sql`select private.release_provider_worker_slot(${token}::uuid,${generation},${outcome})`;
    },
    async claimBatch(groupIds, purpose, workerToken, generation) {
      const [row] = await sql`select private.claim_provider_batch(${sql.array(groupIds)}::bigint[],${purpose},${workerToken}::uuid,${generation}::bigint) as result`;
      const result = object(row.result);
      if (result.ok !== true) return [];
      if (!Array.isArray(result.claims) || result.claims.length>4) throw new Error('invalid_database_result');
      return result.claims.map(value => {
        const claim = object(value);
        if (claim.workerGeneration !== generation) throw new Error('invalid_database_result');
        const leagueCode = requiredString(claim.leagueCode);
        let resource: ClaimedRequest['resource'];
        if (claim.kind === 'scoreboard') {
          resource = { kind: 'scoreboard', leagueCode, date: requiredString(claim.date) };
        } else if (claim.kind === 'summary') {
          resource = { kind: 'summary', leagueCode, sourceEventId: requiredString(claim.sourceEventId) };
        } else {
          throw new Error('invalid_database_result');
        }
        return { ok: true, attemptId: requiredString(claim.attemptId), leaseToken: requiredString(claim.leaseToken), workerGeneration: generation, resource } satisfies ClaimedRequest;
      });
    },
    async accept(claim, projection) {
      const [row] = await sql`select private.accept_provider_response(${claim.attemptId}::bigint,${claim.leaseToken}::uuid,${claim.workerGeneration},${sql.json(projection as unknown as postgres.JSONValue)}::jsonb) as result`;
      return { ok: object(row.result).ok === true };
    },
    async fail(claim, failure) {
      await sql`select private.fail_provider_request(${claim.attemptId}::bigint,${claim.leaseToken}::uuid,${claim.workerGeneration},${failure.code},${failure.status},${failure.retryAfterSeconds})`;
    },
    async prepareSolo(input) {
      const [row] = await sql`select private.prepare_solo_tracking(${input.nonceDigest},${input.creationDigest},${input.operationId}::uuid,${input.signingKeyId},${sql.array(input.catalogMatchIds)}::text[]) as result`;
      return row.result;
    },
    async finalizeSolo(input) {
      const [row] = await sql`select private.finalize_solo_tracking(${input.issuanceId}::uuid,${input.nonceDigest},${input.tokenDigest},${input.isReplay}) as result`;
      return row.result;
    },
    async replaceSolo(input) {
      const [row] = await sql`select private.replace_solo_tracking(${input.tokenDigest},${input.expectedVersion}::integer,${input.operationId}::uuid,${input.requestDigest},${sql.array(input.catalogMatchIds)}::text[]) as result`;
      return row.result;
    },
  };
}
