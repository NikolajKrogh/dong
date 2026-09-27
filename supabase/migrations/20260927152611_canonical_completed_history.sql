-- Issue #138: canonical, private completed history.
CREATE OR REPLACE FUNCTION private.end_game_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
$$;

CREATE OR REPLACE VIEW private._history_completed_participants WITH (security_invoker = true) AS
SELECT participants.session_id,
	participants.id AS participant_id,
	participants.account_id,
	participants.display_name,
	participants.membership_type,
	participants.current_drink_total,
	participants.created_at,
	account_names.preferred_display_name AS account_display_name,
    participants.left_at
FROM public.participants participants
	JOIN private._history_completed_sessions completed_sessions ON completed_sessions.session_id = participants.session_id
	LEFT JOIN private._history_account_display_names account_names ON account_names.account_id = participants.account_id;

CREATE OR REPLACE VIEW public.completed_session_summaries WITH (security_invoker = true) AS
SELECT session_rollups.session_id,
  session_rollups.owner_account_id,
  session_rollups.completed_at,
  session_rollups.started_at,
  session_rollups.common_match_id,
  session_rollups.session_total_players,
  session_rollups.session_total_matches,
  session_rollups.session_total_goals,
  session_rollups.session_total_drinks,
  session_rollups.matches_per_player,
  COALESCE(players.players, '[]'::jsonb) AS players,
  COALESCE(matches.matches, '[]'::jsonb) AS matches,
  COALESCE(assignments.player_assignments, '{}'::jsonb) AS player_assignments,
  EXISTS (
    SELECT 1
    FROM public.gameplay_events AS events
    WHERE events.session_id = session_rollups.session_id
      AND events.event_type = 'assignment_reassigned'
  ) AS assignments_changed_during_play
FROM private._history_session_rollups AS session_rollups
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', participants.participant_id,
        'accountId', participants.account_id,
        'name', participants.display_name,
        'drinksTaken', participants.current_drink_total,
        'membershipType', participants.membership_type,
        'leftAt', participants.left_at
      ) ORDER BY participants.created_at, participants.participant_id
    ),
    '[]'::jsonb
  ) AS players
  FROM private._history_completed_participants AS participants
  WHERE participants.session_id = session_rollups.session_id
) AS players ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', matches.match_id,
        'sourceProvider', matches.source_provider,
        'sourceMatchId', matches.source_match_id,
        'homeTeam', matches.home_team_name,
        'awayTeam', matches.away_team_name,
        'kickoffAt', matches.kickoff_at,
        'homeGoals', matches.home_score,
        'awayGoals', matches.away_score,
        'goals', matches.total_goals
      ) ORDER BY matches.created_at, matches.match_id
    ),
    '[]'::jsonb
  ) AS matches
  FROM private._history_completed_matches AS matches
  WHERE matches.session_id = session_rollups.session_id
) AS matches ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_object_agg(assignment_groups.participant_id::text, assignment_groups.match_ids),
    '{}'::jsonb
  ) AS player_assignments
  FROM (
    SELECT assignments.participant_id,
      jsonb_agg(assignments.match_id::text ORDER BY assignments.match_id) AS match_ids
    FROM private._history_completed_assignments AS assignments
    WHERE assignments.session_id = session_rollups.session_id
    GROUP BY assignments.participant_id
  ) AS assignment_groups
) AS assignments ON TRUE
ORDER BY session_rollups.completed_at DESC, session_rollups.session_id DESC;

-- Existing completed rows get only a completion time backed by their audit event.
UPDATE public.game_sessions AS sessions
SET completed_at = completed.created_at
FROM (
  SELECT session_id, min(created_at) AS created_at
  FROM public.gameplay_events
  WHERE event_type = 'session_completed'
  GROUP BY session_id
) AS completed
WHERE sessions.id = completed.session_id
  AND sessions.state = 'completed'::public.session_state
  AND sessions.completed_at IS NULL;

-- Invoker security must extend through every nested view to reach table RLS.
-- Other players retain their session display name; accounts remain owner-only.
CREATE OR REPLACE VIEW private._history_account_display_names
WITH (security_invoker = true) AS
SELECT accounts.id AS account_id, accounts.preferred_display_name
FROM public.accounts AS accounts
UNION ALL
SELECT visible_participants.account_id, visible_participants.display_name
FROM (
  SELECT DISTINCT ON (participants.account_id)
    participants.account_id, participants.display_name
  FROM public.participants AS participants
  WHERE participants.account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.accounts AS accounts
      WHERE accounts.id = participants.account_id
    )
  ORDER BY participants.account_id, participants.created_at DESC NULLS LAST, participants.id
) AS visible_participants;
ALTER VIEW private._history_completed_sessions SET (security_invoker = true);
ALTER VIEW private._history_completed_matches SET (security_invoker = true);
ALTER VIEW private._history_completed_assignments SET (security_invoker = true);
ALTER VIEW private._history_session_rollups SET (security_invoker = true);
ALTER VIEW private._history_participant_session_rollups SET (security_invoker = true);

GRANT SELECT ON TABLE public.assignment_snapshots TO authenticated;
CREATE POLICY assignment_snapshots_room_members_select
ON public.assignment_snapshots FOR SELECT TO authenticated
USING (private.can_access_session(session_id));

-- Keep import metadata private; expose only this caller's successful ID links.
CREATE FUNCTION private.get_history_import_links()
RETURNS TABLE (source_local_session_id text, cloud_session_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ledger.source_local_session_id, ledger.cloud_session_id
  FROM private.legacy_history_import_sessions AS ledger
  WHERE ledger.account_id = (SELECT auth.uid())
    AND ledger.state = 'imported'::public.legacy_history_import_session_state
    AND ledger.cloud_session_id IS NOT NULL
  ORDER BY ledger.source_local_session_id, ledger.cloud_session_id;
$$;
REVOKE ALL ON FUNCTION private.get_history_import_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_history_import_links() TO authenticated, service_role;

CREATE FUNCTION public.get_history_import_links()
RETURNS TABLE (source_local_session_id text, cloud_session_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.get_history_import_links();
$$;
REVOKE ALL ON FUNCTION public.get_history_import_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_history_import_links() TO authenticated, service_role;

