-- League metadata and selection policy live in Postgres; clients cache this projection.
alter table private.provider_leagues
  add column category text check (length(category) between 1 and 80),
  add column is_enabled boolean not null default true,
  add column default_order integer check (default_order >= 0),
  add column is_default_selected boolean not null default false;

-- Preserve existing identities while replacing code-only labels with curated names.
update private.provider_leagues league set display_name=metadata.name,category=metadata.category,
  default_order=metadata.default_order,is_default_selected=metadata.selected
from (values
  ('eng.1','Premier League','Europe',0,true),
  ('eng.2','Championship','Europe',1,true),
  ('eng.3','League One','Europe',null::integer,false),
  ('eng.4','League Two','Europe',null::integer,false),
  ('eng.league_cup','Carabao Cup','Europe',null::integer,false),
  ('eng.fa','FA Cup','Europe',null::integer,false),
  ('esp.1','La Liga','Europe',3,false),
  ('esp.2','LALIGA 2','Europe',null::integer,false),
  ('esp.copa_del_rey','Spanish Copa del Rey','Europe',null::integer,false),
  ('ger.1','Bundesliga','Europe',2,false),
  ('ger.2','German 2. Bundesliga','Europe',null::integer,false),
  ('ger.dfb_pokal','DFB Pokal','Europe',null::integer,false),
  ('ita.1','Serie A','Europe',4,false),
  ('ita.2','Serie B','Europe',null::integer,false),
  ('ita.coppa_italia','Coppa Italia','Europe',null::integer,false),
  ('fra.1','Ligue 1','Europe',5,false),
  ('fra.2','Ligue 2','Europe',null::integer,false),
  ('fra.coupe_de_france','Coupe de France','Europe',null::integer,false),
  ('por.1','Portuguese Primeira Liga','Europe',null::integer,false),
  ('ned.1','Eredivisie','Europe',null::integer,false),
  ('ned.cup','Dutch KNVB Beker','Europe',null::integer,false),
  ('sco.1','Scottish Premiership','Europe',null::integer,false),
  ('sco.3','Scottish League One','Europe',null::integer,false),
  ('sco.4','Scottish League Two','Europe',null::integer,false),
  ('bel.1','Belgian Pro League','Europe',null::integer,false),
  ('rus.1','Russian Premier League','Europe',null::integer,false),
  ('tur.1','Turkish Super Lig','Europe',null::integer,false),
  ('gre.1','Greek Super League','Europe',null::integer,false),
  ('sui.1','Swiss Super League','Europe',null::integer,false),
  ('aut.1','Austrian Bundesliga','Europe',null::integer,false),
  ('den.1','Superliga','Europe',6,false),
  ('nor.1','Norwegian Eliteserien','Europe',null::integer,false),
  ('swe.1','Swedish Allsvenskan','Europe',null::integer,false),
  ('irl.1','Irish Premier Division','Europe',null::integer,false),
  ('uefa.champions','UEFA Champions League','Europe',null::integer,false),
  ('uefa.europa','UEFA Europa League','Europe',null::integer,false),
  ('uefa.europa.conf','UEFA Conference League','Europe',null::integer,false),
  ('uefa.wchampions','UEFA Women''s Champions League','Europe',null::integer,false),
  ('usa.1','MLS','USA, Mexico & CONCACAF',null::integer,false),
  ('usa.nwsl','NWSL','USA, Mexico & CONCACAF',null::integer,false),
  ('usa.usl.1','USL Championship','USA, Mexico & CONCACAF',null::integer,false),
  ('usa.usl.l1','USL League One','USA, Mexico & CONCACAF',null::integer,false),
  ('usa.open','U.S. Open Cup','USA, Mexico & CONCACAF',null::integer,false),
  ('usa.nwsl.cup','NWSL Challenge Cup','USA, Mexico & CONCACAF',null::integer,false),
  ('mex.1','Mexican Liga BBVA MX','USA, Mexico & CONCACAF',null::integer,false),
  ('mex.2','Mexican Liga de Expansión MX','USA, Mexico & CONCACAF',null::integer,false),
  ('mex.copa_mx','Mexican Copa MX','USA, Mexico & CONCACAF',null::integer,false),
  ('concacaf.champions','Concacaf Champions Cup','USA, Mexico & CONCACAF',null::integer,false),
  ('concacaf.gold','Concacaf Gold Cup','USA, Mexico & CONCACAF',null::integer,false),
  ('crc.1','Costa Rican Primera Division','USA, Mexico & CONCACAF',null::integer,false),
  ('hon.1','Honduran Liga Nacional','USA, Mexico & CONCACAF',null::integer,false),
  ('gua.1','Guatemalan Liga Nacional','USA, Mexico & CONCACAF',null::integer,false),
  ('slv.1','Salvadoran Primera Division','USA, Mexico & CONCACAF',null::integer,false),
  ('bra.1','Brazilian Serie A','South America',null::integer,false),
  ('bra.2','Brazilian Serie B','South America',null::integer,false),
  ('bra.copa_do_brazil','Copa do Brasil','South America',null::integer,false),
  ('bra.camp.gaucho','Brazilian Campeonato Gaucho','South America',null::integer,false),
  ('bra.camp.paulista','Brazilian Campeonato Paulista','South America',null::integer,false),
  ('bra.camp.carioca','Brazilian Campeonato Carioca','South America',null::integer,false),
  ('bra.camp.mineiro','Brazilian Campeonato Mineiro','South America',null::integer,false),
  ('arg.1','Argentine Liga Profesional de Fútbol','South America',null::integer,false),
  ('arg.2','Argentine Nacional B','South America',null::integer,false),
  ('arg.3','Argentine Primera B','South America',null::integer,false),
  ('arg.4','Argentine Primera C','South America',null::integer,false),
  ('arg.5','Argentine Primera D','South America',null::integer,false),
  ('arg.copa','Copa Argentina','South America',null::integer,false),
  ('arg.copa_lpf','Argentine Copa de la Liga Profesional','South America',null::integer,false),
  ('col.1','Colombian Primera A','South America',null::integer,false),
  ('col.2','Colombian Primera B','South America',null::integer,false),
  ('col.copa','Copa Colombia','South America',null::integer,false),
  ('chi.1','Chilean Primera División','South America',null::integer,false),
  ('chi.copa_chi','Copa Chile','South America',null::integer,false),
  ('ecu.1','LigaPro Ecuador','South America',null::integer,false),
  ('uru.1','Liga UAF Uruguaya','South America',null::integer,false),
  ('ven.1','Venezuelan Primera División','South America',null::integer,false),
  ('par.1','Paraguayan Primera División','South America',null::integer,false),
  ('per.1','Peruvian Liga 1','South America',null::integer,false),
  ('bol.1','Bolivian Liga Profesional','South America',null::integer,false),
  ('conmebol.libertadores','CONMEBOL Libertadores','South America',null::integer,false),
  ('conmebol.sudamericana','CONMEBOL Sudamericana','South America',null::integer,false),
  ('conmebol.america','Copa América','South America',null::integer,false),
  ('fifa.world','FIFA World Cup','Internationals',null::integer,false),
  ('fifa.cwc','FIFA Club World Cup','Internationals',null::integer,false),
  ('fifa.worldq.uefa','FIFA World Cup Qualifying - UEFA','Internationals',null::integer,false),
  ('fifa.worldq.concacaf','FIFA World Cup Qualifying - Concacaf','Internationals',null::integer,false),
  ('fifa.worldq.conmebol','FIFA World Cup Qualifying - CONMEBOL','Internationals',null::integer,false),
  ('fifa.worldq.afc','FIFA World Cup Qualifying - AFC','Internationals',null::integer,false),
  ('fifa.worldq.caf','FIFA World Cup Qualifying - CAF','Internationals',null::integer,false),
  ('fifa.worldq.ofc','FIFA World Cup Qualifying - OFC','Internationals',null::integer,false),
  ('fifa.wwc','FIFA Women''s World Cup','Internationals',null::integer,false),
  ('fifa.world.u20','FIFA Under-20 World Cup','Internationals',null::integer,false),
  ('fifa.world.u17','FIFA Under-17 World Cup','Internationals',null::integer,false),
  ('fifa.olympics','Men''s Olympic Soccer Tournament','Internationals',null::integer,false),
  ('fifa.w.olympics','Women''s Olympic Soccer Tournament','Internationals',null::integer,false),
  ('fifa.friendly','International Friendly','Internationals',null::integer,false),
  ('fifa.friendly.w','Women''s International Friendly','Internationals',null::integer,false),
  ('uefa.euro','UEFA European Championship','Internationals',null::integer,false),
  ('uefa.nations','UEFA Nations League','Internationals',null::integer,false),
  ('uefa.euro_u21','UEFA European Under-21 Championship','Internationals',null::integer,false),
  ('uefa.euro.u19','UEFA European Under-19 Championship','Internationals',null::integer,false),
  ('uefa.euroq','UEFA European Championship Qualifying','Internationals',null::integer,false),
  ('uefa.weuro','UEFA Women''s European Championship','Internationals',null::integer,false),
  ('concacaf.womens.championship','Concacaf W Championship','Internationals',null::integer,false),
  ('club.friendly','Club Friendly','Internationals',null::integer,false),
  ('afc.champions','AFC Champions League Elite','Asia',null::integer,false),
  ('afc.cup','AFC Champions League Two','Asia',null::integer,false),
  ('afc.asian.cup','AFC Asian Cup','Asia',null::integer,false),
  ('afc.cupq','AFC Asian Cup Qualifiers','Asia',null::integer,false),
  ('ksa.1','Saudi Pro League','Asia',null::integer,false),
  ('aus.1','Australian A-League Men','Asia',null::integer,false),
  ('aus.w.1','Australian A-League Women','Asia',null::integer,false),
  ('jpn.1','Japanese J.League','Asia',null::integer,false),
  ('chn.1','Chinese Super League','Asia',null::integer,false),
  ('ind.1','Indian Super League','Asia',null::integer,false),
  ('idn.1','Indonesian Liga 1','Asia',null::integer,false),
  ('mys.1','Malaysian Super League','Asia',null::integer,false),
  ('sgp.1','Singaporean Premier League','Asia',null::integer,false),
  ('tha.1','Thai League 1','Asia',null::integer,false),
  ('aff.championship','ASEAN Championship','Asia',null::integer,false),
  ('caf.champions','CAF Champions League','Africa',null::integer,false),
  ('caf.nations','Africa Cup of Nations','Africa',null::integer,false)
) as metadata(code,name,category,default_order,selected)
where league.provider='espn' and league.league_code=metadata.code;

-- Disabled rows remain readable for saved preferences and history.
create function private.list_leagues()
returns table(code text,name text,category text,"isEnabled" boolean,"defaultOrder" integer,"selectedByDefault" boolean)
language sql stable security definer set search_path='' as $$
  select league.league_code,league.display_name,league.category,league.is_enabled,league.default_order,league.is_default_selected
  from private.provider_leagues league where league.provider='espn'
  order by league.default_order nulls last,league.display_name,league.league_code;
$$;
create function public.list_leagues()
returns table(code text,name text,category text,"isEnabled" boolean,"defaultOrder" integer,"selectedByDefault" boolean)
language sql stable security invoker set search_path='' as $$
  select * from private.list_leagues();
$$;
revoke all on function private.list_leagues(),public.list_leagues() from public,anon,authenticated,service_role;
grant execute on function private.list_leagues(),public.list_leagues() to anon,authenticated;

-- Membership and selection policy are checked only when admitting discovery.
-- Existing match consumers and monitoring do not consult is_enabled.
create or replace function private.prepare_match_discovery(p_league_codes text[],p_request_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy private.provider_budget_state%rowtype; codes text[]; ids bigint[]; work_ids jsonb; t timestamptz:=clock_timestamp(); can_admit_source boolean; recent_attempts integer;
begin
  if p_league_codes is null or cardinality(p_league_codes)>128 or p_request_date is null or exists(select 1 from unnest(p_league_codes) x where x is null) then return jsonb_build_object('ok',false,'code','invalid_selection'); end if;
  if p_request_date not between (t at time zone 'UTC')::date-7 and (t at time zone 'UTC')::date+7 then return jsonb_build_object('ok',false,'code','date_out_of_range'); end if;
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
