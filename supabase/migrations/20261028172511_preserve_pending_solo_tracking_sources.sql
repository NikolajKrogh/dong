-- Prepared solo issuances retain their source until finalization or expiry.
create or replace function private.maintain_catalog_storage() returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); deleted_matches integer;
begin
  perform 1 from private.provider_budget_state where provider='espn' for update;
  perform private.recover_catalog_claims();
  delete from private.solo_tracking_grants where id in (select id from private.solo_tracking_grants where expires_at<=t order by expires_at limit 1000);
  delete from private.provider_admission_counters where ctid in (select ctid from private.provider_admission_counters where window_start<t-interval '2 hours' limit 1000);
  delete from private.provider_request_attempts where id in (select id from private.provider_request_attempts where reserved_at<t-interval '24 hours' and outcome<>'reserved' order by reserved_at limit 1000);
  delete from private.provider_matches source where source.id in (
    select m.id from private.provider_matches m where not exists(select 1 from public.matches room_match where room_match.catalog_match_id=m.id)
      and not exists(select 1 from private.catalog_demand_matches active where active.catalog_match_id=m.id)
      and not exists(select 1 from private.solo_tracked_matches selected where selected.match_id=m.id)
      and ((m.lifecycle in ('finished','canceled','abandoned') and coalesce(m.completed_at,m.observed_at,m.created_at)<t-interval '30 days' and m.last_used_at<t-interval '30 days')
        or m.lifecycle not in ('finished','canceled','abandoned') and m.last_used_at<t-interval '24 hours') order by m.last_used_at limit 1000
  );
  get diagnostics deleted_matches=row_count;
  delete from private.provider_request_groups g where g.id in (
    select resource.id from private.provider_request_groups resource where resource.last_used_at<t-interval '24 hours'
      and (resource.lease_until is null or resource.lease_until<=t) and (resource.discovery_until is null or resource.discovery_until<=t)
      and not exists(select 1 from private.provider_matches where scoreboard_group_id=resource.id)
      and not exists(select 1 from private.provider_request_attempts where group_id=resource.id)
      and not exists(select 1 from private.provider_matches m where m.league_id=resource.league_id and m.source_event_id=resource.source_event_id)
    order by resource.last_used_at limit 1000
  );
  delete from private.provider_athletes a where a.id in (select id from private.provider_athletes athlete where not exists(select 1 from private.provider_match_rosters where athlete_id=athlete.id)
    and not exists(select 1 from private.provider_goal_participants where athlete_id=athlete.id) limit 1000);
  delete from private.provider_teams team where team.id in (select id from private.provider_teams candidate where not exists(select 1 from private.provider_matches where home_team_id=candidate.id or away_team_id=candidate.id)
    and not exists(select 1 from private.provider_match_team_stats where team_id=candidate.id) limit 1000);
  delete from private.provider_request_daily_usage where ctid in (select ctid from private.provider_request_daily_usage where usage_day<(t at time zone 'UTC')::date-90 limit 1000);
  delete from private.provider_capacity_samples where sample_day<(t at time zone 'UTC')::date-90;
  delete from cron.job_run_details where runid in (select runid from cron.job_run_details where jobid=(select jobid from cron.job where jobname='match-catalog-monitor') and end_time<t-interval '7 days' order by end_time limit 1000);
  return private.measure_catalog_capacity()||jsonb_build_object('evictedMatches',deleted_matches);
end;
$$;
