-- Operator controls are intentionally unavailable to every API/JWT and worker role.
alter table private.provider_budget_state add column legacy_fenced boolean not null default false;
alter table private.provider_request_daily_usage add column consumer_count bigint not null default 0 check(consumer_count>=0);
create function private.configure_catalog_limits(p_rolling_limit integer,p_daily_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_rolling_limit is null or p_rolling_limit not between 1 and 1000 or p_daily_limit is null or p_daily_limit not between 1 and 100000 then
    return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  update private.provider_budget_state set rolling_limit=p_rolling_limit,daily_limit=p_daily_limit,updated_at=clock_timestamp() where provider='espn';
  return jsonb_build_object('ok',true);
end;
$$;
create function private.set_catalog_ownership(p_mode text,p_expected_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; t timestamptz:=clock_timestamp();
begin
  select * into policy from private.provider_budget_state where provider='espn' for update;
  if p_mode is null or p_mode not in ('disabled','legacy','catalog','paused') then return jsonb_build_object('ok',false,'code','invalid_mode'); end if;
  if p_expected_generation is distinct from policy.worker_generation then return jsonb_build_object('ok',false,'code','stale_generation'); end if;
  if p_mode='catalog' and (policy.rolling_limit is null or policy.daily_limit is null) then return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  -- Once the maintained catalog owns acquisition, rollback pauses it rather than restoring obsolete owners.
  if policy.legacy_fenced and p_mode='legacy' then return jsonb_build_object('ok',false,'code','legacy_provider_disabled'); end if;
  update private.provider_budget_state set ownership_mode=p_mode,worker_generation=worker_generation+1,legacy_fenced=legacy_fenced or p_mode in ('catalog','paused'),updated_at=t where provider='espn' returning * into policy;
  update private.provider_request_attempts set outcome='uncertain',finished_at=t,error_code='ownership_changed' where outcome='reserved';
  update private.provider_request_groups set lease_token=null,lease_until=null,owner_generation=null where lease_token is not null;
  update private.provider_worker_slots set lease_token=null,lease_until=null,dispatch_started_at=null,outcome='ownership_changed' where lease_token is not null;
  delete from private.provider_score_refresh_leases;
  if p_mode in ('disabled','legacy') then perform cron.alter_job(jobid,active:=false) from cron.job where jobname='match-catalog-monitor'; end if;
  return jsonb_build_object('ok',true,'workerGeneration',policy.worker_generation,'mode',policy.ownership_mode);
end;
$$;

create function private.resume_catalog_group(p_group_id bigint,p_expected_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform 1 from private.provider_budget_state where provider='espn' and worker_generation=p_expected_generation for update;
  if not found then return jsonb_build_object('ok',false,'code','stale_generation'); end if;
  update private.provider_request_groups set paused=false,failure_count=0,last_error=null,next_attempt_at=greatest(clock_timestamp(),cooldown_until) where id=p_group_id;
  return jsonb_build_object('ok',found);
end;
$$;

create function private.record_catalog_attempt_outcome() returns trigger language plpgsql security definer set search_path='' as $$
declare safe_scope text;
begin
  if new.outcome=old.outcome then return null; end if;
  select left(league.league_code||'/'||g.resource_kind||'/'||coalesce(g.request_date::text,g.source_event_id),180) into safe_scope
  from private.provider_request_groups g join private.provider_leagues league on league.id=g.league_id where g.id=new.group_id;
  insert into private.provider_request_daily_usage(usage_day,provider,purpose,outcome,scope_label,attempt_count)
  values((new.reserved_at at time zone 'UTC')::date,'espn',new.purpose,new.outcome,coalesce(safe_scope,'retired'),1)
  on conflict(usage_day,provider,purpose,outcome,scope_label) do update set attempt_count=private.provider_request_daily_usage.attempt_count+1;
  return null;
end;
$$;
create trigger catalog_attempt_outcome after update of outcome on private.provider_request_attempts for each row execute function private.record_catalog_attempt_outcome();

create function private.catalog_operator_report() returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('mode',b.ownership_mode,'workerGeneration',b.worker_generation,'rollingLimit',b.rolling_limit,'dailyLimit',b.daily_limit,'usageDay',b.usage_day,'dailyCount',b.daily_count,
  'cooldownUntil',b.cooldown_until,'pauseReason',b.pause_reason,'featureBytes',b.feature_bytes,'databaseBytes',b.database_bytes,
  'optionalWorkAllowed',b.optional_work_allowed,'newDemandAllowed',b.new_demand_allowed,
  'attemptsLast24Hours',(select count(*) from private.provider_request_attempts where reserved_at>=statement_timestamp()-interval '24 hours'),
  'dailyUsage',(select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) from (
    select usage_day as "day",purpose,outcome,sum(attempt_count) as "attemptCount",sum(consumer_count) as "consumerCount" from private.provider_request_daily_usage
    where usage_day>=(statement_timestamp() at time zone 'UTC')::date-1 group by usage_day,purpose,outcome order by usage_day desc,purpose,outcome limit 100
  ) x),
  'groupUsageLast24Hours',(select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) from (
    select league.league_code as "leagueCode",g.resource_kind as "kind",g.request_date as "date",g.source_event_id as "sourceEventId",attempt.purpose,attempt.outcome,count(*) as "attemptCount"
    from private.provider_request_attempts attempt join private.provider_request_groups g on g.id=attempt.group_id join private.provider_leagues league on league.id=g.league_id
    where attempt.reserved_at>=statement_timestamp()-interval '24 hours'
    group by league.league_code,g.resource_kind,g.request_date,g.source_event_id,attempt.purpose,attempt.outcome order by max(attempt.reserved_at) desc limit 100
  ) x),
  'pendingRooms',jsonb_array_length(private.pending_catalog_rooms(null)),
  'activeSlots',(select count(*) from private.provider_worker_slots where lease_until>statement_timestamp()),
  'unresolvedRoomMatches',(select count(*) from public.matches where source_provider='espn' and catalog_match_id is null),
  'groups',(select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) from (
    select league.league_code as "leagueCode",g.request_date as "date",g.resource_kind as "kind",g.last_error as "error",g.paused,g.last_successful_check_at as "lastSuccessfulCheckAt",g.next_attempt_at as "nextAttemptAt"
    from private.provider_request_groups g join private.provider_leagues league on league.id=g.league_id where g.last_attempt_at>=statement_timestamp()-interval '24 hours' order by g.last_attempt_at desc limit 100
  ) x)) from private.provider_budget_state b where provider='espn';
$$;
revoke all on function private.configure_catalog_limits(integer,integer),private.set_catalog_ownership(text,bigint),private.resume_catalog_group(bigint,bigint),private.record_catalog_attempt_outcome(),private.catalog_operator_report() from public,anon,authenticated,service_role,match_catalog_backend;

create function private.recover_catalog_claims() returns void language plpgsql set search_path='' as $$
begin
  update private.provider_request_attempts attempt set outcome='uncertain',finished_at=clock_timestamp(),error_code='claim_expired'
  from private.provider_request_groups resource where attempt.group_id=resource.id and attempt.outcome='reserved'
    and (attempt.worker_generation<>(select worker_generation from private.provider_budget_state where provider='espn')
      or resource.current_attempt_id<>attempt.id or resource.lease_until is null or resource.lease_until<=clock_timestamp());
end;
$$;
revoke all on function private.recover_catalog_claims() from public,anon,authenticated,service_role,match_catalog_backend;

create function private.record_catalog_discovery_usage(p_result jsonb) returns void language plpgsql set search_path='' as $$
declare metric text; reason text; item jsonb; scope text;
begin
  for item in select value from jsonb_array_elements(p_result->'groups') loop
    metric:=case when item->>'availability' in ('available','partial') then 'cache_reuse' else 'deferred' end;
    reason:=case when metric='cache_reuse' then '' else coalesce(item->>'reason','acquisition_pending') end;
    scope:=left(concat_ws('/',item->>'leagueCode',item->>'date',reason),180);
    insert into private.provider_request_daily_usage(usage_day,provider,purpose,outcome,scope_label,attempt_count,consumer_count)
    values((clock_timestamp() at time zone 'UTC')::date,'espn','discovery',metric,scope,0,1)
    on conflict(usage_day,provider,purpose,outcome,scope_label) do update set consumer_count=private.provider_request_daily_usage.consumer_count+1;
  end loop;
end;
$$;
create function private.finish_match_discovery(p_league_codes text[],p_request_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=private.read_match_discovery(p_league_codes,p_request_date);
  perform private.record_catalog_discovery_usage(result);
  return result;
end;
$$;
revoke all on function private.record_catalog_discovery_usage(jsonb),private.finish_match_discovery(text[],date) from public,anon,authenticated,service_role;
grant execute on function private.finish_match_discovery(text[],date) to match_catalog_backend;



-- Permanent legacy fence after catalog ownership.
CREATE OR REPLACE FUNCTION private.claim_provider_score_refresh(p_session_id uuid, p_actor_account_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_sessions;
  v_actor_participant_id uuid;
  v_lease private.provider_score_refresh_leases;
  v_now timestamptz := clock_timestamp();
  v_not_before timestamptz;
BEGIN
  IF (SELECT legacy_fenced FROM private.provider_budget_state WHERE provider='espn') THEN RAISE EXCEPTION 'legacy_provider_disabled'; END IF;
  IF p_session_id IS NULL OR p_actor_account_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid_provider_refresh';
  END IF;

  SELECT gs.* INTO v_room
  FROM public.game_sessions gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  v_actor_participant_id := private.require_registered_participant_for_account(
    p_session_id, p_actor_account_id
  );
  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT lease.* INTO v_lease
  FROM private.provider_score_refresh_leases lease
  WHERE lease.session_id = p_session_id
  FOR UPDATE;

  IF FOUND AND v_lease.not_before > v_now THEN
    RETURN jsonb_build_object(
      'status', 'not_due',
      'sessionId', p_session_id::text,
      'requestId', p_request_id::text,
      'notBefore', v_lease.not_before,
      'matches', '[]'::jsonb
    );
  END IF;

  v_not_before := v_now + interval '60 seconds';
  INSERT INTO private.provider_score_refresh_leases(session_id, request_id, not_before)
  VALUES (p_session_id, p_request_id, v_not_before)
  ON CONFLICT (session_id) DO UPDATE
  SET request_id = EXCLUDED.request_id,
      not_before = EXCLUDED.not_before;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'sessionId', p_session_id::text,
    'requestId', p_request_id::text,
    'actorParticipantId', v_actor_participant_id::text,
    'notBefore', v_not_before,
    'matches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'matchId', m.id::text,
        'provider', lower(m.source_provider),
        'sourceMatchId', m.source_match_id,
        'sourceLeagueCode', m.source_league_code,
        'kickoffAt', m.kickoff_at
      ) ORDER BY m.created_at, m.id)
      FROM public.matches m
      WHERE m.session_id = p_session_id
        AND lower(m.source_provider) <> 'manual'
        AND m.source_match_id IS NOT NULL
        AND m.kickoff_at IS NOT NULL
    ), '[]'::jsonb)
  );
END;
$function$;
CREATE OR REPLACE FUNCTION private.accept_provider_score_for_actor(p_session_id uuid, p_actor_participant_id uuid, p_match_id uuid, p_provider text, p_source_match_id text, p_home_score integer, p_away_score integer, p_observed_at timestamp with time zone, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare room public.game_sessions%rowtype; room_match public.matches%rowtype; fingerprint text; replay jsonb; response jsonb;
begin
  IF (SELECT legacy_fenced FROM private.provider_budget_state WHERE provider='espn') THEN RAISE EXCEPTION 'legacy_provider_disabled'; END IF;
  if p_session_id is null or p_actor_participant_id is null or p_match_id is null or p_idempotency_key is null
    or nullif(btrim(coalesce(p_provider,'')),'') is null or nullif(btrim(coalesce(p_source_match_id,'')),'') is null
    or p_home_score is null or p_away_score is null or p_home_score<0 or p_away_score<0 then raise exception 'invalid_provider_score'; end if;
  select * into room from public.game_sessions where id=p_session_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if not exists(select 1 from public.participants where session_id=p_session_id and id=p_actor_participant_id and membership_type='registered'::public.participant_membership_type and left_at is null) then raise exception 'not_room_participant'; end if;
  fingerprint:=encode(extensions.digest(concat('provider:',p_match_id::text,':',p_provider,':',p_source_match_id,':',p_home_score::text,':',p_away_score::text),'sha256'),'hex');
  replay:=private.command_result_or_conflict(p_session_id,p_idempotency_key,'provider_score',p_actor_participant_id,fingerprint);
  if replay is not null then return replay; end if;
  if room.state<>'in_progress'::public.session_state then raise exception 'invalid_room_state'; end if;
  select * into room_match from public.matches where session_id=p_session_id and id=p_match_id for update;
  if not found then raise exception 'match_not_in_room'; end if;
  if lower(room_match.source_provider)='manual' or room_match.source_provider<>p_provider or room_match.source_match_id is distinct from p_source_match_id then raise exception 'provider_match_mismatch'; end if;
  response:=private.apply_provider_score_consequences(p_session_id,p_match_id,p_home_score,p_away_score,p_observed_at,p_idempotency_key::text,fingerprint,p_actor_participant_id,null,null);
  insert into public.gameplay_command_results(session_id,idempotency_key,command_type,actor_participant_id,request_fingerprint,response)
  values(p_session_id,p_idempotency_key,'provider_score',p_actor_participant_id,fingerprint,response);
  return response;
end;
$function$;
CREATE OR REPLACE FUNCTION private.accept_provider_score_batch_from_edge(p_session_id uuid, p_actor_account_id uuid, p_request_id uuid, p_observations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_sessions;
  v_actor_participant_id uuid;
  v_lease private.provider_score_refresh_leases;
  v_observation jsonb;
  v_match public.matches;
  v_match_id uuid;
  v_source_match_id text;
  v_source_league_code text;
  v_home_score integer;
  v_away_score integer;
  v_match_key uuid;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF (SELECT legacy_fenced FROM private.provider_budget_state WHERE provider='espn') THEN RAISE EXCEPTION 'legacy_provider_disabled'; END IF;
  IF p_session_id IS NULL OR p_actor_account_id IS NULL OR p_request_id IS NULL
     OR p_observations IS NULL OR jsonb_typeof(p_observations) <> 'array'
     OR jsonb_array_length(p_observations) > 100 THEN
    RAISE EXCEPTION 'invalid_provider_refresh';
  END IF;

  SELECT gs.* INTO v_room
  FROM public.game_sessions gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  v_actor_participant_id := private.require_registered_participant_for_account(
    p_session_id, p_actor_account_id
  );
  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT lease.* INTO v_lease
  FROM private.provider_score_refresh_leases lease
  WHERE lease.session_id = p_session_id
  FOR UPDATE;
  IF NOT FOUND OR v_lease.request_id <> p_request_id THEN
    RAISE EXCEPTION 'stale_provider_refresh';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_observations) observation
    GROUP BY observation->>'matchId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_provider_observation';
  END IF;

  FOR v_observation IN SELECT * FROM jsonb_array_elements(p_observations) LOOP
    BEGIN
      v_match_id := (v_observation->>'matchId')::uuid;
      v_home_score := (v_observation->>'homeScore')::integer;
      v_away_score := (v_observation->>'awayScore')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_provider_score';
    END;

    v_source_match_id := nullif(btrim(coalesce(v_observation->>'sourceMatchId', '')), '');
    v_source_league_code := nullif(btrim(coalesce(v_observation->>'sourceLeagueCode', '')), '');

    IF v_match_id IS NULL OR v_source_match_id IS NULL
       OR v_source_league_code IS NULL
       OR v_home_score IS NULL OR v_away_score IS NULL
       OR v_home_score < 0 OR v_away_score < 0 THEN
      RAISE EXCEPTION 'invalid_provider_score';
    END IF;

    SELECT m.* INTO v_match
    FROM public.matches m
    WHERE m.session_id = p_session_id AND m.id = v_match_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'match_not_in_room'; END IF;
    IF lower(v_match.source_provider) <> 'espn'
       OR v_match.source_match_id IS DISTINCT FROM v_source_match_id
       OR (v_match.source_league_code IS NOT NULL
           AND v_match.source_league_code IS DISTINCT FROM v_source_league_code) THEN
      RAISE EXCEPTION 'provider_match_mismatch';
    END IF;

    IF v_match.source_league_code IS NULL AND v_source_league_code IS NOT NULL THEN
      UPDATE public.matches
      SET source_league_code = v_source_league_code
      WHERE id = v_match_id;
    END IF;

    -- md5 is used only to deterministically fit request+match identity into the
    -- existing uuid idempotency column; it is not a security primitive.
    v_match_key := md5(p_request_id::text || ':' || v_match_id::text)::uuid;
    v_result := private.accept_provider_score_for_actor(
      p_session_id,
      v_actor_participant_id,
      v_match_id,
      'espn',
      v_source_match_id,
      v_home_score,
      v_away_score,
      clock_timestamp(),
      v_match_key
    );
    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  RETURN jsonb_build_object(
    'sessionId', p_session_id::text,
    'requestId', p_request_id::text,
    'refreshedAt', clock_timestamp(),
    'results', v_results
  );
END;
$function$;
CREATE OR REPLACE FUNCTION private.accept_provider_score_batch_checked_from_edge(p_session_id uuid, p_actor_account_id uuid, p_request_id uuid, p_observations jsonb, p_all_sources_checked boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_sessions;
  v_actor_participant_id uuid;
  v_lease private.provider_score_refresh_leases;
  v_response jsonb;
BEGIN
  IF (SELECT legacy_fenced FROM private.provider_budget_state WHERE provider='espn') THEN RAISE EXCEPTION 'legacy_provider_disabled'; END IF;
  IF p_session_id IS NULL OR p_actor_account_id IS NULL OR p_request_id IS NULL
     OR p_observations IS NULL OR jsonb_typeof(p_observations) <> 'array'
     OR jsonb_array_length(p_observations) > 100 THEN
    RAISE EXCEPTION 'invalid_provider_refresh';
  END IF;

  SELECT gs.* INTO v_room
  FROM public.game_sessions gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  v_actor_participant_id := private.require_registered_participant_for_account(
    p_session_id, p_actor_account_id
  );
  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT lease.* INTO v_lease
  FROM private.provider_score_refresh_leases lease
  WHERE lease.session_id = p_session_id
  FOR UPDATE;
  IF NOT FOUND OR v_lease.request_id <> p_request_id THEN
    RAISE EXCEPTION 'stale_provider_refresh';
  END IF;

  IF v_lease.completed_request_id = p_request_id THEN
    RETURN v_lease.completed_response;
  END IF;

  -- Reuse the existing provenance checks, score acceptance and event history.
  v_response := private.accept_provider_score_batch_from_edge(
    p_session_id, p_actor_account_id, p_request_id, p_observations
  );

  IF p_all_sources_checked AND jsonb_array_length(p_observations) > 0 THEN
    UPDATE public.game_sessions SET last_scores_checked_at = clock_timestamp() WHERE id = p_session_id;
  END IF;
  v_response := v_response || jsonb_build_object(
    'refreshedAt', (SELECT last_scores_checked_at FROM public.game_sessions WHERE id = p_session_id)
  );
  UPDATE private.provider_score_refresh_leases
  SET completed_request_id = p_request_id, completed_response = v_response
  WHERE session_id = p_session_id;
  RETURN v_response;
END;
$function$;
create or replace function private.fail_provider_request(p_attempt_id bigint,p_lease_token uuid,p_generation bigint,p_code text,p_http_status integer,p_retry_after_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b private.provider_budget_state%rowtype; a private.provider_request_attempts%rowtype; g private.provider_request_groups%rowtype; t timestamptz:=clock_timestamp(); next_time timestamptz; seconds integer;
begin
  if p_code is null or p_code not in ('provider_timeout','provider_unavailable','provider_throttled','provider_access_rejected','provider_response_too_large','invalid_provider_response','match_not_found')
    or p_retry_after_seconds<0 or p_http_status<100 or p_http_status>599 then return jsonb_build_object('ok',false,'code','invalid_failure'); end if;
  select * into b from private.provider_budget_state where provider='espn' for update;
  select * into a from private.provider_request_attempts where id=p_attempt_id;
  if not found then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  select * into g from private.provider_request_groups where id=a.group_id for update;
  t:=clock_timestamp();
  if b.worker_generation is distinct from p_generation or a.worker_generation is distinct from p_generation or a.lease_token is distinct from p_lease_token or p_lease_token is null then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  if a.outcome<>'reserved' then return jsonb_build_object('ok',true,'isReplay',true); end if;
  if b.ownership_mode<>'catalog' or g.lease_token is distinct from p_lease_token or g.owner_generation is distinct from p_generation or g.lease_until is null or g.lease_until<=t then return jsonb_build_object('ok',false,'code','stale_claim'); end if;
  seconds:=least(900,60*power(2,least(g.failure_count,4))::integer)+floor(random()*15)::integer;
  if p_code in ('match_not_found','invalid_provider_response','provider_response_too_large') then seconds:=greatest(seconds,900); end if;
  next_time:=greatest(t+make_interval(secs=>seconds),t+make_interval(secs=>coalesce(p_retry_after_seconds,0)));
  update private.provider_request_attempts set outcome='failed',error_code=p_code,http_status=p_http_status,finished_at=t where id=a.id;
  update private.provider_request_groups set failure_count=failure_count+1,last_error=p_code,cooldown_until=next_time,next_attempt_at=greatest(next_attempt_at,next_time),
    paused=p_code='provider_access_rejected',lease_token=null,lease_until=null,owner_generation=null where id=g.id;
  if g.resource_kind='scoreboard' then update private.provider_matches set availability='partial',availability_reason=p_code,condition_started_at=case when p_code='match_not_found' then coalesce(condition_started_at,t) else condition_started_at end where scoreboard_group_id=g.id; end if;
  if p_code='provider_throttled' then update private.provider_budget_state set cooldown_until=greatest(cooldown_until,next_time),updated_at=t where provider='espn'; end if;
  return jsonb_build_object('ok',true,'retryAfterSeconds',ceil(extract(epoch from next_time-t))::integer,'scope',case when p_code='provider_throttled' then 'provider' else 'group' end);
end;
$$;
create or replace function private.claim_provider_batch(p_group_ids bigint[],p_purpose text,p_worker_token uuid,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; slot private.provider_worker_slots%rowtype; group_id bigint; claim jsonb; claims jsonb:='[]'::jsonb; used integer; t timestamptz:=clock_timestamp(); actual_purpose text;
begin
  if p_group_ids is null or cardinality(p_group_ids)>16 or p_purpose is null or p_purpose not in ('live','discovery','completion') then return jsonb_build_object('ok',false,'code','invalid_work_batch','claims',claims); end if;
  select * into policy from private.provider_budget_state where provider='espn' for update;
  perform private.recover_catalog_claims();
  t:=clock_timestamp();
  select * into slot from private.provider_worker_slots where lease_token=p_worker_token and worker_generation=p_generation and lease_until>t and started_at is not null for update;
  if not found then return jsonb_build_object('ok',false,'code','invalid_dispatch','claims',claims); end if;
  if slot.last_acquisition_token=p_worker_token then return jsonb_build_object('ok',true,'claims',claims); end if;
  update private.provider_worker_slots set last_acquisition_token=p_worker_token where id=slot.id;
  select count(*) into used from private.provider_request_attempts where worker_slot_id=slot.id and worker_generation=p_generation and reserved_at>=slot.started_at;
  if used>=4 then return jsonb_build_object('ok',true,'claims',claims); end if;
  for group_id in select g.id from private.provider_request_groups g where g.id=any(p_group_ids)
    order by case when g.live_due_at<=t then 0 else 1 end,g.next_attempt_at,g.id loop
    select case when live_due_at<=t then 'live' when discovery_until>t then 'discovery' when completion_due_at<=t then 'completion' else p_purpose end
      into actual_purpose from private.provider_request_groups where id=group_id;
    claim:=private.claim_provider_request(group_id,actual_purpose,p_worker_token,p_generation);
    if claim->>'ok'='true' then claims:=claims||jsonb_build_array(claim); used:=used+1; end if;
    exit when used>=4;
  end loop;
  return jsonb_build_object('ok',true,'claims',claims);
end;
$$;
create or replace function private.prepare_match_discovery(p_league_codes text[],p_request_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; codes text[]; ids bigint[]; work_ids jsonb; t timestamptz:=clock_timestamp(); can_admit_source boolean; recent_attempts integer;
begin
  if p_league_codes is null or cardinality(p_league_codes)>128 or p_request_date is null or exists(select 1 from unnest(p_league_codes) x where x is null) then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  if p_request_date not between (t at time zone 'UTC')::date-7 and (t at time zone 'UTC')::date+7 then return jsonb_build_object('ok',false,'code','date_out_of_range'); end if;
  select coalesce(array_agg(distinct btrim(x) order by btrim(x)),'{}'::text[]) into codes from unnest(p_league_codes) x where btrim(x)<>'';
  if cardinality(codes)>16 then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  if exists(select 1 from unnest(codes) x where not exists(select 1 from private.provider_leagues where provider='espn' and league_code=x)) then return jsonb_build_object('ok',false,'code','unsupported_league'); end if;
  select * into policy from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  select count(*) into recent_attempts from private.provider_request_attempts where reserved_at>t-interval '60 seconds';
  can_admit_source:=policy.ownership_mode='catalog' and policy.rolling_limit is not null and policy.daily_limit is not null
    and policy.pause_reason is null and (policy.cooldown_until is null or policy.cooldown_until<=t) and recent_attempts<policy.rolling_limit
    and (policy.usage_day<>(t at time zone 'UTC')::date or policy.daily_count<policy.daily_limit);
  if can_admit_source and policy.new_demand_allowed then
    insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,next_attempt_at)
    select 'espn',id,'scoreboard',p_request_date,t from private.provider_leagues where provider='espn' and league_code=any(codes) on conflict(provider,scope_key) do nothing;
  end if;
  select coalesce(array_agg(g.id),'{}'::bigint[]) into ids from private.provider_request_groups g join private.provider_leagues league on league.id=g.league_id
  where league.provider='espn' and league.league_code=any(codes) and g.resource_kind='scoreboard' and g.request_date=p_request_date;
  perform private.refresh_catalog_group_due(ids);
  if can_admit_source and policy.new_demand_allowed then
    update private.provider_request_groups set discovery_until=case when discovery_until>t then discovery_until else t+interval '2 minutes' end,last_used_at=t
    where id=any(ids) and (last_successful_check_at is null or last_successful_check_at<t-interval '5 minutes') and not paused and (cooldown_until is null or cooldown_until<=t);
  end if;
  update private.provider_matches set last_used_at=t where scoreboard_group_id=any(ids);
  t:=clock_timestamp();
  select coalesce(jsonb_agg(id::text order by id),'[]'::jsonb) into work_ids from private.provider_request_groups
    where can_admit_source and id=any(ids) and not paused and (lease_until is null or lease_until<=t) and (cooldown_until is null or cooldown_until<=t) and next_attempt_at<=t
    and (live_due_at<=t or discovery_until>t and (last_successful_check_at is null or last_successful_check_at<t-interval '5 minutes'));
  return jsonb_build_object('ok',true,'workerGeneration',policy.worker_generation,'workGroupIds',work_ids,'selection',jsonb_build_object('leagueCodes',codes,'date',p_request_date),'result',case when jsonb_array_length(work_ids)=0 then private.finish_match_discovery(codes,p_request_date) else private.read_match_discovery(codes,p_request_date) end);
end;
$$;
