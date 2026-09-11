-- 041_mid_game_reassignment.sql
-- US7 / US7a (#186): host-only reassignment during a running game, with
-- immutable completion snapshots and auditable reconstruction data.

-- ---------------------------------------------------------------------------
-- Event type
-- ---------------------------------------------------------------------------
ALTER TABLE public.gameplay_events
  DROP CONSTRAINT IF EXISTS chk_gameplay_events_event_type;

ALTER TABLE public.gameplay_events
  ADD CONSTRAINT chk_gameplay_events_event_type CHECK (
    event_type IN (
      'session_created',
      'participant_joined',
      'participant_reclaimed',
      'participant_left',
      'host_transferred',
      'room_closed',
      'match_added',
      'common_match_selected',
      'assignment_replaced',
      'assignment_reassigned',
      'score_changed',
      'drink_changed',
      'session_started',
      'session_completed'
    )
  );

-- ---------------------------------------------------------------------------
-- Host-only reassignment RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.reassign_participant_matches(
  p_session_id uuid,
  p_participant_id uuid,
  p_match_ids uuid[],
  p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
$$;

REVOKE ALL ON FUNCTION private.reassign_participant_matches(uuid, uuid, uuid[], uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reassign_participant_matches(uuid, uuid, uuid[], uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.reassign_participant_matches(
  session_id uuid,
  participant_id uuid,
  match_ids uuid[],
  idempotency_key uuid
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.reassign_participant_matches(
  session_id,
  participant_id,
  match_ids,
  idempotency_key
);
$$;

REVOKE ALL ON FUNCTION public.reassign_participant_matches(uuid, uuid, uuid[], uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_participant_matches(uuid, uuid, uuid[], uuid)
TO authenticated;

-- ---------------------------------------------------------------------------
-- Immutable completion assignment snapshot
-- ---------------------------------------------------------------------------
CREATE TABLE public.assignment_snapshots (
  session_id uuid NOT NULL REFERENCES public.game_sessions(id),
  participant_id uuid NOT NULL,
  match_id uuid NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  expected_assignment_count integer NOT NULL CHECK (expected_assignment_count > 0),
  PRIMARY KEY (session_id, participant_id, match_id),
  CONSTRAINT fk_assignment_snapshots_participant
    FOREIGN KEY (session_id, participant_id)
    REFERENCES public.participants(session_id, id),
  CONSTRAINT fk_assignment_snapshots_match
    FOREIGN KEY (session_id, match_id)
    REFERENCES public.matches(session_id, id)
);

CREATE INDEX idx_assignment_snapshots_session
  ON public.assignment_snapshots (session_id);

ALTER TABLE public.assignment_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.assignment_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignment_snapshots TO service_role;

CREATE OR REPLACE FUNCTION private.prevent_assignment_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Account deletion is the one deliberate retention escape hatch. It calls
  -- the service-role-only purge RPC below, which sets this transaction-local
  -- marker; direct table UPDATE/DELETE attempts still fail, including from
  -- postgres and service_role.
  IF current_setting('app.allow_assignment_snapshot_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'assignment_snapshot_is_immutable';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_assignment_snapshot_mutation()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.prevent_assignment_snapshot_mutation() TO service_role;

DROP TRIGGER IF EXISTS trg_assignment_snapshots_immutable ON public.assignment_snapshots;
CREATE TRIGGER trg_assignment_snapshots_immutable
BEFORE UPDATE OR DELETE ON public.assignment_snapshots
FOR EACH ROW EXECUTE FUNCTION private.prevent_assignment_snapshot_mutation();

CREATE OR REPLACE FUNCTION private.assert_assignment_snapshot_complete(
  p_session_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row_count bigint;
  v_expected_min integer;
  v_expected_max integer;
BEGIN
  SELECT count(*), min(expected_assignment_count), max(expected_assignment_count)
  INTO v_row_count, v_expected_min, v_expected_max
  FROM public.assignment_snapshots
  WHERE session_id = p_session_id;

  IF v_row_count > 0
     AND (
       v_expected_min IS DISTINCT FROM v_expected_max
       OR v_row_count <> v_expected_max
     ) THEN
    RAISE EXCEPTION 'assignment_snapshot_incomplete';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_assignment_snapshot_complete(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.assert_assignment_snapshot_complete(uuid)
TO service_role;

-- Snapshot creation is one statement in end_game_session. Reject any direct
-- insert that would leave a session with a partial map, so the history view
-- never needs to execute procedural integrity code while it is being read.
CREATE OR REPLACE FUNCTION private.assert_assignment_snapshot_insert_complete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session_id uuid;
BEGIN
  FOR v_session_id IN
    SELECT DISTINCT inserted.session_id
    FROM new_rows AS inserted
  LOOP
    PERFORM private.assert_assignment_snapshot_complete(v_session_id);
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_assignment_snapshot_insert_complete()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.assert_assignment_snapshot_insert_complete()
TO service_role;

DROP TRIGGER IF EXISTS trg_assignment_snapshots_complete_insert ON public.assignment_snapshots;
CREATE TRIGGER trg_assignment_snapshots_complete_insert
AFTER INSERT ON public.assignment_snapshots
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION private.assert_assignment_snapshot_insert_complete();

CREATE OR REPLACE FUNCTION private.purge_assignment_snapshots_for_sessions(
  p_session_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  IF p_session_ids IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.allow_assignment_snapshot_delete', 'on', true);
  DELETE FROM public.assignment_snapshots
  WHERE session_id = ANY(p_session_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  PERFORM set_config('app.allow_assignment_snapshot_delete', 'off', true);
  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION private.purge_assignment_snapshots_for_sessions(uuid[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.purge_assignment_snapshots_for_sessions(uuid[])
TO service_role;

CREATE OR REPLACE FUNCTION public.purge_assignment_snapshots_for_sessions(
  session_ids uuid[]
) RETURNS integer
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.purge_assignment_snapshots_for_sessions(session_ids);
$$;

REVOKE ALL ON FUNCTION public.purge_assignment_snapshots_for_sessions(uuid[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_assignment_snapshots_for_sessions(uuid[])
TO service_role;

-- ---------------------------------------------------------------------------
-- Completion snapshot seam
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.end_game_session(
    p_session_id uuid
) RETURNS jsonb
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
    session_id,
    participant_id,
    match_id,
    captured_at,
    expected_assignment_count
  )
  SELECT
    a.session_id,
    a.participant_id,
    a.match_id,
    now(),
    v_assignment_count
  FROM public.assignments AS a
  WHERE a.session_id = p_session_id;

  GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;
  IF v_snapshot_count <> v_assignment_count THEN
    RAISE EXCEPTION 'assignment_snapshot_incomplete';
  END IF;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id,
    public.allocate_event_sequence(p_session_id),
    v_host_participant_id,
    'session_completed',
    concat('session-completed:', gen_random_uuid()::text),
    jsonb_build_object('endedBy', 'host'),
    now()
  );

  UPDATE public.game_sessions
  SET state = 'completed'::public.session_state
  WHERE id = p_session_id;

  RETURN jsonb_build_object('status', 'completed', 'sessionId', p_session_id::text);
END;
$$;

REVOKE ALL ON FUNCTION private.end_game_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.end_game_session(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- History read models
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW private._history_completed_assignments AS
SELECT snapshots.session_id,
  snapshots.participant_id,
  snapshots.match_id,
  snapshots.captured_at AS created_at
FROM public.assignment_snapshots AS snapshots
JOIN private._history_completed_sessions AS completed_sessions
  ON completed_sessions.session_id = snapshots.session_id
UNION ALL
SELECT assignments.session_id,
  assignments.participant_id,
  assignments.match_id,
  assignments.created_at
FROM public.assignments AS assignments
JOIN private._history_completed_sessions AS completed_sessions
  ON completed_sessions.session_id = assignments.session_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.assignment_snapshots AS snapshots
  WHERE snapshots.session_id = assignments.session_id
);

REVOKE ALL ON TABLE private._history_completed_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private._history_completed_assignments TO authenticated, service_role;

DROP VIEW IF EXISTS public.history_overview_totals;
DROP VIEW IF EXISTS public.completed_session_summaries;

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
        'membershipType', participants.membership_type
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

REVOKE ALL ON TABLE public.completed_session_summaries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.completed_session_summaries TO authenticated, service_role;

CREATE OR REPLACE VIEW public.history_overview_totals WITH (security_invoker = true) AS
SELECT COALESCE(count(*), 0)::integer AS total_sessions,
  COALESCE(sum(session_total_players), 0)::integer AS total_participations,
  COALESCE(sum(session_total_matches), 0)::integer AS total_matches,
  COALESCE(sum(session_total_goals), 0)::integer AS total_goals,
  COALESCE(sum(session_total_drinks), 0)::numeric AS total_drinks,
  CASE
    WHEN COALESCE(sum(session_total_players), 0) > 0
      THEN COALESCE(sum(session_total_drinks), 0)::numeric / sum(session_total_players)
    ELSE 0
  END AS average_drinks_per_participation
FROM public.completed_session_summaries;

REVOKE ALL ON TABLE public.history_overview_totals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.history_overview_totals TO authenticated, service_role;
