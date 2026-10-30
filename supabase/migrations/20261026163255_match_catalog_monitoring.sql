-- Dormant, additive monitoring. Operator provisioning/activation is separate.
-- Avoid firing managed extension hooks again for already-installed extensions.
do $$ begin
  if not exists (select 1 from pg_extension where extname='pg_net') then
    create extension pg_net with schema extensions;
  end if;
  if not exists (select 1 from pg_extension where extname='pg_cron') then
    create extension pg_cron with schema pg_catalog;
  end if;
end $$;
-- Managed pg_net objects are owned by supabase_admin. Their required PUBLIC ACLs
-- cannot be revoked by postgres; SQL REVOKE here would only produce warnings.
-- Keep net outside Data API schemas and audit/trust every database LOGIN before
-- activation: queued headers are readable by database logins, never app clients.
-- See specs/030-reduce-espn-requests/validation/pg-net-security.md.

alter table private.provider_worker_slots add column dispatch_started_at timestamptz;

create function private.begin_catalog_dispatch(p_token uuid,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare slot private.provider_worker_slots%rowtype; t timestamptz; ids jsonb;
begin
  select * into slot from private.provider_worker_slots where lease_token=p_token and worker_generation=p_generation for update;
  t:=clock_timestamp();
  if not found or p_token is null or slot.lease_until<=t or slot.dispatch_started_at is not null
    or p_generation is distinct from (select worker_generation from private.provider_budget_state where provider='espn') then return jsonb_build_object('ok',false,'code','invalid_dispatch'); end if;
  update private.provider_worker_slots set dispatch_started_at=t,last_progress_at=t where id=slot.id;
  select coalesce(jsonb_agg(id::text order by priority,next_attempt_at,id),'[]'::jsonb) into ids from (
    select id,next_attempt_at,case when live_due_at<=t then 0 when discovery_until>t then 1 else 2 end as priority
    from private.provider_request_groups where not paused and next_attempt_at<=t and (cooldown_until is null or cooldown_until<=t)
      and (lease_until is null or lease_until<=t) and (live_due_at<=t or discovery_until>t or completion_due_at<=t)
    order by priority,next_attempt_at,id limit 16
  ) due;
  return jsonb_build_object('ok',true,'groupIds',ids);
end;
$$;
revoke all on function private.begin_catalog_dispatch(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function private.begin_catalog_dispatch(uuid,bigint) to match_catalog_backend;

create function private.dispatch_catalog_work() returns jsonb
language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; ids bigint[]; groups_due integer; live_due integer; rooms_due integer; recent integer;
  work_count integer; dispatched integer:=0; slot jsonb; project_url text; api_key text; request_id bigint; t timestamptz;
begin
  select * into policy from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  if policy.ownership_mode not in ('catalog','paused') then return jsonb_build_object('dispatched',0); end if;
  select coalesce(array_agg(id),'{}'::bigint[]) into ids from private.provider_request_groups;
  perform private.refresh_catalog_group_due(ids);
  select jsonb_array_length(private.pending_catalog_rooms(null)) into rooms_due;
  select count(*) into recent from private.provider_request_attempts where reserved_at>t-interval '60 seconds';
  select count(*),count(*) filter(where live_due_at<=t) into groups_due,live_due from private.provider_request_groups
  where policy.ownership_mode='catalog' and policy.pause_reason is null and policy.rolling_limit is not null and policy.daily_limit is not null
    and recent<policy.rolling_limit and (policy.usage_day<>(t at time zone 'UTC')::date or policy.daily_count<policy.daily_limit)
    and (policy.cooldown_until is null or policy.cooldown_until<=t) and not paused and next_attempt_at<=t
    and (cooldown_until is null or cooldown_until<=t) and (lease_until is null or lease_until<=t)
    and (live_due_at<=t or discovery_until>t or completion_due_at<=t);
  work_count:=least(2,greatest(ceil(groups_due/4.0)::integer,ceil(rooms_due/100.0)::integer));
  if work_count=0 then return jsonb_build_object('dispatched',0); end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name='match_catalog_project_url';
  select decrypted_secret into api_key from vault.decrypted_secrets where name='match_catalog_monitor_key';
  if project_url is null or project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' or api_key is null or api_key not like 'sb_secret_%' then
    return jsonb_build_object('dispatched',0,'code','configuration_required');
  end if;
  for n in 1..work_count loop
    slot:=private.acquire_provider_worker_slot(case when live_due>0 then 'live' when groups_due>0 then 'discovery' else 'replay' end,policy.worker_generation);
    exit when slot->>'ok' is distinct from 'true';
    update private.provider_worker_slots set dispatch_started_at=null where lease_token=(slot->>'dispatchToken')::uuid;
    request_id:=net.http_post(url:=project_url||'/functions/v1/run-match-monitor',headers:=jsonb_build_object('Content-Type','application/json','apikey',api_key),
      body:=jsonb_build_object('dispatchToken',slot->>'dispatchToken','workerGeneration',policy.worker_generation),timeout_milliseconds:=45000);
    update private.provider_worker_slots set dispatch_request_id=request_id where lease_token=(slot->>'dispatchToken')::uuid;
    dispatched:=dispatched+1;
  end loop;
  return jsonb_build_object('dispatched',dispatched);
end;
$$;
revoke all on function private.dispatch_catalog_work() from public,anon,authenticated,service_role,match_catalog_backend;
do $$ declare job_id bigint; begin
  job_id:=cron.schedule('match-catalog-monitor','15 seconds','select private.dispatch_catalog_work();');
  perform cron.alter_job(job_id,active:=false);
end $$;

-- Current selected references are the demand ledger. Presence and auth expiry are irrelevant.
create function private.sync_catalog_room(p_session_id uuid) returns void
language plpgsql set search_path='' as $$
declare entry record; resolved_league_id bigint; group_id bigint; source_id bigint; groups bigint[]; effective_kickoff timestamptz;
begin
  perform 1 from private.provider_budget_state where provider='espn' for update;
  for entry in select * from public.matches where session_id=p_session_id and source_provider='espn' order by id loop
    select id into resolved_league_id from private.provider_leagues where provider='espn' and league_code=entry.source_league_code;
    if resolved_league_id is null or nullif(btrim(entry.source_match_id),'') is null then continue; end if;
    select id into source_id from private.provider_matches where league_id=resolved_league_id and source_event_id=entry.source_match_id;
    if source_id is null then
      -- Only verified room metadata is linked. This does not pretend a source score was observed.
      insert into private.provider_matches(league_id,source_event_id,home_name,away_name,kickoff_at,kickoff_validity)
      values(resolved_league_id,entry.source_match_id,entry.home_team_name,entry.away_team_name,entry.kickoff_at,case when entry.kickoff_at is null then 'unknown' else 'confirmed' end)
      on conflict(league_id,source_event_id) do nothing;
      select id into source_id from private.provider_matches where league_id=resolved_league_id and source_event_id=entry.source_match_id;
    end if;
    update public.matches set catalog_match_id=source_id where id=entry.id and catalog_match_id is distinct from source_id;
    select coalesce(kickoff_at,entry.kickoff_at) into effective_kickoff from private.provider_matches where id=source_id;
    if effective_kickoff is not null and not exists(select 1 from private.provider_matches m join private.provider_request_groups g on g.id=m.scoreboard_group_id where m.id=source_id and g.request_date=(effective_kickoff at time zone 'UTC')::date) then
      insert into private.provider_request_groups(provider,league_id,resource_kind,request_date)
      values('espn',resolved_league_id,'scoreboard',(effective_kickoff at time zone 'UTC')::date) on conflict(provider,scope_key) do nothing;
      select id into group_id from private.provider_request_groups where league_id=resolved_league_id and resource_kind='scoreboard' and request_date=(effective_kickoff at time zone 'UTC')::date;
      update private.provider_matches set scoreboard_group_id=group_id where id=source_id;
    end if;
  end loop;
  -- Inactive intervals are reconciled against latest once if selected again.
  update public.matches m set tracking_started_observation_version=null,last_applied_observation_version=null
  where m.session_id=p_session_id and (tracking_started_observation_version is not null or last_applied_observation_version is not null)
    and exists(select 1 from public.game_sessions room where room.id=p_session_id and room.state='in_progress'::public.session_state)
    and not exists(select 1 from private.active_catalog_room_matches active where active.room_match_id=m.id);
  select coalesce(array_agg(distinct source.scoreboard_group_id) filter(where source.scoreboard_group_id is not null),'{}'::bigint[]) into groups
    from public.matches m join private.provider_matches source on source.id=m.catalog_match_id where m.session_id=p_session_id;
  perform private.refresh_catalog_group_due(groups);
end;
$$;

create function private.catalog_room_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='game_sessions' then perform private.sync_catalog_room(new.id);
  else perform private.sync_catalog_room(coalesce(new.session_id,old.session_id)); end if;
  return null;
end;
$$;
create trigger catalog_match_link after insert or update of source_provider,source_match_id,source_league_code,kickoff_at on public.matches for each row execute function private.catalog_room_changed();
create trigger catalog_room_lifecycle after update of state,common_match_id on public.game_sessions for each row execute function private.catalog_room_changed();
create constraint trigger catalog_assignment_changed after insert or update or delete on public.assignments deferrable initially deferred for each row execute function private.catalog_room_changed();
create trigger catalog_participant_departure after update of left_at on public.participants for each row execute function private.catalog_room_changed();
revoke all on function private.sync_catalog_room(uuid),private.catalog_room_changed() from public,anon,authenticated,service_role,match_catalog_backend;

-- A fixed accepted cutoff is captured once under the room lock, without holding any source lock.
create function private.drain_catalog_room_cutoff(p_session_id uuid) returns boolean
language plpgsql set search_path='' as $$
declare cutoff jsonb; candidate record; processed integer:=0; response jsonb;
begin
  perform 1 from public.game_sessions where id=p_session_id for update;
  select coalesce(jsonb_agg(jsonb_build_object('roomMatchId',active.room_match_id,'version',source.observation_version)),'[]'::jsonb) into cutoff
  from private.active_catalog_room_matches active join private.provider_matches source on source.id=active.catalog_match_id where active.session_id=p_session_id;
  loop
    select m.id,case when m.tracking_started_observation_version is null then (x->>'version')::bigint else m.last_applied_observation_version+1 end as version
    into candidate from jsonb_array_elements(cutoff) x join public.matches m on m.id=(x->>'roomMatchId')::uuid
    where coalesce(m.last_applied_observation_version,0)<(x->>'version')::bigint order by m.id limit 1;
    if not found then return true; end if;
    if processed>=20 then return false; end if;
    response:=private.apply_saved_provider_observation(candidate.id,candidate.version);
    if response->>'ok' is distinct from 'true' then return false; end if;
    processed:=processed+1;
  end loop;
end;
$$;
revoke all on function private.drain_catalog_room_cutoff(uuid) from public,anon,authenticated,service_role,match_catalog_backend;

-- Link existing metadata without source HTTP, score changes or invented historical observations.
do $$ declare room_id uuid; begin
  for room_id in select distinct session_id from public.matches where source_provider='espn' loop perform private.sync_catalog_room(room_id); end loop;
end $$;





-- Drain accepted facts before existing authorized mutations.
CREATE OR REPLACE FUNCTION private.end_game_session(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant_id uuid;
  v_assignment_count integer;
  v_snapshot_count integer;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room
  FROM public.game_sessions AS gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id IS DISTINCT FROM v_account THEN RAISE EXCEPTION 'not_host'; END IF;

  IF v_room.state IN ('completed'::public.session_state, 'closed'::public.session_state) THEN
    RETURN jsonb_build_object('status', v_room.state::text, 'sessionId', p_session_id::text);
  END IF;

  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'game_not_in_progress';
  END IF;

  SELECT p.id INTO v_host_participant_id
  FROM public.participants AS p
  WHERE p.session_id = p_session_id
    AND p.account_id = v_account
    AND p.session_role = 'owner'::public.participant_session_role
  LIMIT 1;
  IF v_host_participant_id IS NULL THEN
    RAISE EXCEPTION 'host_participant_not_found';
  END IF;

  IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  SELECT count(*)::integer INTO v_assignment_count
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id;

  INSERT INTO public.assignment_snapshots (
    session_id, participant_id, match_id, captured_at, expected_assignment_count
  )
  SELECT a.session_id, a.participant_id, a.match_id, now(), v_assignment_count
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id;

  GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;
  IF v_snapshot_count <> v_assignment_count THEN
    RAISE EXCEPTION 'assignment_snapshot_incomplete';
  END IF;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    p_session_id,
    public.allocate_event_sequence(p_session_id),
    v_host_participant_id,
    'session_completed',
    concat('session-completed:', gen_random_uuid()::text),
    jsonb_build_object('endedBy', 'host'),
    now()
  );

  UPDATE public.participants
  SET guest_grant_expires_at = now(), guest_revocation_reason = 'room_ended'
  WHERE session_id = p_session_id
    AND membership_type = 'guest'::public.participant_membership_type
    AND left_at IS NULL
    AND guest_grant_expires_at > now();

  UPDATE public.game_sessions
  SET state = 'completed'::public.session_state, completed_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('status', 'completed', 'sessionId', p_session_id::text);
END;
$function$;
CREATE OR REPLACE FUNCTION private.leave_room_as_host(p_session_id uuid, p_successor_participant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant public.participants %ROWTYPE;
  v_eligible_count integer;
  v_successor public.participants %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  -- Widened from `<> 'joinable'`: a host must be able to step out of a running
  -- game, not only one still in the lobby. Terminal rooms have nothing to leave.
  IF v_room.state IN ('completed'::public.session_state, 'closed'::public.session_state) THEN
    RAISE EXCEPTION 'room_not_joinable';
  END IF;

  SELECT * INTO v_host_participant FROM public.participants p
  WHERE p.session_id = p_session_id AND p.account_id = v_account
    AND p.session_role = 'owner'::public.participant_session_role
  LIMIT 1;

  SELECT count(*) INTO v_eligible_count FROM public.participants p
  WHERE p.session_id = p_session_id
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND p.session_role = 'member'::public.participant_session_role
    AND p.account_id IS NOT NULL
    AND p.account_id <> v_account
    AND p.left_at IS NULL;

  IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  -- Resolve successor (explicit choice, auto, or none).
  IF p_successor_participant_id IS NOT NULL THEN
    SELECT * INTO v_successor FROM public.participants p
    WHERE p.id = p_successor_participant_id AND p.session_id = p_session_id
      AND p.membership_type = 'registered'::public.participant_membership_type
      AND p.session_role = 'member'::public.participant_session_role
      AND p.account_id IS NOT NULL AND p.account_id <> v_account AND p.left_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'successor_not_eligible'; END IF;
  ELSIF v_eligible_count = 0 THEN
    -- Close the room (US3). state-only update; owner participant remains as actor.
    UPDATE public.participants
    SET guest_grant_expires_at = now(), guest_revocation_reason = 'room_ended'
    WHERE session_id = p_session_id
      AND membership_type = 'guest'::public.participant_membership_type
      AND left_at IS NULL AND guest_grant_expires_at > now();
    UPDATE public.game_sessions SET state = 'closed'::public.session_state WHERE id = p_session_id;
    INSERT INTO public.gameplay_events (
      session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
    ) VALUES (
      p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant.id, 'room_closed',
      concat('room-closed:', gen_random_uuid()::text),
      jsonb_build_object('reason', 'host_left_no_successor'), now()
    );
    RETURN jsonb_build_object('status', 'closed', 'sessionId', p_session_id::text);
  ELSIF v_eligible_count = 1 THEN
    SELECT * INTO v_successor FROM public.participants p
    WHERE p.session_id = p_session_id
      AND p.membership_type = 'registered'::public.participant_membership_type
      AND p.session_role = 'member'::public.participant_session_role
      AND p.account_id IS NOT NULL AND p.account_id <> v_account AND p.left_at IS NULL
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'successor_required';
  END IF;

  -- Transfer: trigger demotes old owner → member and promotes successor → owner.
  UPDATE public.game_sessions SET owner_account_id = v_successor.account_id WHERE id = p_session_id;
  -- Soft-leave the departing host (now a member after the trigger demotion).
  UPDATE public.participants SET left_at = now() WHERE id = v_host_participant.id;

  -- Re-read the successor (now owner) for the response.
  SELECT * INTO v_successor FROM public.participants p WHERE p.id = v_successor.id;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_successor.id, 'host_transferred',
    concat('host-transferred:', gen_random_uuid()::text),
    jsonb_build_object('newHostParticipantId', v_successor.id::text,
                       'previousHostParticipantId', v_host_participant.id::text), now()
  );
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant.id, 'participant_left',
    concat('host-left:', gen_random_uuid()::text),
    jsonb_build_object('participantId', v_host_participant.id::text, 'wasHost', true), now()
  );

  RETURN jsonb_build_object(
    'status', 'transferred',
    'sessionId', p_session_id::text,
    'newHostParticipantId', v_successor.id::text,
    'newHostDisplayName', v_successor.display_name,
    'snapshot', private.build_guest_room_snapshot(p_session_id)
  );
END;
$function$;
CREATE OR REPLACE FUNCTION private.leave_room_as_guest(p_guest_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_hash text;
  v_session_id uuid;
  v_room public.game_sessions;
  v_guest public.participants;
  v_event_payload jsonb;
BEGIN
  IF btrim(coalesce(p_guest_token, '')) = '' OR length(p_guest_token) > 128 THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  v_hash := encode(extensions.digest(btrim(p_guest_token), 'sha256'), 'hex');
  SELECT p.session_id INTO v_session_id FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'status', 'already_invalid'); END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = v_session_id FOR UPDATE;
  IF NOT FOUND OR v_room.state = 'closed'::public.session_state THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  SELECT p.* INTO v_guest FROM public.participants p
  WHERE p.session_id = v_session_id
    AND p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
  FOR UPDATE;
  IF NOT FOUND OR v_guest.guest_grant_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  IF v_guest.left_at IS NOT NULL THEN
    -- A lost response can be retried with the same still-valid bearer. This
    -- returns only that guest's immutable departure result, never live room data.
    SELECT e.payload INTO v_event_payload FROM public.gameplay_events e
    WHERE e.session_id = v_session_id
      AND e.actor_participant_id = v_guest.id
      AND e.event_type = 'participant_left'
      AND e.payload ? 'historySnapshot'
    ORDER BY e.created_at DESC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'status', 'confirmed',
        'result', v_event_payload -> 'historySnapshot',
        'leftAt', v_event_payload ->> 'leftAt');
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;

  IF NOT private.drain_catalog_room_cutoff(v_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  IF v_room.state = 'completed'::public.session_state THEN
    UPDATE public.participants SET guest_grant_expires_at = now()
    WHERE id = v_guest.id;
    RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
  END IF;
  IF v_room.state NOT IN ('joinable'::public.session_state, 'in_progress'::public.session_state) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted');
  END IF;

  UPDATE public.participants SET left_at = now()
  WHERE id = v_guest.id AND left_at IS NULL;
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    v_session_id, public.allocate_event_sequence(v_session_id), v_guest.id,
    'participant_left', concat('guest-left:', v_guest.id::text),
    jsonb_build_object('participantId', v_guest.id::text,
                       'membershipType', 'guest'), now()
  ) RETURNING payload INTO v_event_payload;

  IF v_room.state = 'in_progress'::public.session_state THEN
    RETURN jsonb_build_object('ok', true, 'status', 'confirmed',
      'result', v_event_payload -> 'historySnapshot',
      'leftAt', v_event_payload ->> 'leftAt');
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
END;
$function$;
CREATE OR REPLACE FUNCTION private.leave_room_as_member(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions;
  v_participant public.participants;
  v_event_payload jsonb;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs
  WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left'); END IF;
  IF v_room.owner_account_id = v_account THEN RAISE EXCEPTION 'use_leave_room_as_host'; END IF;
  IF v_room.state NOT IN ('joinable'::public.session_state, 'in_progress'::public.session_state) THEN
    RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left');
  END IF;

  SELECT * INTO v_participant FROM public.participants p
  WHERE p.session_id = p_session_id AND p.account_id = v_account
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND p.left_at IS NULL
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left');
  END IF;

  IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  UPDATE public.participants SET left_at = now() WHERE id = v_participant.id;
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_participant.id,
    'participant_left', concat('member-left:', v_participant.id::text),
    jsonb_build_object('participantId', v_participant.id::text,
                       'membershipType', 'registered'), now()
  ) RETURNING payload INTO v_event_payload;

  IF v_room.state = 'in_progress'::public.session_state THEN
    RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left',
      'result', v_event_payload -> 'historySnapshot',
      'leftAt', v_event_payload ->> 'leftAt');
  END IF;
  RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left');
END;
$function$;
CREATE OR REPLACE FUNCTION private.reassign_participant_matches(p_session_id uuid, p_participant_id uuid, p_match_ids uuid[], p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant_ids uuid[];
  v_host_participant_id uuid;
  v_requested_match_ids uuid[];
  v_existing_payload jsonb;
  v_existing_event_type text;
  v_request_fingerprint text;
  v_current_count integer;
  v_sequence_number bigint;
  v_added_match_ids uuid[];
  v_removed_match_ids uuid[];
  v_response jsonb;
  v_event_payload jsonb;
BEGIN
  -- Authorization is deliberately before idempotency replay. A guessed key
  -- must never disclose a previous host response.
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_room
  FROM public.game_sessions AS gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  IF v_room.owner_account_id IS DISTINCT FROM v_account THEN
    RAISE EXCEPTION 'not_host';
  END IF;

  SELECT array_agg(p.id ORDER BY p.id)
  INTO v_host_participant_ids
  FROM public.participants AS p
  WHERE p.session_id = p_session_id
    AND p.account_id = v_account
    AND p.session_role = 'owner'::public.participant_session_role
    AND p.left_at IS NULL;

  IF cardinality(v_host_participant_ids) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'host_participant_not_found';
  END IF;
  v_host_participant_id := v_host_participant_ids[1];

  IF p_participant_id IS NULL
     OR p_match_ids IS NULL
     OR p_idempotency_key IS NULL
     OR EXISTS (
       SELECT 1
       FROM unnest(p_match_ids) AS input_match(match_id)
       WHERE input_match.match_id IS NULL
     ) THEN
    RAISE EXCEPTION 'invalid_reassignment_input';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT input_match.match_id ORDER BY input_match.match_id), ARRAY[]::uuid[])
  INTO v_requested_match_ids
  FROM unnest(p_match_ids) AS input_match(match_id);

  IF cardinality(v_requested_match_ids) IS DISTINCT FROM cardinality(p_match_ids) THEN
    RAISE EXCEPTION 'invalid_reassignment_input';
  END IF;

  v_request_fingerprint := encode(
    extensions.digest(
      concat(
        p_participant_id::text,
        ':',
        array_to_string(v_requested_match_ids, ',')
      ),
      'sha256'
    ),
    'hex'
  );

  -- Replays happen after authorization and structural input validation, but
  -- before room-state/target checks so a lost response can be retried after
  -- the game completes.
  SELECT e.payload, e.event_type
  INTO v_existing_payload, v_existing_event_type
  FROM public.gameplay_events AS e
  WHERE e.session_id = p_session_id
    AND e.idempotency_key = p_idempotency_key::text;

  IF FOUND THEN
    IF v_existing_event_type = 'assignment_reassigned'
       AND v_existing_payload ->> 'requestFingerprint' = v_request_fingerprint
       AND v_existing_payload ->> 'participantId' = p_participant_id::text
       AND v_existing_payload -> 'requestedMatchIds' = to_jsonb(v_requested_match_ids) THEN
      RETURN v_existing_payload;
    END IF;
    RAISE EXCEPTION 'idempotency_key_reused';
  END IF;

  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'game_not_in_progress';
  END IF;

  PERFORM 1
  FROM public.participants AS p
  WHERE p.session_id = p_session_id
    AND p.id = p_participant_id
    AND p.left_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_in_room';
  END IF;

  IF v_room.common_match_id IS NOT NULL
     AND v_room.common_match_id = ANY(v_requested_match_ids) THEN
    RAISE EXCEPTION 'cannot_reassign_common_match';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_requested_match_ids) AS input_match(match_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.matches AS m
      WHERE m.session_id = p_session_id
        AND m.id = input_match.match_id
    )
  ) THEN
    RAISE EXCEPTION 'match_not_in_room_pool';
  END IF;

  SELECT count(*)::integer
  INTO v_current_count
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id
    AND a.participant_id = p_participant_id
    AND (v_room.common_match_id IS NULL OR a.match_id <> v_room.common_match_id);

  IF cardinality(v_requested_match_ids) IS DISTINCT FROM v_current_count THEN
    RAISE EXCEPTION 'assignment_count_mismatch';
  END IF;

  IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  SELECT COALESCE(array_agg(a.match_id ORDER BY a.match_id), ARRAY[]::uuid[])
  INTO v_removed_match_ids
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id
    AND a.participant_id = p_participant_id
    AND (v_room.common_match_id IS NULL OR a.match_id <> v_room.common_match_id)
    AND NOT (a.match_id = ANY(v_requested_match_ids));

  SELECT COALESCE(array_agg(input_match.match_id ORDER BY input_match.match_id), ARRAY[]::uuid[])
  INTO v_added_match_ids
  FROM unnest(v_requested_match_ids) AS input_match(match_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.assignments AS a
    WHERE a.session_id = p_session_id
      AND a.participant_id = p_participant_id
      AND a.match_id = input_match.match_id
  );

  -- A no-op is a successful request but not a reassignment event. In
  -- particular, it must not make history claim that assignments changed.
  IF cardinality(v_added_match_ids) = 0 AND cardinality(v_removed_match_ids) = 0 THEN
    RETURN jsonb_build_object(
      'sessionId', p_session_id::text,
      'participantId', p_participant_id::text,
      'addedMatchIds', to_jsonb(v_added_match_ids),
      'removedMatchIds', to_jsonb(v_removed_match_ids),
      'matchIds', to_jsonb(v_requested_match_ids),
      'sequenceNumber', NULL,
      'requestFingerprint', v_request_fingerprint,
      'requestedMatchIds', to_jsonb(v_requested_match_ids)
    );
  END IF;

  BEGIN
    -- Keep the row delta and its event in one savepoint. If a caller outside
    -- this RPC races the idempotency unique index, the whole attempted write
    -- is rolled back before the winning event is replayed below.
    DELETE FROM public.assignments AS a
    WHERE a.session_id = p_session_id
      AND a.participant_id = p_participant_id
      AND a.match_id = ANY(v_removed_match_ids)
      AND (v_room.common_match_id IS NULL OR a.match_id <> v_room.common_match_id);

    INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
    SELECT p_session_id, p_participant_id, input_match.match_id, now()
    FROM unnest(v_added_match_ids) AS input_match(match_id);

    v_sequence_number := public.allocate_event_sequence(p_session_id);
    v_response := jsonb_build_object(
      'sessionId', p_session_id::text,
      'participantId', p_participant_id::text,
      'addedMatchIds', to_jsonb(v_added_match_ids),
      'removedMatchIds', to_jsonb(v_removed_match_ids),
      'matchIds', to_jsonb(v_requested_match_ids),
      'sequenceNumber', v_sequence_number,
      'requestFingerprint', v_request_fingerprint,
      'requestedMatchIds', to_jsonb(v_requested_match_ids)
    );
    v_event_payload := v_response || jsonb_build_object(
      'resultingMatchIds', to_jsonb(v_requested_match_ids)
    );

    INSERT INTO public.gameplay_events (
      session_id,
      sequence_number,
      actor_participant_id,
      event_type,
      idempotency_key,
      payload,
      created_at
    ) VALUES (
      p_session_id,
      v_sequence_number,
      v_host_participant_id,
      'assignment_reassigned',
      p_idempotency_key::text,
      v_event_payload,
      now()
    );

    RETURN v_response;
  EXCEPTION WHEN unique_violation THEN
    SELECT e.payload, e.event_type
    INTO v_existing_payload, v_existing_event_type
    FROM public.gameplay_events AS e
    WHERE e.session_id = p_session_id
      AND e.idempotency_key = p_idempotency_key::text;

    IF FOUND
       AND v_existing_event_type = 'assignment_reassigned'
       AND v_existing_payload ->> 'requestFingerprint' = v_request_fingerprint
       AND v_existing_payload ->> 'participantId' = p_participant_id::text
       AND v_existing_payload -> 'requestedMatchIds' = to_jsonb(v_requested_match_ids) THEN
      RETURN v_existing_payload;
    END IF;

    RAISE EXCEPTION 'idempotency_key_reused';
  END;
END;
$function$;
CREATE OR REPLACE FUNCTION private.save_running_game_configuration(p_session_id uuid, p_configuration jsonb, p_expected_token text, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_sessions;
  v_actor uuid;
  v_fingerprint text := md5(jsonb_build_array(p_configuration, p_expected_token)::text);
  v_replay public.gameplay_command_results;
  v_item jsonb;
  v_map jsonb := '{}'::jsonb;
  v_match uuid;
  v_roster uuid[];
  v_pool uuid[];
  v_before jsonb;
  v_response jsonb;
  v_mode public.assignment_mode;
  v_count integer;
  v_shared integer;
  v_effective integer;
  v_required integer;
  v_n integer;
  v_i integer;
  v_j integer;
  v_k integer;
  v_cursor integer := 1;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_host'; END IF;
  v_actor := private.require_registered_participant(p_session_id);
  IF p_idempotency_key IS NULL OR p_expected_token IS NULL OR jsonb_typeof(p_configuration) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_configuration';
  END IF;
  SELECT * INTO v_replay FROM public.gameplay_command_results
    WHERE session_id = p_session_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_replay.command_type <> 'save_running_configuration' OR v_replay.actor_participant_id <> v_actor
      OR v_replay.request_fingerprint <> v_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_replay.response;
  END IF;
  IF v_room.state <> 'in_progress' THEN RAISE EXCEPTION 'game_not_in_progress'; END IF;
  IF private.running_configuration_token(p_session_id) IS DISTINCT FROM p_expected_token THEN
    RAISE EXCEPTION 'configuration_conflict';
  END IF;
  IF jsonb_typeof(p_configuration->'newMatches') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_configuration->'newMatches') > 100
    OR jsonb_typeof(p_configuration->'assignments') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_configuration->'assignments') > 10000 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  BEGIN
    v_mode := (p_configuration->>'assignmentMode')::public.assignment_mode;
    v_count := (p_configuration->>'matchesPerPlayer')::integer;
    v_shared := (p_configuration->>'sharedMatchesPerPair')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid_configuration'; END;
  IF v_mode IS NULL OR v_mode NOT IN ('automatic', 'host_assigned') OR v_count IS NULL OR v_shared IS NULL
    OR v_count NOT BETWEEN 0 AND 100 OR v_shared NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  SELECT array_agg(id ORDER BY id) INTO v_roster FROM public.participants
    WHERE session_id = p_session_id AND left_at IS NULL;
  v_n := cardinality(v_roster);
  IF coalesce(v_n, 0) = 0 THEN RAISE EXCEPTION 'empty_participants'; END IF;
  IF NOT private.drain_catalog_room_cutoff(p_session_id) THEN
    RETURN jsonb_build_object('ok',false,'code','room_processing_pending','retryAfterSeconds',1);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('participantId', a.participant_id, 'matchId', a.match_id)
    ORDER BY a.participant_id, a.match_id), '[]'::jsonb) INTO v_before
    FROM public.assignments a WHERE a.session_id = p_session_id;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_configuration->'newMatches') x
    GROUP BY x->>'clientId' HAVING count(*) > 1) THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_configuration->'newMatches') LOOP
    IF nullif(btrim(v_item->>'clientId'), '') IS NULL OR length(v_item->>'clientId') > 128
      OR nullif(btrim(v_item->>'homeTeamName'), '') IS NULL OR length(v_item->>'homeTeamName') > 120
      OR nullif(btrim(v_item->>'awayTeamName'), '') IS NULL OR length(v_item->>'awayTeamName') > 120
      OR coalesce(v_item->>'sourceProvider','') NOT IN ('manual','espn') THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
    IF v_item->>'sourceProvider' = 'espn' AND
      (nullif(v_item->>'sourceMatchId','') IS NULL OR nullif(v_item->>'sourceLeagueCode','') IS NULL
       OR nullif(v_item->>'kickoffAt','') IS NULL) THEN RAISE EXCEPTION 'invalid_provider_metadata'; END IF;
    INSERT INTO public.matches(session_id, source_provider, source_match_id, source_league_code, home_team_name, away_team_name, kickoff_at)
    VALUES(p_session_id, v_item->>'sourceProvider', nullif(v_item->>'sourceMatchId',''), nullif(v_item->>'sourceLeagueCode',''),
      btrim(v_item->>'homeTeamName'), btrim(v_item->>'awayTeamName'), (v_item->>'kickoffAt')::timestamptz)
    ON CONFLICT (session_id, source_provider, source_match_id) WHERE source_match_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_match;
    IF v_match IS NULL THEN
      SELECT id INTO v_match FROM public.matches WHERE session_id = p_session_id
        AND source_provider = v_item->>'sourceProvider' AND source_match_id = v_item->>'sourceMatchId';
    END IF;
    v_map := v_map || jsonb_build_object(v_item->>'clientId', v_match::text);
  END LOOP;
  SELECT array_agg(id ORDER BY random()) INTO v_pool FROM public.matches
    WHERE session_id = p_session_id AND id <> v_room.common_match_id;
  v_effective := v_count;
  IF v_mode = 'automatic' THEN
    v_effective := greatest(v_count, v_shared * greatest(v_n - 1, 0));
    v_required := (v_n * (v_n - 1) / 2) * v_shared + v_n * (v_effective - v_shared * greatest(v_n - 1, 0));
    IF coalesce(cardinality(v_pool), 0) < v_required THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;
  ELSIF coalesce(cardinality(v_pool), 0) < v_count THEN RAISE EXCEPTION 'insufficient_match_pool'; END IF;

  -- Only current assignments change. Scores, totals, departed players and historical events are untouched.
  DELETE FROM public.assignments WHERE session_id = p_session_id AND participant_id = ANY(v_roster);
  IF v_mode = 'automatic' THEN
    IF v_n > 1 AND v_shared > 0 THEN
      FOR v_i IN 1..v_n-1 LOOP FOR v_j IN v_i+1..v_n LOOP FOR v_k IN 1..v_shared LOOP
        INSERT INTO public.assignments(session_id, participant_id, match_id)
          VALUES(p_session_id, v_roster[v_i], v_pool[v_cursor]),(p_session_id, v_roster[v_j], v_pool[v_cursor]);
        v_cursor := v_cursor + 1;
      END LOOP; END LOOP; END LOOP;
    END IF;
    FOR v_i IN 1..v_n LOOP
      FOR v_k IN 1..(v_effective - v_shared * greatest(v_n - 1, 0)) LOOP
        INSERT INTO public.assignments(session_id, participant_id, match_id) VALUES(p_session_id, v_roster[v_i], v_pool[v_cursor]);
        v_cursor := v_cursor + 1;
      END LOOP;
    END LOOP;
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_configuration->'assignments') LOOP
      IF (v_item->>'participantId')::uuid IS NULL OR NOT ((v_item->>'participantId')::uuid = ANY(v_roster)) THEN
        RAISE EXCEPTION 'participant_not_in_room';
      END IF;
      v_match := coalesce(v_map->>(v_item->>'matchId'), v_item->>'matchId')::uuid;
      IF v_match IS NULL OR NOT (v_match = ANY(coalesce(v_pool, ARRAY[]::uuid[]))) THEN RAISE EXCEPTION 'match_not_in_room_pool'; END IF;
      INSERT INTO public.assignments(session_id, participant_id, match_id) VALUES(p_session_id, (v_item->>'participantId')::uuid, v_match);
    END LOOP;
    IF EXISTS (SELECT 1 FROM unnest(v_roster) p(id) WHERE
      (SELECT count(*) FROM public.assignments a WHERE a.session_id = p_session_id AND a.participant_id = p.id) <> v_count) THEN
      RAISE EXCEPTION 'assignment_count_mismatch';
    END IF;
  END IF;
  INSERT INTO public.assignments(session_id, participant_id, match_id)
    SELECT p_session_id, unnest(v_roster), v_room.common_match_id;
  UPDATE public.game_sessions SET assignment_mode = v_mode, matches_per_player = v_count,
    shared_matches_per_pair = CASE WHEN v_mode = 'automatic' THEN v_shared ELSE 0 END WHERE id = p_session_id;
  INSERT INTO public.gameplay_events(session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
    VALUES(p_session_id, public.allocate_event_sequence(p_session_id), v_actor, 'assignment_replaced', p_idempotency_key::text,
      jsonb_build_object('runningGameEdit', true, 'previousAssignments', v_before,
        'assignments', (SELECT jsonb_agg(jsonb_build_object('participantId', a.participant_id, 'matchId', a.match_id))
          FROM public.assignments a WHERE a.session_id = p_session_id),
        'configuration', p_configuration, 'newMatchIds', v_map));
  v_response := private.authoritative_snapshot(p_session_id);
  INSERT INTO public.gameplay_command_results(session_id, idempotency_key, command_type, actor_participant_id, request_fingerprint, response)
    VALUES(p_session_id, p_idempotency_key, 'save_running_configuration', v_actor, v_fingerprint, v_response);
  RETURN v_response;
END;
$function$;
create or replace function private.acquire_provider_worker_slot(p_purpose text,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b private.provider_budget_state%rowtype; slot_id smallint; t timestamptz:=clock_timestamp(); token uuid:=gen_random_uuid(); live_groups integer; free_slots integer;
begin
  select * into b from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  if p_generation is distinct from b.worker_generation then return jsonb_build_object('ok',false,'code','stale_generation'); end if;
  if p_purpose is null or p_purpose not in ('live','discovery','completion','replay') then return jsonb_build_object('ok',false,'code','invalid_purpose'); end if;
  if p_purpose<>'replay' and b.ownership_mode<>'catalog' then return jsonb_build_object('ok',false,'code','acquisition_paused'); end if;
  if p_purpose<>'replay' and (b.rolling_limit is null or b.daily_limit is null) then return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  if p_purpose in ('discovery','completion') then
    select count(*) into live_groups from private.provider_request_groups where live_due_at<=t+interval '45 seconds' and not paused and (lease_until is null or lease_until<=t);
    select count(*) into free_slots from private.provider_worker_slots where lease_until is null or lease_until<=t;
    if free_slots>0 and live_groups>0 and free_slots<=least(2,(live_groups+3)/4) then return jsonb_build_object('ok',false,'code','live_capacity_reserved'); end if;
  end if;
  select id into slot_id from private.provider_worker_slots where lease_until is null or lease_until<=t order by id for update skip locked limit 1;
  if slot_id is null then return jsonb_build_object('ok',false,'code','workers_busy'); end if;
  update private.provider_worker_slots set lease_token=token,worker_generation=p_generation,lease_until=t+interval '60 seconds',started_at=t,last_progress_at=t,dispatch_request_id=null,outcome=null,dispatch_started_at=null where id=slot_id;
  return jsonb_build_object('ok',true,'slotId',slot_id,'dispatchToken',token,'workerGeneration',p_generation,'leaseUntil',t+interval '60 seconds');
end;
$$;
create or replace function private.claim_provider_request(p_group_id bigint, p_purpose text, p_worker_token uuid, p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  b private.provider_budget_state%rowtype;
  g private.provider_request_groups%rowtype;
  slot_id smallint; worker_until timestamptz; t timestamptz := clock_timestamp(); n bigint; attempt_id bigint; token uuid := gen_random_uuid();
begin
  -- This lock order is shared with admission, dispatch and ownership transitions.
  select * into b from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  if b.ownership_mode is distinct from 'catalog' then return jsonb_build_object('ok',false,'code','acquisition_paused'); end if;
  if b.rolling_limit is null or b.daily_limit is null then return jsonb_build_object('ok',false,'code','configuration_required'); end if;
  if b.worker_generation is distinct from p_generation then return jsonb_build_object('ok',false,'code','stale_generation'); end if;
  select id,least(lease_until,coalesce(dispatch_started_at,started_at)+interval '35 seconds') into slot_id,worker_until from private.provider_worker_slots where lease_token=p_worker_token and worker_generation=p_generation and lease_until>t;
  if slot_id is null then return jsonb_build_object('ok',false,'code','invalid_dispatch'); end if;
  if b.pause_reason is not null or b.cooldown_until>t then return jsonb_build_object('ok',false,'code','provider_cooldown'); end if;
  select * into g from private.provider_request_groups where id=p_group_id and provider='espn' for update;
  if not found then return jsonb_build_object('ok',false,'code','invalid_group'); end if;
  t:=clock_timestamp();
  if worker_until<=t then return jsonb_build_object('ok',false,'code','invalid_dispatch'); end if;
  if g.lease_until>t then return jsonb_build_object('ok',false,'code','already_claimed'); end if;
  if p_purpose not in ('live','discovery','completion') or p_purpose is null then return jsonb_build_object('ok',false,'code','invalid_purpose'); end if;
  if g.paused or g.cooldown_until>t or g.next_attempt_at>t or g.next_attempt_at is null then return jsonb_build_object('ok',false,'code','not_due'); end if;
  if (p_purpose='discovery' and (g.discovery_until is null or g.discovery_until<=t))
    or (p_purpose='live' and (g.live_due_at is null or g.live_due_at>t))
    or (p_purpose='completion' and (g.completion_due_at is null or g.completion_due_at>t)) then
    return jsonb_build_object('ok',false,'code','not_due');
  end if;
  if b.usage_day <> (t at time zone 'UTC')::date then
    update private.provider_budget_state set usage_day=(t at time zone 'UTC')::date,daily_count=0 where provider='espn'; b.daily_count:=0;
  end if;
  select count(*) into n from private.provider_request_attempts where reserved_at>t-interval '60 seconds';
  if n>=b.rolling_limit or b.daily_count>=b.daily_limit then return jsonb_build_object('ok',false,'code','budget_exhausted'); end if;
  insert into private.provider_request_attempts(group_id,purpose,reserved_at,worker_generation,lease_token,worker_slot_id)
  values(g.id,p_purpose,t,p_generation,token,slot_id) returning id into attempt_id;
  update private.provider_budget_state set daily_count=daily_count+1,updated_at=t where provider='espn';
  update private.provider_request_groups set lease_token=token,lease_until=least(t+interval '60 seconds',worker_until),owner_generation=p_generation,
    current_attempt_id=attempt_id,last_attempt_at=t,next_attempt_at=t+case when p_purpose='live' then interval '60 seconds' else interval '5 minutes' end
  where id=g.id;
  update private.provider_matches set last_attempt_at=t where scoreboard_group_id=g.id;
  insert into private.provider_request_daily_usage(usage_day,provider,purpose,outcome,attempt_count)
  values((t at time zone 'UTC')::date,'espn',p_purpose,'reserved',1)
  on conflict(usage_day,provider,purpose,outcome,scope_label) do update set attempt_count=private.provider_request_daily_usage.attempt_count+1;
  return jsonb_build_object('ok',true,'attemptId',attempt_id::text,'leaseToken',token,'leaseUntil',least(t+interval '60 seconds',worker_until),'startedAt',t,
    'groupId',g.id::text,'kind',g.resource_kind,'leagueCode',(select league_code from private.provider_leagues where id=g.league_id),
    'date',g.request_date,'sourceEventId',g.source_event_id,'workerGeneration',p_generation);
end;
$$;
create or replace function private.process_catalog_room(p_room_id uuid,p_worker_token uuid,p_generation bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare room_id uuid; candidate record; response jsonb; processed integer:=0; deadline timestamptz;
begin
  select least(lease_until,coalesce(dispatch_started_at,started_at)+interval '35 seconds') into deadline from private.provider_worker_slots where lease_token=p_worker_token and worker_generation=p_generation
    and worker_generation=(select worker_generation from private.provider_budget_state where provider='espn') and lease_until>clock_timestamp();
  if not found then return jsonb_build_object('ok',false,'code','invalid_dispatch'); end if;
  select id into room_id from public.game_sessions where id=p_room_id and state='in_progress'::public.session_state for update skip locked;
  if not found then return jsonb_build_object('ok',false,'code','room_busy'); end if;
  while processed<20 and clock_timestamp()<deadline-interval '5 seconds' loop
    select active.room_match_id,case when room_match.tracking_started_observation_version is null then source.observation_version else room_match.last_applied_observation_version+1 end as version
    into candidate from private.active_catalog_room_matches active join public.matches room_match on room_match.id=active.room_match_id
      join private.provider_matches source on source.id=active.catalog_match_id
    where active.session_id=p_room_id and source.observation_version>coalesce(room_match.last_applied_observation_version,0)
    order by room_match.last_provider_applied_at nulls first,active.room_match_id limit 1;
    exit when not found;
    response:=private.apply_saved_provider_observation(candidate.room_match_id,candidate.version);
    exit when response->>'ok' is distinct from 'true';
    processed:=processed+1;
  end loop;
  if clock_timestamp()>=deadline then raise exception 'Provider dispatch expired' using errcode='57014'; end if;
  return jsonb_build_object('ok',true,'processedObservations',processed);
end;
$$;
