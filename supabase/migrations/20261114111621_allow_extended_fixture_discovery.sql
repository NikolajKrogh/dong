-- Keep fixture discovery demand bounded by the existing provider budgets and leases.
create or replace function private.prepare_match_discovery(p_league_codes text[],p_request_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; codes text[]; ids bigint[]; work_ids jsonb; t timestamptz:=clock_timestamp(); can_admit_source boolean; recent_attempts integer;
begin
  if p_league_codes is null or cardinality(p_league_codes)>128 or p_request_date is null or not isfinite(p_request_date) or exists(select 1 from unnest(p_league_codes) x where x is null) then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  select coalesce(array_agg(distinct btrim(x) order by btrim(x)),'{}'::text[]) into codes from unnest(p_league_codes) x where btrim(x)<>'';
  if cardinality(codes)>16 then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  if exists(select 1 from unnest(codes) x where not exists(select 1 from private.provider_leagues where provider='espn' and league_code=x and is_enabled)) then return jsonb_build_object('ok',false,'code','unsupported_league'); end if;
  select * into policy from private.provider_budget_state where provider='espn' for update;
  t:=clock_timestamp();
  select count(*) into recent_attempts from private.provider_request_attempts where reserved_at>t-interval '60 seconds';
  can_admit_source:=policy.ownership_mode='catalog' and policy.rolling_limit is not null and policy.daily_limit is not null
    and policy.pause_reason is null and (policy.cooldown_until is null or policy.cooldown_until<=t) and recent_attempts<policy.rolling_limit
    and (policy.usage_day<>(t at time zone 'UTC')::date or policy.daily_count<policy.daily_limit);
  if can_admit_source and (policy.new_demand_allowed and not policy.scheduling_degraded) then
    insert into private.provider_request_groups(provider,league_id,resource_kind,request_date,next_attempt_at)
    select 'espn',id,'scoreboard',p_request_date,t from private.provider_leagues where provider='espn' and league_code=any(codes) on conflict(provider,scope_key) do nothing;
  end if;
  select coalesce(array_agg(g.id),'{}'::bigint[]) into ids from private.provider_request_groups g join private.provider_leagues league on league.id=g.league_id
  where league.provider='espn' and league.league_code=any(codes) and g.resource_kind='scoreboard' and g.request_date=p_request_date;
  perform private.refresh_catalog_group_due(ids);
  if can_admit_source and (policy.new_demand_allowed and not policy.scheduling_degraded) then
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
