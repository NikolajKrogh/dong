/* global Deno */
// Local backend sizing, not an app/E2E test. Deno's allow-net must remain loopback-only.
// DENO_DIR=.supabase/deno-cache npx deno@2.9.6 run --cached-only --node-modules-dir=none --allow-env --allow-read=.supabase/feature030/supabase/config.toml,supabase/tests/fixtures/match_catalog_measurements.sql.inc --allow-write=specs/030-reduce-espn-requests/validation --allow-net=127.0.0.1 scripts/measure-match-catalog-storage.mjs
// eslint-disable-next-line import/no-unresolved -- Deno resolves the same pinned owned adapter dependency.
import postgres from 'npm:postgres@3.4.9';

function assert(condition, message) { if (!condition) throw new Error(message); }
const root = new URL('../', import.meta.url);
const address = new URL(Deno.env.get('MATCH_CATALOG_TEST_DATABASE_URL') ?? 'postgres://postgres:postgres@127.0.0.1:58322/postgres');
assert(address.protocol === 'postgres:' && address.hostname === '127.0.0.1' && address.port === '58322' && address.pathname === '/postgres' && !address.search && !address.hash, 'Refusing a database outside disposable feature030');
const profile = await Deno.readTextFile(new URL('.supabase/feature030/supabase/config.toml', root));
assert(/project_id\s*=\s*"dong-feature030"/.test(profile) && /port\s*=\s*58322\b/.test(profile), 'Disposable profile guard failed');
const sql = postgres(address.toString(), { prepare: false, max: 1, connect_timeout: 5 });
const marker = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const rollback = new Error('measurement_complete_rollback');
const ownedPublic = ['matches','gameplay_events','gameplay_command_results','assignment_snapshots'];
const fanoutPublic = ['game_sessions','participants','assignments'];
const fixedAllowance = { featureTargetBytes: 100_000_000, optionalStopBytes: 80_000_000, newDemandStopBytes: 90_000_000, databaseAllowanceBytes: 500_000_000, reservedDatabaseHeadroomBytes: 50_000_000 };
let report;

async function sizes(database) {
  const relations = await database`
    select ns.nspname as schema,c.relname as relation,c.relkind::text as kind,
      pg_relation_size(c.oid)::text as heap_bytes,pg_table_size(c.oid)::text as table_bytes,
      pg_indexes_size(c.oid)::text as index_bytes,pg_total_relation_size(c.oid)::text as total_bytes,
      case when ns.nspname='private' or c.relname=any(${database.array(ownedPublic)}::text[]) then 'catalog_policy'
        when ns.nspname='cron' then 'scheduler' else 'other_room_fanout' end as attribution
    from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where (ns.nspname='private' and c.relkind in ('r','S') and (c.relname like 'provider_%' or c.relname like 'solo_%'))
      or (ns.nspname='public' and c.relkind='r' and c.relname=any(${database.array([...ownedPublic,...fanoutPublic])}::text[]))
      or (ns.nspname='cron' and c.relkind='r' and c.relname='job_run_details')
    order by ns.nspname,c.relname`;
  const [whole] = await database`select pg_database_size(current_database())::text as bytes`;
  const [scheduler] = await database`select count(*)::integer as total_rows,count(*) filter(where jobid=(select jobid from cron.job where jobname='match-catalog-monitor'))::integer as owned_rows from cron.job_run_details`;
  return { databaseBytes: Number(whole.bytes), scheduler, relations: relations.map(row => ({ schema: row.schema, relation: row.relation, kind: row.kind, attribution: row.attribution, heapBytes: Number(row.heap_bytes), tableBytes: Number(row.table_bytes), indexBytes: Number(row.index_bytes), totalBytes: Number(row.total_bytes) })) };
}
function difference(before, after) {
  return after.relations.map(row => {
    const old = before.relations.find(candidate => candidate.schema === row.schema && candidate.relation === row.relation);
    return { ...row, allocatedDeltaBytes: row.totalBytes - (old?.totalBytes ?? 0), indexDeltaBytes: row.indexBytes - (old?.indexBytes ?? 0) };
  });
}
async function logical(database) {
  // Conditions name only fixed fixture relations. No arbitrary query/table input is accepted.
  const samples = [
    ['provider_matches','private.provider_matches r join measurement_sources s on s.id=r.id'],
    ['provider_match_observations','private.provider_match_observations r join measurement_sources s on s.id=r.match_id'],
    ['provider_match_rosters','private.provider_match_rosters r join measurement_sources s on s.id=r.match_id'],
    ['provider_match_team_stats','private.provider_match_team_stats r join measurement_sources s on s.id=r.match_id'],
    ['provider_match_goals','private.provider_match_goals r join measurement_sources s on s.id=r.match_id'],
    ['provider_goal_participants','private.provider_goal_participants r join private.provider_match_goals g on g.id=r.goal_id join measurement_sources s on s.id=g.match_id'],
    ['provider_goal_revisions','private.provider_goal_revisions r join private.provider_match_goals g on g.id=r.goal_id join measurement_sources s on s.id=g.match_id'],
    ['provider_teams','private.provider_teams r join measurement_teams t on t.id=r.id'],
    ['provider_athletes','private.provider_athletes r join measurement_athletes a on a.id=r.id'],
    ['room_matches','public.matches r join measurement_rooms m on m.id=r.session_id'],
    ['game_sessions','public.game_sessions r join measurement_rooms m on m.id=r.id'],
    ['participants','public.participants r join measurement_rooms m on m.id=r.session_id'],
    ['assignments','public.assignments r join measurement_rooms m on m.id=r.session_id'],
    ['assignment_snapshots','public.assignment_snapshots r join measurement_rooms m on m.id=r.session_id'],
    ['gameplay_events','public.gameplay_events r join measurement_rooms m on m.id=r.session_id'],
    ['owned_cron_runs','cron.job_run_details r join cron.job j on j.jobid=r.jobid where j.jobname=\'match-catalog-monitor\' and r.runid between -1001000 and -1000001'],
  ];
  return await Promise.all(samples.map(async ([relation, from]) => {
    const [row] = await database.unsafe(`select count(*)::integer as rows,coalesce(sum(pg_column_size(r)),0)::text as bytes from ${from}`);
    return { relation, rows: row.rows, logicalTupleBytes: Number(row.bytes), meanLogicalTupleBytes: row.rows ? Number(row.bytes) / row.rows : 0 };
  }));
}
async function plans(database) {
  const [probe] = await database`select s.id::text,s.league_id::text,s.source_event_id,m.kickoff_at from measurement_sources s join private.provider_matches m on m.id=s.id where s.n=500`;
  const [fanout] = await database`select id::text from measurement_sources where n=1`;
  const [athlete] = await database`select id::text from measurement_athletes where n=501`;
  const queries = [
    ['match_identity', 'select id,lifecycle,home_score,away_score from private.provider_matches where league_id=$1 and source_event_id=$2', [probe.league_id,probe.source_event_id]],
    ['athlete_participation', 'select m.id,m.kickoff_at,r.side,r.is_starter,r.did_play,r.minutes_played from private.provider_match_rosters r join private.provider_matches m on m.id=r.match_id where r.athlete_id=$1 and r.did_play is distinct from false order by m.kickoff_at desc limit 20', [athlete.id]],
    ['league_day', 'select id,kickoff_at,home_name,away_name from private.provider_matches where league_id=$1 and kickoff_at>=$2::timestamptz and kickoff_at<$2::timestamptz+interval \'1 day\' order by kickoff_at,id limit 100', [probe.league_id,new Date(probe.kickoff_at).toISOString().slice(0,10)]],
    ['goal_timeline', 'select g.id,g.side,g.clock,g.kind,g.is_retracted,a.display_name,p.role from private.provider_match_goals g left join private.provider_goal_participants p on p.goal_id=g.id left join private.provider_athletes a on a.id=p.athlete_id where g.match_id=$1 order by g.display_order,g.id limit 100', [probe.id]],
    ['shared_room_fanout', 'select m.id,m.session_id,m.last_applied_observation_version from public.matches m join public.game_sessions room on room.id=m.session_id where m.catalog_match_id=$1 and room.state=\'in_progress\'', [fanout.id]],
  ];
  return await Promise.all(queries.map(async ([name, query, parameters]) => {
    const [row] = await database.unsafe(`explain (analyze,buffers,format json) ${query}`,parameters);
    return { name, statement: query, plan: row['QUERY PLAN'][0] };
  }));
}

try {
  const [schema] = await sql`select to_regclass('private.provider_match_rosters') is not null and to_regprocedure('private.measure_catalog_capacity()') is not null as ready`;
  assert(schema.ready, 'M5 must be applied to the disposable database before measurement');
  const before = await sizes(sql);
  try {
    await sql.begin(async transaction => {
      await transaction`set local statement_timeout='60s'`;
      await transaction`select set_config('match_catalog.measurement_marker',${marker},true)`;
      await transaction.unsafe(await Deno.readTextFile(new URL('supabase/tests/fixtures/match_catalog_measurements.sql.inc',root)));
      await transaction.unsafe('analyze private.provider_matches,private.provider_match_observations,private.provider_match_rosters,private.provider_match_team_stats,private.provider_match_goals,private.provider_goal_participants,private.provider_goal_revisions,private.provider_teams,private.provider_athletes,public.matches,public.game_sessions,public.participants,public.assignments,public.gameplay_events,cron.job_run_details');
      const after = await sizes(transaction);
      const relations = difference(before,after);
      const tuples = await logical(transaction);
      assert(tuples.find(row => row.relation==='provider_matches')?.rows===1000, 'Expected1000 shared matches');
      assert(tuples.find(row => row.relation==='provider_match_rosters')?.rows===40000, 'Expected40 roster entries per match');
      assert(tuples.find(row => row.relation==='gameplay_events')?.rows===500, 'Expected one first-score snapshot per room/match');
      const [participation] = await transaction`select count(*) filter(where r.did_play is true)::integer as played,count(*) filter(where r.did_play is false)::integer as unused,count(*) filter(where r.did_play is null)::integer as unknown,count(*) filter(where r.athlete_id is null)::integer as unknown_identity,count(*) filter(where r.minutes_played is null)::integer as unknown_minutes from private.provider_match_rosters r join measurement_sources s on s.id=r.match_id`;
      const [capacity] = await transaction`select private.measure_catalog_capacity() as result`;
      const privateDelta = relations.filter(row=>row.schema==='private').reduce((total,row)=>total+row.allocatedDeltaBytes,0);
      const roomDelta = relations.filter(row=>row.schema==='public').reduce((total,row)=>total+row.allocatedDeltaBytes,0);
      const cronDelta = relations.find(row=>row.schema==='cron')?.allocatedDeltaBytes ?? 0;
      const estimatedSevenDayCronBytes = Math.ceil(cronDelta/1000*7*24*60*4);
      report = {
        ok: true, measuredAt: new Date().toISOString(), environment: { project: 'dong-feature030', host: '127.0.0.1', port: 58322, database: 'postgres' },
        workload: { uniqueMatches: 1000, teams: 100, sharedAthletes: 2000, rosterRows: 40000, goals: 6000, goalCorrections: 600, teamStatisticRows: 2000, meaningfulObservations: 10000, rooms: 100, participantsPerRoom: 1, selectedReferencesPerRoom: 5, selectedUniqueMatches: 5, providerSnapshotEvents: 500, ownedSchedulerSampleRows: 1000 },
        participation, allowance: fixedAllowance, before, after, relationAllocation: relations, logicalTuples: tuples,
        capacityPolicySample: capacity.result, queryPlans: await plans(transaction),
        forecasts: { bytesPerUniqueMatchIncludingSharedIdentities: privateDelta/1000, bytesPerFiveMatchOneParticipantRoom: roomDelta/100, bytesPerOwnedCronLog: cronDelta/1000, estimatedSevenDayOwnedCronBytes: estimatedSevenDayCronBytes,
          retainedUniqueMatchScenarios: [1000,2500,5000,10000].map(matches=>({ matches, projectedSharedBytes: Math.ceil(matches*privateDelta/1000), projectedBytesWith100SampleRoomsAndSevenDayCron: Math.ceil(matches*privateDelta/1000+roomDelta+estimatedSevenDayCronBytes) })),
          databaseHeadroomDuringSampleBytes: fixedAllowance.databaseAllowanceBytes-after.databaseBytes,
        },
        limits: ['Local inserted rows and indexes, not hosted capacity acceptance.','Physical allocation includes page/index slack and is baseline-dependent; pg_column_size is an actual row-datum measure, not allocation.','The forecast holds roster size, corrections and observations fixed; additional protected events/room participants increase growth.','One-participant rooms and first-score snapshot events do not represent every long-running game.','The finite1000-row Cron sample is scaled to40320 runs over seven days; real run text/status lengths can differ.','Rollback removes fixture rows; sequence advancement, WAL and allocated files are not transactional and are not claimed to shrink.','Disk/WAL limits are separate from pg_database_size and are not measured as hosted service usage.'],
      };
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  const [residue] = await sql`select (select count(*) from private.provider_matches where source_event_id like ${'measure-'+marker+'-%'})::integer as matches,(select count(*) from private.provider_athletes where source_athlete_id like ${'measure-'+marker+'-%'})::integer as athletes,(select count(*) from auth.users where email=${'measure-'+marker+'@test.local'})::integer as accounts,(select count(*) from cron.job_run_details where runid between -1001000 and -1000001)::integer as scheduler_rows`;
  assert(Object.values(residue).every(value=>value===0), 'Rollback fixture residue found');
  await sql.unsafe('analyze private.provider_matches,private.provider_match_observations,private.provider_match_rosters,private.provider_match_team_stats,private.provider_match_goals,private.provider_goal_participants,private.provider_goal_revisions,private.provider_teams,private.provider_athletes,public.matches,public.game_sessions,public.participants,public.assignments,public.gameplay_events,cron.job_run_details');
  report.cleanup = { transactionRolledBack: true, residue, afterRollback: await sizes(sql) };
  const destination = new URL('specs/030-reduce-espn-requests/validation/storage-measurements.json',root);
  await Deno.writeTextFile(destination,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ ok: true, matches: report.workload.uniqueMatches, allocatedSharedBytes: report.forecasts.bytesPerUniqueMatchIncludingSharedIdentities*1000, allocatedRoomBytes: report.forecasts.bytesPerFiveMatchOneParticipantRoom*100, databaseHeadroomDuringSampleBytes: report.forecasts.databaseHeadroomDuringSampleBytes, rollbackVerified: true, output: destination.pathname }));
} finally { await sql.end({ timeout: 5 }); }
