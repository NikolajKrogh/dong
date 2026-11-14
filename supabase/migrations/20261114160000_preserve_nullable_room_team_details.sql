CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_snapshot jsonb;
  v_field text;
  v_rows jsonb;
  v_policy smallint;
  v_goals jsonb;
BEGIN
  v_snapshot := private.build_guest_room_snapshot_v1(p_session_id);
  SELECT assignment_policy_version INTO v_policy FROM public.game_sessions WHERE id=p_session_id;
  FOREACH v_field IN ARRAY ARRAY['participants','activeRoster'] LOOP
    SELECT coalesce(jsonb_agg(e.value||jsonb_build_object('additionalMatchCount',p.additional_match_count,
      'resolvedAdditionalMatchCount',coalesce(p.additional_match_count,gs.matches_per_player)) ORDER BY e.ordinality),'[]')
    INTO v_rows FROM jsonb_array_elements(v_snapshot->v_field) WITH ORDINALITY e(value,ordinality)
      JOIN public.participants p ON p.id::text=e.value->>'id' AND p.session_id=p_session_id
      JOIN public.game_sessions gs ON gs.id=p.session_id;
    v_snapshot := jsonb_set(v_snapshot,ARRAY[v_field],v_rows);
  END LOOP;
  IF v_snapshot->>'state' = 'in_progress' THEN
    WITH recent AS (
      SELECT sequence_number, room_match_id, catalog_match_id, provider_observation_version
      FROM public.gameplay_events
      WHERE session_id = p_session_id AND actor_kind = 'provider'
      ORDER BY sequence_number DESC
      LIMIT 24
    )
    SELECT jsonb_agg(jsonb_build_object(
      'sequence', e.sequence_number, 'matchId', e.room_match_id,
      'team', CASE WHEN curr.home_score > prev.home_score THEN 'home' ELSE 'away' END,
      'homeScore', curr.home_score, 'awayScore', curr.away_score
    ) ORDER BY e.sequence_number)
    INTO v_goals
    FROM recent e
    JOIN public.matches m ON m.id = e.room_match_id AND m.catalog_match_id = e.catalog_match_id
    JOIN private.provider_match_observations curr
      ON curr.match_id = e.catalog_match_id AND curr.observation_version = e.provider_observation_version
    JOIN private.provider_match_observations prev
      ON prev.match_id = curr.match_id AND prev.observation_version = curr.observation_version - 1
    WHERE prev.observation_version >= m.tracking_started_observation_version
      AND curr.accepted_at >= statement_timestamp() - interval '60 seconds'
      AND curr.lifecycle IN ('live', 'finished') AND prev.lifecycle IN ('scheduled', 'live')
      AND curr.shootout_home_score IS NULL AND curr.shootout_away_score IS NULL
      AND prev.shootout_home_score IS NULL AND prev.shootout_away_score IS NULL
      AND ((curr.home_score = prev.home_score + 1 AND curr.away_score = prev.away_score)
        OR (curr.away_score = prev.away_score + 1 AND curr.home_score = prev.home_score))
      AND NOT EXISTS (
        SELECT FROM private.provider_match_observations later
        WHERE later.match_id = curr.match_id AND later.observation_version > curr.observation_version
          AND (later.home_score < curr.home_score OR later.away_score < curr.away_score)
      );
  END IF;
  SELECT coalesce(jsonb_agg(entry.value
    || case when home.id is null then '{}'::jsonb else jsonb_build_object(
      'homeTeamDetails', jsonb_build_object('sourceTeamId',home.source_team_id,
        'name',room_match.home_team_name,'shortName',home.short_name,'logoUrl',home.logo_url)) end
    || case when away.id is null then '{}'::jsonb else jsonb_build_object(
      'awayTeamDetails', jsonb_build_object('sourceTeamId',away.source_team_id,
        'name',room_match.away_team_name,'shortName',away.short_name,'logoUrl',away.logo_url)) end ORDER BY entry.ordinality),'[]'::jsonb)
  INTO v_rows
  FROM jsonb_array_elements(v_snapshot->'matches') WITH ORDINALITY entry(value, ordinality)
  LEFT JOIN public.matches room_match ON room_match.id::text=entry.value->>'id' AND room_match.session_id=p_session_id
  LEFT JOIN private.provider_matches source ON source.id=room_match.catalog_match_id
  LEFT JOIN private.provider_teams home ON home.id=source.home_team_id
  LEFT JOIN private.provider_teams away ON away.id=source.away_team_id;
  v_snapshot := jsonb_set(v_snapshot,ARRAY['matches'],v_rows);

  RETURN v_snapshot||jsonb_build_object('providerGoals',coalesce(v_goals,'[]'), 'assignmentPolicyVersion',v_policy,
    'capabilities',jsonb_build_object('perPlayerMatchCounts',true,'assignmentPreview',true,'editableAutomaticAssignments',true),
    'configurationToken',private.running_configuration_token(p_session_id));
END;
$$;
