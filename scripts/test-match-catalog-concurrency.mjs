/* global Deno */
// Backend integration harness, not an app/E2E test. Only the disposable feature030 profile is accepted.
// DENO_DIR=.supabase/deno-cache npx deno@2.9.6 run --no-lock --cached-only --allow-env --allow-read=.supabase/feature030/supabase/config.toml,supabase/tests/fixtures/match_catalog.sql.inc --allow-net=127.0.0.1 scripts/test-match-catalog-concurrency.mjs
import process from 'node:process';
// eslint-disable-next-line import/no-unresolved -- Deno resolves this pinned npm module.
import postgres from 'npm:postgres@3.4.9';
import { createFootballMatchService, runDueMatchWork } from '../supabase/functions/_shared/football-matches/footballMatchService.ts';
import { createEspnHttpClient } from '../supabase/functions/_shared/football-matches/espnHttpClient.ts';
import { createPostgresFootballMatchRepository } from '../supabase/functions/_shared/football-matches/postgresFootballMatchRepository.ts';

function assert(condition, message) { if (!condition) throw new Error(message); }
assert(Deno.args.every(argument => argument === '--monitor'), 'Unknown harness argument');
const monitorMode = Deno.args.includes('--monitor');
function testAddress() {
  try { return new URL(Deno.env.get('MATCH_CATALOG_TEST_DATABASE_URL') ?? 'postgres://postgres:postgres@127.0.0.1:58322/postgres'); }
  catch { throw new Error('Invalid local database binding'); }
}
const address = testAddress();
assert(address.protocol === 'postgres:' && address.hostname === '127.0.0.1' && address.port === '58322' && address.pathname === '/postgres', 'Refusing a database outside the disposable feature030 binding');
const profile = await Deno.readTextFile(new URL('../.supabase/feature030/supabase/config.toml', import.meta.url));
assert(/project_id\s*=\s*"dong-feature030"/.test(profile) && /port\s*=\s*58322\b/.test(profile), 'Disposable profile guard failed');

const sql = postgres(address.toString(), { prepare: false, max: 4, connect_timeout: 5 });
const marker = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const role = `match_catalog_test_${marker}`;
const signingKeyId = `harness-${marker}`;
const accountId = crypto.randomUUID();
const roomIds = Array.from({ length: 100 }, () => crypto.randomUUID());
const manualRoomId = crypto.randomUUID();
const allRoomIds = [...roomIds, manualRoomId];
const codes = ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1'];
const date = new Date().toISOString().slice(0, 10);
const kickoff = new Date(monitorMode ? Date.now() + 10_000 : Math.max(Date.parse(`${date}T00:00:00Z`), Date.now() - 5 * 60_000)).toISOString();
const startedAt = new Date();
let originals;
let groups = [];
let sources = [];
let roleCreated = false;
let server;
let result;
let failure;
const nativeFetch = globalThis.fetch;
const httpCounts = new Map();
let escapedRequests = 0;
const acceptanceFailures = [];
const providerFailures = [];
let goalVisibleAt = null;
let terminalSecondFixture = false;
let sourceResponsePayloadBytes = 0;
let savedResultSerializedBytes = 0;
let savedReadResponses = 0;
const encoder = new TextEncoder();

async function observeSavedRead(catalog, ids) {
  const saved = await catalog.readSavedMatches(ids);
  savedResultSerializedBytes += encoder.encode(JSON.stringify(saved)).byteLength;
  savedReadResponses++;
  return saved;
}

function board(code) {
  const index = codes.indexOf(code);
  const homeScore = goalVisibleAt !== null && Date.now() >= goalVisibleAt ? '3' : '2';
  // Completion is an explicit upstream fixture fact, never inferred from the score.
  const completed = terminalSecondFixture && goalVisibleAt !== null && Date.now() >= goalVisibleAt;
  return { events: [{ id: `harness-${marker}-${index}`, date: kickoff, timeValid: true,
    status: completed ? { type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true }, period: 2, clock: 5400, displayClock: 'FT' }
      : { type: { name: 'STATUS_IN_PROGRESS', state: 'in', completed: false }, period: 1, clock: 600, displayClock: '10\u2032' },
    competitions: [{ id: `competition-${marker}-${index}`, competitors: [
      { homeAway: 'home', score: homeScore, team: { id: `home-${marker}-${index}`, displayName: `Home ${index}` } },
      { homeAway: 'away', score: '1', team: { id: `away-${marker}-${index}`, displayName: `Away ${index}` } },
    ] }],
  }] };
}

async function prepare() {
  await sql.begin(async transaction => {
    const [policy] = await transaction`select * from private.provider_budget_state where provider='espn' for update`;
    const slots = await transaction`select * from private.provider_worker_slots order by id for update`;
    assert(slots.every(slot => !slot.lease_until || new Date(slot.lease_until) <= startedAt), 'Wait for active local worker slots before running the harness');
    const jobs = await transaction`select active from cron.job where jobname='match-catalog-monitor'`;
    assert(jobs.every(job => !job.active), 'Refusing to run with a live scheduler');
    const existing = await transaction`select g.* from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code=any(${transaction.array(codes)}::text[]) and g.resource_kind='scoreboard' and g.request_date=${date}::date`;
    const occupied = await transaction`select count(*)::integer as count from private.provider_matches where scoreboard_group_id=any(${transaction.array(existing.map(group => group.id))}::bigint[])`;
    const attempts = await transaction`select count(*)::integer as count from private.provider_request_attempts where group_id=any(${transaction.array(existing.map(group => group.id))}::bigint[])`;
    assert(occupied[0].count === 0 && attempts[0].count === 0 && existing.every(group => !group.last_successful_check_at), 'Fixture scopes contain prior data; use a clean disposable profile instead of deleting it');
    const usage = await transaction`select * from private.provider_request_daily_usage where usage_day=${date}::date`;
    const counters = await transaction`select * from private.provider_admission_counters where counter_kind='solo_creation' and scope_key='global'`;
    const priorAdmissions = counters.filter(counter => new Date(counter.window_start) >= new Date(startedAt.getTime() - 61 * 60_000)).reduce((sum, counter) => sum + Number(counter.admitted_count), 0);
    assert(priorAdmissions === 0, 'Existing recent solo admissions would contaminate the controlled 100-grant workload');
    originals = { policy, slots, groups: existing, usage, counters };
    await transaction`update private.provider_budget_state set ownership_mode='catalog',rolling_limit=30,daily_limit=5000,daily_count=0,usage_day=${date}::date,cooldown_until=null,pause_reason=null,new_demand_allowed=true,optional_work_allowed=false where provider='espn'`;
    // Reuse the same fixed allowlist and disposable seed as pgTAP; add only the other three requested scopes.
    await transaction.unsafe(await Deno.readTextFile(new URL('../supabase/tests/fixtures/match_catalog.sql.inc', import.meta.url)));
    await transaction`insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,next_attempt_at)
      select 'espn',id,'scoreboard',${date}::date,clock_timestamp() from private.provider_leagues where provider='espn' and league_code=any(${transaction.array(codes)}::text[]) on conflict(provider,scope_key) do nothing`;
    groups = await transaction`select g.*,l.league_code from private.provider_request_groups g join private.provider_leagues l on l.id=g.league_id where l.league_code=any(${transaction.array(codes)}::text[]) and g.resource_kind='scoreboard' and g.request_date=${date}::date order by l.league_code`;
    assert(groups.length === 5, 'Five exact league/date groups are required');
    for (const group of groups) {
      const index = codes.indexOf(group.league_code);
      const [source] = await transaction`insert into private.provider_matches(league_id,source_event_id,home_name,away_name,kickoff_at,kickoff_validity,lifecycle,scoreboard_group_id)
        values(${group.league_id},${`harness-${marker}-${index}`},${`Home ${index}`},${`Away ${index}`},${kickoff}::timestamptz,'confirmed',${monitorMode ? 'scheduled' : 'live'},${group.id}) returning id::text,source_event_id`;
      sources.push({ ...source, leagueCode: group.league_code });
    }
    await transaction`insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
      values(${accountId},'authenticated','authenticated',${`harness-${marker}@test.local`},now(),now(),now(),'{}','{}',false,false)`;
    await transaction`insert into public.accounts(id,username) values(${accountId},${`Harness_${marker}`})`;
    const rooms = allRoomIds.map((id, index) => ({ id, owner_account_id: accountId, join_code: `${marker.slice(0, 4).toUpperCase()}${String(index).padStart(4, '0')}` }));
    await transaction`insert into public.game_sessions ${transaction(rooms, 'id', 'owner_account_id', 'join_code')}`;
    // The existing room trigger creates its registered host; use that real identity.
    const participants = await transaction`select id,session_id from public.participants where session_id=any(${transaction.array(roomIds)}::uuid[]) and account_id=${accountId}`;
    assert(participants.length === 100, 'Each fixture room must retain its trigger-created registered host');
    const matches = roomIds.flatMap(session_id => sources.map(source => ({ id: crypto.randomUUID(), session_id, source_provider: 'espn', source_match_id: source.source_event_id, source_league_code: source.leagueCode, home_team_name: 'Home', away_team_name: 'Away', catalog_match_id: source.id, kickoff_at: kickoff })));
    await transaction`insert into public.matches ${transaction(matches, 'id', 'session_id', 'source_provider', 'source_match_id', 'source_league_code', 'home_team_name', 'away_team_name', 'catalog_match_id', 'kickoff_at')}`;
    const assignments = matches.map(match => ({ session_id: match.session_id, participant_id: participants.find(participant => participant.session_id === match.session_id).id, match_id: match.id }));
    await transaction`insert into public.assignments ${transaction(assignments, 'session_id', 'participant_id', 'match_id')}`;
    const commonIds = matches.filter(match => match.catalog_match_id === sources[0].id).map(match => match.id);
    await transaction`update public.game_sessions room set common_match_id=match.id,state='in_progress' from public.matches match where room.id=match.session_id and match.id=any(${transaction.array(commonIds)}::uuid[])`;
    const manualId = crypto.randomUUID();
    await transaction`insert into public.matches(id,session_id,source_provider,home_team_name,away_team_name) values(${manualId},${manualRoomId},'manual','Manual Home','Manual Away')`;
    await transaction`update public.game_sessions set state='in_progress',common_match_id=${manualId} where id=${manualRoomId}`;
    await transaction`select private.refresh_catalog_group_due(${transaction.array(groups.map(group => group.id))}::bigint[])`;
  });
  await sql`create role ${sql(role)} login password 'fixture-only-local-password'`;
  roleCreated = true;
  await sql`grant match_catalog_backend to ${sql(role)}`;
  await sql`alter role ${sql(role)} set statement_timeout='10s'`;
}

async function cleanup() {
  if (!originals) return;
  await sql.begin(async transaction => {
    const grants = await transaction`select id::text from private.solo_tracking_grants where signing_key_id=${signingKeyId}`;
    await transaction`delete from private.provider_admission_counters where counter_kind='solo_replacement' and scope_key=any(${transaction.array(grants.map(grant => grant.id))}::text[])`;
    await transaction`delete from private.solo_tracking_grants where signing_key_id=${signingKeyId}`;
    await transaction`delete from public.gameplay_events where session_id=any(${transaction.array(allRoomIds)}::uuid[])`;
    await transaction`delete from public.gameplay_command_results where session_id=any(${transaction.array(allRoomIds)}::uuid[])`;
    await transaction`delete from public.assignments where session_id=any(${transaction.array(allRoomIds)}::uuid[])`;
    await transaction`update public.game_sessions set common_match_id=null where id=any(${transaction.array(allRoomIds)}::uuid[])`;
    await transaction`delete from public.matches where session_id=any(${transaction.array(allRoomIds)}::uuid[])`;
    await transaction`delete from public.participants where session_id=any(${transaction.array(allRoomIds)}::uuid[])`;
    await transaction`delete from public.game_sessions where id=any(${transaction.array(allRoomIds)}::uuid[])`;
    await transaction`delete from public.accounts where id=${accountId}`;
    await transaction`delete from auth.users where id=${accountId}`;
    await transaction`delete from private.provider_matches where id=any(${transaction.array(sources.map(source => source.id))}::bigint[])`;
    await transaction`delete from private.provider_teams where source_team_id like ${`%-${marker}-%`}`;
    const completionGroups = await transaction`select id from private.provider_request_groups where resource_kind='summary' and source_event_id=any(${transaction.array(sources.map(source => source.source_event_id))}::text[])`;
    const groupIds = [...groups.map(group => group.id), ...completionGroups.map(group => group.id)];
    await transaction`update private.provider_request_groups set current_attempt_id=null where id=any(${transaction.array(groupIds)}::bigint[])`;
    await transaction`delete from private.provider_request_attempts where group_id=any(${transaction.array(groupIds)}::bigint[])`;
    const newIds = groupIds.filter(id => !originals.groups.some(group => group.id === id));
    await transaction`delete from private.provider_request_groups where id=any(${transaction.array(newIds)}::bigint[])`;
    for (const group of originals.groups) await transaction`update private.provider_request_groups set ${transaction(group, ...Object.keys(group).filter(key => key !== 'id' && key !== 'scope_key'))} where id=${group.id}`;
    for (const slot of originals.slots) await transaction`update private.provider_worker_slots set ${transaction(slot, ...Object.keys(slot).filter(key => key !== 'id'))} where id=${slot.id}`;
    await transaction`delete from private.provider_request_daily_usage where usage_day=${date}::date`;
    if (originals.usage.length) await transaction`insert into private.provider_request_daily_usage ${transaction(originals.usage)}`;
    await transaction`delete from private.provider_admission_counters where counter_kind='solo_creation' and scope_key='global'`;
    if (originals.counters.length) await transaction`insert into private.provider_admission_counters ${transaction(originals.counters)}`;
    await transaction`update private.provider_budget_state set ${transaction(originals.policy, ...Object.keys(originals.policy).filter(key => key !== 'provider'))} where provider='espn'`;
  });
}

function percentile95(values) {
  const ordered = values.map(Number).sort((left, right) => left - right);
  return Math.round(ordered[Math.ceil(ordered.length * 0.95) - 1]);
}

async function monitorClosedRooms(databases, provider, catalogs, generation) {
  terminalSecondFixture = true;
  const beganAt = Date.now();
  const countHttp = () => [...httpCounts.values()].reduce((sum, count) => sum + count, 0);
  assert(Date.now() < Date.parse(kickoff), 'Fixture setup missed the known future kickoff; do not claim a pre-kickoff observation');
  let firstWaveFinishedAt = null;
  let preKickoffHttp = null;
  let completed = false;
  let ticks = 0;
  for (let tick = 0; tick < 7; tick++) {
    const slots = await Promise.all(databases.map(database => database.acquireSlot('live', generation)));
    assert(slots.every(slot => slot.ok), 'The explicit monitoring driver needs two released worker slots');
    await Promise.all(databases.map((database, index) => runDueMatchWork({ database, provider, dispatchToken: slots[index].dispatchToken, generation, deadline: Date.now() + 35_000 })));
    ticks++;
    const http = countHttp();
    if (tick === 0) {
      preKickoffHttp = http;
      assert(http === 0 && Date.now() < Date.parse(kickoff), 'Known future selected matches must perform no pre-kickoff source HTTP');
    }
    const [state] = await sql`select count(*) filter(where home_score=2 and away_score=1)::integer as initial,count(*) filter(where home_score=3 and away_score=1)::integer as updated from public.matches where session_id=any(${sql.array(roomIds)}::uuid[])`;
    assert(http <= 10 && [...httpCounts.values()].every(count => count <= 2), 'Monitoring acquired a scope more than once per live cadence window');
    if (http === 5 && firstWaveFinishedAt === null) {
      firstWaveFinishedAt = Date.now();
      // The fixture's truth changes independently of app reads, between the two source windows.
      goalVisibleAt = Date.now() + 5_000;
    }
    console.log(JSON.stringify({ phase: 'monitor_tick', tick, elapsedMs: Date.now() - beganAt, sourceHttp: http, initialRoomMatches: state.initial, updatedRoomMatches: state.updated }));
    if (http === 10 && state.updated === 500) { completed = true; break; }
    if (tick < 6) await new Promise(resolve => setTimeout(resolve, 15_000));
  }
  assert(completed && firstWaveFinishedAt !== null && goalVisibleAt !== null, 'The bounded 15-second explicit driver did not finish both accepted score windows');
  const [terminal] = await sql`select count(*)::integer as count,count(*) filter(where lifecycle='finished' and is_completed is true)::integer as finished from private.provider_matches where id=any(${sql.array(sources.map(source => source.id))}::bigint[])`;
  const [demand] = await sql`select count(*)::integer as count,count(*) filter(where live_due_at is null)::integer as stopped from private.provider_request_groups where id=any(${sql.array(groups.map(group => group.id))}::bigint[])`;
  assert(terminal.count === 5 && terminal.finished === 5 && demand.count === 5 && demand.stopped === 5, 'Explicitly completed shared matches must stop normal live demand for every room');
  const terminalHttpBefore = countHttp();
  const [terminalAttemptsBefore] = await sql`select count(*)::integer as count from private.provider_request_attempts where group_id=any(${sql.array(groups.map(group => group.id))}::bigint[])`;
  const terminalSlots = await Promise.all(databases.map(database => database.acquireSlot('live', generation)));
  assert(terminalSlots.every(slot => slot.ok), 'A bounded terminal verification tick needs released worker slots');
  await Promise.all(databases.map((database, index) => runDueMatchWork({ database, provider, dispatchToken: terminalSlots[index].dispatchToken, generation, deadline: Date.now() + 35_000 })));
  ticks++;
  const [terminalAttemptsAfter] = await sql`select count(*)::integer as count from private.provider_request_attempts where group_id=any(${sql.array(groups.map(group => group.id))}::bigint[])`;
  const terminalTickExtraHttp = countHttp() - terminalHttpBefore;
  const terminalTickExtraReservations = terminalAttemptsAfter.count - terminalAttemptsBefore.count;
  assert(terminalTickExtraHttp === 0 && terminalTickExtraReservations === 0, 'Terminal verification must add no normal source request or reservation');
  console.log(JSON.stringify({ phase: 'terminal_tick', sourceHttp: countHttp(), finishedSharedMatches: terminal.finished, stoppedLiveGroups: demand.stopped, extraHttp: terminalTickExtraHttp }));
  const initialSource = await sql`select (extract(epoch from(accepted_at-${kickoff}::timestamptz))*1000)::double precision as delay_ms from private.provider_match_observations where match_id=any(${sql.array(sources.map(source => source.id))}::bigint[]) and home_score=2 and away_score=1`;
  const updatedSource = await sql`select (extract(epoch from(accepted_at-${new Date(goalVisibleAt)}::timestamptz))*1000)::double precision as delay_ms from private.provider_match_observations where match_id=any(${sql.array(sources.map(source => source.id))}::bigint[]) and home_score=3 and away_score=1`;
  const initialRooms = await sql`select (extract(epoch from(created_at-${kickoff}::timestamptz))*1000)::double precision as delay_ms from public.gameplay_events where session_id=any(${sql.array(roomIds)}::uuid[]) and actor_kind='provider' and payload->>'resultingHomeScore'='2'`;
  const updatedRooms = await sql`select (extract(epoch from(created_at-${new Date(goalVisibleAt)}::timestamptz))*1000)::double precision as delay_ms from public.gameplay_events where session_id=any(${sql.array(roomIds)}::uuid[]) and actor_kind='provider' and payload->>'resultingHomeScore'='3'`;
  assert(initialSource.length === 5 && updatedSource.length === 5 && initialRooms.length === 500 && updatedRooms.length === 500, 'Both source versions must fan out to all 100 rooms with exactly one snapshot event each');
  const firstSourceP95Ms = percentile95(initialSource.map(item => item.delay_ms));
  const firstRoomP95Ms = percentile95(initialRooms.map(item => item.delay_ms));
  const sourceP95Ms = percentile95(updatedSource.map(item => item.delay_ms));
  const roomP95Ms = percentile95(updatedRooms.map(item => item.delay_ms));
  assert(firstSourceP95Ms <= 90_000 && firstRoomP95Ms <= 90_000, 'Healthy first source and room p95 recording must each remain within 90 seconds of kickoff');
  assert(sourceP95Ms <= 90_000 && roomP95Ms <= 90_000, 'Healthy source and room p95 update latency must each remain within 90 seconds');
  const cadence = await sql`select min(gap_ms)::double precision as minimum_ms from (select (extract(epoch from(reserved_at-lag(reserved_at) over(partition by group_id order by reserved_at)))*1000) as gap_ms from private.provider_request_attempts where group_id=any(${sql.array(groups.map(group => group.id))}::bigint[])) gaps where gap_ms is not null`;
  assert(cadence[0].minimum_ms >= 60_000, 'No live reservation may bypass the 60-second database-time cadence');
  const attempts = await sql`select count(*)::integer as count,count(*) filter(where reserved_at<${kickoff}::timestamptz)::integer as before_kickoff from private.provider_request_attempts where group_id=any(${sql.array(groups.map(group => group.id))}::bigint[]) group by group_id`;
  assert(attempts.length === 5 && attempts.every(group => group.count === 2 && group.before_kickoff === 0), 'Each of five scopes must have exactly two reservations and none before kickoff');
  const savedStarted = performance.now();
  await Promise.all(Array.from({ length: 100 }, async (_, index) => {
    const saved = await observeSavedRead(catalogs[index % 2], sources.map(source => source.id));
    assert(saved.matches.length === 5 && saved.matches.every(match => match.homeScore === 3 && match.awayScore === 1 && match.lifecycle === 'finished' && match.isCompleted === true), 'Saved re-entry must expose the latest accepted final score and explicit completion');
  }));
  const savedRecoveryMs = Math.round(performance.now() - savedStarted);
  assert(savedRecoveryMs <= 5000 && countHttp() === 10, 'Saved module recovery must complete within five seconds and add no source HTTP');
  assert(escapedRequests === 0, 'No monitor request may escape the controlled source adapter');
  return { ok: true, mode: 'monitor', driver: 'explicit-module-15-second-ticks', secondFixtureExplicitlyCompleted: true, rooms: 100, sharedMatches: 5, preKickoffHttp, preKickoffReservations: 0, controlledHttpRequests: countHttp(), sourceReservations: 10, sourceAttemptsPerWindow: 5, sourceVersions: initialSource.length + updatedSource.length, providerEvents: initialRooms.length + updatedRooms.length, finishedSharedMatches: terminal.finished, stoppedLiveGroups: demand.stopped, terminalTickExtraHttp, terminalTickExtraReservations, firstSourceP95Ms, firstRoomP95Ms, updateSourceP95Ms: sourceP95Ms, updateRoomP95Ms: roomP95Ms, minimumReservationGapMs: Math.round(cadence[0].minimum_ms), savedRecoveryMs, savedReentryExtraHttp: 0, ticks, durationMs: Date.now() - beganAt, escapedRequests };
}

const cpuStarted = process.cpuUsage();
const rssStarted = process.memoryUsage().rss;
let sampledPeakRss = rssStarted;
const memorySampler = setInterval(() => { sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss); }, 100);
try {
  await prepare();
  server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen() {} }, async request => {
    const code = new URL(request.url).searchParams.get('league');
    assert(codes.includes(code), 'Unexpected local fixture league');
    assert(request.headers.get('accept') === 'application/json' && request.headers.get('user-agent')?.startsWith('DONG-game-api/'), 'Owned source headers were not preserved');
    httpCounts.set(code, (httpCounts.get(code) ?? 0) + 1);
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json(board(code));
  });
  const localBase = `http://127.0.0.1:${server.addr.port}`;
  const source = createEspnHttpClient({ fetch: (input, options) => {
    const url = new URL(String(input));
    const match = /^\/apis\/site\/v2\/sports\/soccer\/([a-z0-9.]+)\/scoreboard$/.exec(url.pathname);
    if (url.origin !== 'https://site.api.espn.com' || !match || !codes.includes(match[1]) || url.searchParams.get('dates') !== date.replaceAll('-', '') || [...url.searchParams.keys()].some(key => key !== 'dates')) {
      escapedRequests++;
      throw new Error('Provider request escaped the controlled adapter');
    }
    return nativeFetch(`${localBase}/?league=${encodeURIComponent(match[1])}`, options);
  } });
  const readSource = source.read.bind(source);
  source.read = async resource => {
    try { const response = await readSource(resource); if (response.ok) sourceResponsePayloadBytes += response.bytes; return response; }
    catch (error) { providerFailures.push({ code: 'thrown_adapter_error', message: error.message }); throw error; }
  };
  const backendAddress = new URL(address);
  backendAddress.username = role;
  backendAddress.password = 'fixture-only-local-password';
  const databases = [createPostgresFootballMatchRepository(backendAddress.toString()), createPostgresFootballMatchRepository(backendAddress.toString())];
  for (const database of databases) {
    const accept = database.accept.bind(database);
    database.accept = async (claim, projection) => {
      try { const result = await accept(claim, projection); if (!result.ok) acceptanceFailures.push({ code: 'accept_returned_false' }); return result; }
      catch (error) { acceptanceFailures.push({ code: error.code, message: error.message }); throw error; }
    };
    const fail = database.fail.bind(database);
    database.fail = async (claim, failed) => { providerFailures.push({ code: failed.code, status: failed.status }); return await fail(claim, failed); };
  }
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const catalogs = databases.map(database => createFootballMatchService({ database, provider: source, crypto, keyring: { currentKeyId: signingKeyId, keys: { [signingKeyId]: key } } }));
  const generation = Number(originals.policy.worker_generation);
  const selection = { leagueCodes: codes, date };
  const catalogIds = sources.map(item => item.id);
  if (monitorMode) {
    result = await monitorClosedRooms(databases, source, catalogs, generation);
  } else {
  const nonce = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const admitSolo = index => catalogs[index % 2].replaceSoloTracking({ operationId: crypto.randomUUID(), creationNonce: nonce(), catalogMatchIds: catalogIds });
  let concurrentCreation;
  const admitAndRetrySameCreation = async () => {
    const selection = { operationId: crypto.randomUUID(), creationNonce: nonce(), catalogMatchIds: catalogIds };
    const replies = await Promise.all(catalogs.map(catalog => catalog.replaceSoloTracking(selection)));
    assert(replies[0].grantToken === replies[1].grantToken && replies.filter(reply => reply.isReplay).length === 1, 'Concurrent identical creation must recover one issuance/token, not admit twice');
    const nonceBytes = Uint8Array.from(atob(selection.creationNonce.replaceAll('-', '+').replaceAll('_', '/') + '='), char => char.charCodeAt(0));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', nonceBytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    const issuances = await sql`select grant_row.id::text,grant_row.selection_version,array(select selected.match_id::text from private.solo_tracked_matches selected where selected.grant_id=grant_row.id order by selected.match_id) as selected
      from private.solo_tracking_grants grant_row where grant_row.signing_key_id=${signingKeyId} and grant_row.nonce_digest=decode(${digest},'hex')`;
    assert(issuances.length === 1 && issuances[0].selection_version === 1, 'A creation race must persist exactly one server UUID and current selection version');
    const expected = JSON.stringify([...catalogIds].sort());
    assert(JSON.stringify([...issuances[0].selected].sort()) === expected && replies.every(reply => reply.selectionVersion === 1 && JSON.stringify([...reply.catalogMatchIds].sort()) === expected), 'Creation retries must return the current saved selection');
    concurrentCreation = { requests: 2, serverIssuances: 1, replayResponses: 1, sameToken: true, currentSelectionVersion: 1, currentSelectionMatches: true };
  };
  const slots = await Promise.all(databases.map(database => database.acquireSlot('live', generation)));
  assert(slots.every(slot => slot.ok), 'Expected two useful live-worker slots');
  const coldStart = performance.now();
  await Promise.all([
    ...databases.map((database, index) => runDueMatchWork({ database, provider: source, dispatchToken: slots[index].dispatchToken, generation, deadline: Date.now() + 35_000 })),
    ...Array.from({ length: 20 }, (_, index) => catalogs[index % 2].discoverMatches(selection)),
    admitAndRetrySameCreation(),
    ...Array.from({ length: 9 }, (_, index) => admitSolo(index)),
  ]);
  const coldMs = performance.now() - coldStart;
  const coldHttp = [...httpCounts.values()].reduce((sum, count) => sum + count, 0);
  assert(coldHttp === 5 && [...httpCounts.values()].every(count => count === 1), 'Cold overlapping consumers must acquire each of five scopes exactly once');
  const [coldAttempts] = await sql`select count(*)::integer as count from private.provider_request_attempts where group_id=any(${sql.array(groups.map(group => group.id))}::bigint[])`;
  assert(coldAttempts.count === 5, 'SQL reservations disagree with controlled HTTP count');
  // Finish bounded durable replay if one concurrent worker encountered a room locked by its peer.
  let continuations = 0;
  while ((await databases[0].pendingRooms(null)).length > 0 && continuations < 3) {
    const slot = await databases[0].acquireSlot('live', generation);
    assert(slot.ok, 'Replay continuation needs an available worker slot');
    await runDueMatchWork({ database: databases[0], provider: source, dispatchToken: slot.dispatchToken, generation, deadline: Date.now() + 35_000 });
    continuations++;
  }
  const [roomState] = await sql`select count(*)::integer as total,count(*) filter(where home_score=2 and away_score=1 and last_applied_observation_version=1)::integer as applied from public.matches where session_id=any(${sql.array(roomIds)}::uuid[])`;
  if (roomState.total !== 500 || roomState.applied !== 500) {
    const progress = await sql`select source.home_score,source.away_score,source.observation_version,room_match.home_score as applied_home,room_match.away_score as applied_away,room_match.last_applied_observation_version,count(*)::integer as count
      from public.matches room_match join private.provider_matches source on source.id=room_match.catalog_match_id where room_match.session_id=any(${sql.array(roomIds)}::uuid[])
      group by source.home_score,source.away_score,source.observation_version,room_match.home_score,room_match.away_score,room_match.last_applied_observation_version`;
    const ownership = await sql`select a.outcome,g.last_error,g.owner_generation,g.lease_until>clock_timestamp() as valid_lease,g.lease_token=a.lease_token as same_token,g.owner_generation=a.worker_generation as same_generation,b.ownership_mode from private.provider_request_attempts a join private.provider_request_groups g on g.id=a.group_id cross join private.provider_budget_state b where a.group_id=any(${sql.array(groups.map(group => group.id))}::bigint[])`;
    throw new Error(`All 100 rooms must consume their five shared absolute score observations: ${JSON.stringify({ progress, ownership, acceptanceFailures, providerFailures })}`);
  }
  const [events] = await sql`select count(*)::integer as count from public.gameplay_events where session_id=any(${sql.array(roomIds)}::uuid[]) and actor_kind='provider' and actor_participant_id is null and event_type='provider_score_changed'`;
  assert(events.count === 500, 'One snapshot event per room match is required, without duplicate or fabricated participant attribution');
  const warmStart = performance.now();
  await Promise.all(Array.from({ length: 100 }, async (_, index) => {
    const catalog = catalogs[index % 2];
    const discovered = await catalog.discoverMatches(selection);
    const saved = await observeSavedRead(catalog, catalogIds);
    assert(discovered.availability === 'available' && discovered.matches.length === 5 && saved.matches.length === 5, 'Fresh shared reads must remain available');
    if (index < 90) await admitSolo(index);
  }));
  await catalogs[0].discoverMatches({ leagueCodes: [], date });
  await observeSavedRead(catalogs[0], []);
  const [after] = await sql`select count(*)::integer as count from private.provider_request_attempts where group_id=any(${sql.array(groups.map(group => group.id))}::bigint[])`;
  assert(after.count === 5 && [...httpCounts.values()].reduce((sum, count) => sum + count, 0) === 5, 'Fresh consumers, saved reads and manual-only selection must add zero provider attempts');
  assert(escapedRequests === 0, 'No request may escape the local controlled adapter');
  const [grants] = await sql`select count(*)::integer as count from private.solo_tracking_grants where signing_key_id=${signingKeyId}`;
  assert(grants.count === 100, 'Expected 100 independent finite solo grants sharing the same five match facts');
  const [admissions] = await sql`select coalesce(sum(admitted_count),0)::integer as count from private.provider_admission_counters where counter_kind='solo_creation' and scope_key='global' and window_start>=date_trunc('minute',${startedAt}::timestamptz-interval '1 hour')`;
  assert(admissions.count === 100, 'The identical creation retry must add no extra admission');
  result = { ok: true, rooms: 100, selectedRoomMatches: 500, sharedMatches: 5, coldReservations: coldAttempts.count, controlledHttpRequests: coldHttp, warmConsumers: 100, soloGrants: grants.count, creationCalls: 101, creationAdmissions: admissions.count, concurrentCreation, extraWarmAttempts: after.count - coldAttempts.count, providerEvents: events.count, replayContinuations: continuations, coldMs: Math.round(coldMs), warmMs: Math.round(performance.now() - warmStart), escapedRequests };
  }
} catch (error) { failure = error; }
finally {
  try { if (server) await server.shutdown(); await cleanup(); if (roleCreated) await sql`drop role ${sql(role)}`; }
  catch (error) { failure ??= error; }
  clearInterval(memorySampler);
  await sql.end({ timeout: 2 });
}
const cpu = process.cpuUsage(cpuStarted);
const rssFinished = process.memoryUsage().rss;
if (result) result = { ...result, localResources: { scope: 'Deno harness process after profile guard through fixture cleanup; excludes imports/startup and PostgreSQL/Edge processes', cpuUserMs: Math.round(cpu.user / 1000), cpuSystemMs: Math.round(cpu.system / 1000), rssStartBytes: rssStarted, rssEndBytes: rssFinished, sampledPeakRssBytes: Math.max(sampledPeakRss, rssFinished), rssSamplingIntervalMs: 100 }, payloads: { controlledSourceResponseBytes: sourceResponsePayloadBytes, savedResultSerializedBytes, savedReadResponses, excludes: 'headers, TLS/TCP overhead, discovery responses, Realtime and hosted egress' } };
if (failure) console.error(JSON.stringify({ ok: false, code: failure.code ?? failure.name, table: failure.table_name, constraint: failure.constraint_name, message: failure.code ? 'Local database check failed; inspect the scoped fixture/schema contract' : failure.message }));
else console.log(JSON.stringify(result));
// Close only this script's adapter pools; fixture cleanup above has already committed.
Deno.exit(failure ? 1 : 0);
