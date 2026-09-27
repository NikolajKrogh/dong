-- Expiry removes a guest from the live roster and future-game eligibility,
-- without rewriting the participant or gameplay history projections.

CREATE OR REPLACE FUNCTION private.is_active_room_roster_member(
  p_membership_type text,
  p_left_at timestamptz,
  p_current_guest_token_hash text,
  p_guest_grant_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN p_left_at IS NOT NULL THEN false
    WHEN p_membership_type = 'registered' THEN true
    WHEN p_membership_type = 'guest' THEN
      p_current_guest_token_hash IS NOT NULL
      AND p_guest_grant_expires_at > now()
    ELSE false
  END;
$function$;

REVOKE ALL ON FUNCTION private.is_active_room_roster_member(
  text, timestamptz, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_room_roster_member(
  text, timestamptz, text, timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'sessionId', game_sessions.id::text,
    'joinCode', game_sessions.join_code,
    'state', game_sessions.state::text,
    'commonMatchId', game_sessions.common_match_id::text,
    'assignmentMode', game_sessions.assignment_mode::text,
    'participants',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', participants.id::text,
            'displayName', participants.display_name,
            'membershipType', participants.membership_type::text,
            'sessionRole', participants.session_role::text,
            'currentDrinkTotal', participants.current_drink_total
          )
          ORDER BY participants.created_at, participants.id
        )
        FROM public.participants participants
        WHERE participants.session_id = game_sessions.id
          AND participants.left_at IS NULL
      ),
      '[]'::jsonb
    ),
    'activeRoster',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', participants.id::text,
            'displayName', participants.display_name,
            'membershipType', participants.membership_type::text,
            'sessionRole', participants.session_role::text,
            'currentDrinkTotal', participants.current_drink_total
          )
          ORDER BY participants.created_at, participants.id
        )
        FROM public.participants participants
        WHERE participants.session_id = game_sessions.id
          AND private.is_active_room_roster_member(
            participants.membership_type::text,
            participants.left_at,
            participants.guest_rejoin_token_hash,
            participants.guest_grant_expires_at
          )
      ),
      '[]'::jsonb
    ),
    'matches',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', matches.id::text,
            'sourceProvider', matches.source_provider,
            'sourceMatchId', matches.source_match_id,
            'homeTeamName', matches.home_team_name,
            'awayTeamName', matches.away_team_name,
            'kickoffAt', matches.kickoff_at,
            'homeScore', matches.home_score,
            'awayScore', matches.away_score
          )
          ORDER BY matches.created_at, matches.id
        )
        FROM public.matches matches
        WHERE matches.session_id = game_sessions.id
      ),
      '[]'::jsonb
    ),
    'assignments',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'participantId', assignments.participant_id::text,
            'matchId', assignments.match_id::text
          )
          ORDER BY assignments.participant_id, assignments.match_id
        )
        FROM public.assignments assignments
        WHERE assignments.session_id = game_sessions.id
      ),
      '[]'::jsonb
    ),
    'picks',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'participantId', assignment_picks.participant_id::text,
            'matchId', assignment_picks.match_id::text
          )
          ORDER BY assignment_picks.participant_id, assignment_picks.match_id
        )
        FROM public.assignment_picks assignment_picks
        WHERE assignment_picks.session_id = game_sessions.id
      ),
      '[]'::jsonb
    ),
    'assignmentPlan', private.compute_room_assignment_plan(game_sessions.id)
  )
  FROM public.game_sessions game_sessions
  WHERE game_sessions.id = p_session_id;
$function$;

CREATE OR REPLACE FUNCTION private.compute_room_assignment_plan(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_room public.game_sessions %ROWTYPE;
  v_participant_count int;
  v_pool_size int;
  v_effective_per_player int;
  v_required_pool_size int;
  v_relaxed_floor int;
BEGIN
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  SELECT count(*) INTO v_participant_count
  FROM public.participants participants
  WHERE participants.session_id = p_session_id
    AND private.is_active_room_roster_member(
      participants.membership_type::text,
      participants.left_at,
      participants.guest_rejoin_token_hash,
      participants.guest_grant_expires_at
    );

  SELECT count(*) INTO v_pool_size
  FROM public.matches WHERE session_id = p_session_id;

  IF v_room.assignment_mode = 'automatic'::public.assignment_mode THEN
    v_effective_per_player := GREATEST(
      v_room.matches_per_player,
      v_room.shared_matches_per_pair * GREATEST(v_participant_count - 1, 0)
    );
    v_required_pool_size := 1
      + v_room.shared_matches_per_pair * (v_participant_count * (v_participant_count - 1)) / 2
      + v_participant_count * (v_effective_per_player - v_room.shared_matches_per_pair * GREATEST(v_participant_count - 1, 0));
  ELSE
    -- Host-assigned and player-picked modes use the per-player floor only.
    v_effective_per_player := v_room.matches_per_player;
    v_required_pool_size := 1 + v_effective_per_player;
  END IF;

  v_relaxed_floor := 1 + v_effective_per_player;

  RETURN jsonb_build_object(
    'participantCount', v_participant_count,
    'poolSize', v_pool_size,
    'matchesPerPlayer', v_room.matches_per_player,
    'sharedMatchesPerPair', v_room.shared_matches_per_pair,
    'effectivePerPlayer', v_effective_per_player,
    'requiredPoolSize', v_required_pool_size,
    'relaxedFloor', v_relaxed_floor,
    'feasible', v_pool_size >= v_required_pool_size,
    'startable', v_pool_size >= v_relaxed_floor
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.set_room_assignments(
  p_session_id uuid,
  p_assignments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  IF jsonb_typeof(COALESCE(p_assignments, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid_assignment';
  END IF;

  BEGIN
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_assignments, '[]'::jsonb)) AS incoming(value)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.participants participants
        WHERE participants.id = (incoming.value->>'participantId')::uuid
          AND participants.session_id = p_session_id
          AND private.is_active_room_roster_member(
            participants.membership_type::text,
            participants.left_at,
            participants.guest_rejoin_token_hash,
            participants.guest_grant_expires_at
          )
      )
    ) THEN
      RAISE EXCEPTION 'invalid_assignment';
    END IF;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_assignment';
  END;

  -- Validate the entire replacement first so an expired/unknown participant
  -- cannot cause even a transient loss of the host's existing allocation set.
  DELETE FROM public.assignments WHERE session_id = p_session_id;

  BEGIN
    INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
    SELECT p_session_id, (elem->>'participantId')::uuid, (elem->>'matchId')::uuid, now()
    FROM jsonb_array_elements(COALESCE(p_assignments, '[]'::jsonb)) AS elem;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'invalid_assignment';
  END;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id),
    (SELECT id FROM public.participants WHERE session_id = p_session_id AND account_id = v_account
      AND session_role = 'owner'::public.participant_session_role LIMIT 1),
    'assignment_replaced', concat('assignments-replaced:', gen_random_uuid()::text),
    jsonb_build_object('assignments', COALESCE(p_assignments, '[]'::jsonb)),
    now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.start_game_session(
  p_session_id uuid,
  p_idempotency_key uuid,
  p_relax_constraints boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant_id uuid;
  v_participant_count int;
  v_match_count int;
  v_plan jsonb;
  v_effective_per_player int;
  v_shared_per_pair int;
  v_relaxed_floor int;
  v_feasible boolean;
  v_participant_ids uuid[];
  v_pool_ids uuid[];
  v_pool_cursor int := 1;
  v_p int;
  v_i int;
  v_j int;
  v_kk int;
  v_needed int;
  v_held int;
  v_match_id uuid;
  v_assignments_created int;
  v_filled_participant_ids uuid[] := '{}'::uuid[];
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'invalid_room_state'; END IF;

  SELECT count(*) INTO v_participant_count
  FROM public.participants participants
  WHERE participants.session_id = p_session_id
    AND private.is_active_room_roster_member(
      participants.membership_type::text,
      participants.left_at,
      participants.guest_rejoin_token_hash,
      participants.guest_grant_expires_at
    );
  IF v_participant_count = 0 THEN RAISE EXCEPTION 'empty_participants'; END IF;

  SELECT count(*) INTO v_match_count FROM public.matches WHERE session_id = p_session_id;
  IF v_match_count = 0 THEN RAISE EXCEPTION 'empty_matches'; END IF;

  IF v_room.common_match_id IS NULL THEN RAISE EXCEPTION 'missing_common_match'; END IF;
  PERFORM 1 FROM public.matches WHERE id = v_room.common_match_id AND session_id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_common_match'; END IF;

  v_plan := private.compute_room_assignment_plan(p_session_id);
  v_effective_per_player := (v_plan->>'effectivePerPlayer')::int;
  v_shared_per_pair := (v_plan->>'sharedMatchesPerPair')::int;
  v_relaxed_floor := (v_plan->>'relaxedFloor')::int;
  v_feasible := (v_plan->>'feasible')::boolean;

  -- The arithmetic floor is never overridable, relaxed or not, in any mode.
  IF v_match_count < v_relaxed_floor THEN
    RAISE EXCEPTION 'insufficient_match_pool';
  END IF;

  -- A satisfiable-but-under-configured pool pauses on the host's explicit
  -- choice. Non-automatic modes have requiredPoolSize = relaxedFloor.
  IF NOT v_feasible AND NOT p_relax_constraints THEN
    RAISE EXCEPTION 'assignment_constraints_unsatisfiable';
  END IF;

  -- Room state is locked above; this is the one server-authoritative roster
  -- snapshot used for all allocations settled into the game.
  SELECT array_agg(participants.id ORDER BY random()) INTO v_participant_ids
  FROM public.participants participants
  WHERE participants.session_id = p_session_id
    AND private.is_active_room_roster_member(
      participants.membership_type::text,
      participants.left_at,
      participants.guest_rejoin_token_hash,
      participants.guest_grant_expires_at
    );
  v_p := array_length(v_participant_ids, 1);

  SELECT array_agg(id ORDER BY random()) INTO v_pool_ids
  FROM public.matches WHERE session_id = p_session_id AND id <> v_room.common_match_id;

  IF v_room.assignment_mode = 'host_assigned'::public.assignment_mode THEN
    DELETE FROM public.assignments a
    WHERE a.session_id = p_session_id
      AND a.participant_id <> ALL (v_participant_ids);
  ELSE
    DELETE FROM public.assignments WHERE session_id = p_session_id;
  END IF;

  IF v_room.assignment_mode = 'player_picked'::public.assignment_mode THEN
    INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
    SELECT p_session_id, ranked.participant_id, ranked.match_id, now()
    FROM (
      SELECT ap.participant_id,
             ap.match_id,
             row_number() OVER (
               PARTITION BY ap.participant_id ORDER BY random()
             ) AS rn
      FROM public.assignment_picks ap
      WHERE ap.session_id = p_session_id
        AND ap.participant_id = ANY (v_participant_ids)
        AND ap.match_id <> v_room.common_match_id
        AND EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.session_id = p_session_id AND m.id = ap.match_id
        )
    ) ranked
    WHERE ranked.rn <= v_effective_per_player;
  END IF;

  IF v_room.assignment_mode IN (
       'host_assigned'::public.assignment_mode,
       'player_picked'::public.assignment_mode
     ) THEN
    FOR v_i IN 1..v_p LOOP
      SELECT count(*) INTO v_held FROM public.assignments a
      WHERE a.session_id = p_session_id
        AND a.participant_id = v_participant_ids[v_i]
        AND a.match_id <> v_room.common_match_id;

      v_needed := v_effective_per_player - v_held;
      IF v_needed > 0 THEN
        INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
        SELECT p_session_id, v_participant_ids[v_i], m.id, now()
        FROM public.matches m
        WHERE m.session_id = p_session_id
          AND m.id <> v_room.common_match_id
          AND NOT EXISTS (
            SELECT 1 FROM public.assignments a2
            WHERE a2.session_id = p_session_id
              AND a2.participant_id = v_participant_ids[v_i]
              AND a2.match_id = m.id
          )
        ORDER BY random()
        LIMIT v_needed;

        v_filled_participant_ids := array_append(v_filled_participant_ids, v_participant_ids[v_i]);
      END IF;
    END LOOP;
  ELSIF v_feasible THEN
    FOR v_i IN 1..(v_p - 1) LOOP
      FOR v_j IN (v_i + 1)..v_p LOOP
        FOR v_kk IN 1..v_shared_per_pair LOOP
          v_match_id := v_pool_ids[v_pool_cursor];
          v_pool_cursor := v_pool_cursor + 1;
          INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
          VALUES (p_session_id, v_participant_ids[v_i], v_match_id, now()),
                 (p_session_id, v_participant_ids[v_j], v_match_id, now());
        END LOOP;
      END LOOP;
    END LOOP;

    v_needed := v_effective_per_player - v_shared_per_pair * GREATEST(v_p - 1, 0);
    FOR v_i IN 1..v_p LOOP
      FOR v_kk IN 1..v_needed LOOP
        v_match_id := v_pool_ids[v_pool_cursor];
        v_pool_cursor := v_pool_cursor + 1;
        INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
        VALUES (p_session_id, v_participant_ids[v_i], v_match_id, now());
      END LOOP;
    END LOOP;
  ELSE
    FOR v_i IN 1..v_p LOOP
      INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
      SELECT p_session_id, v_participant_ids[v_i], m.id, now()
      FROM public.matches m
      WHERE m.session_id = p_session_id AND m.id <> v_room.common_match_id
      ORDER BY random()
      LIMIT v_effective_per_player;
    END LOOP;
  END IF;

  INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
  SELECT p_session_id, unnest(v_participant_ids), v_room.common_match_id, now()
  ON CONFLICT (session_id, participant_id, match_id) DO NOTHING;

  SELECT count(*) INTO v_assignments_created
  FROM public.assignments WHERE session_id = p_session_id;

  SELECT id INTO v_host_participant_id FROM public.participants
  WHERE session_id = p_session_id AND account_id = v_account
    AND session_role = 'owner'::public.participant_session_role
  LIMIT 1;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant_id,
    'assignment_replaced', concat('canonical-start-assignments:', p_idempotency_key::text),
    jsonb_build_object(
      'assignments',
      (SELECT jsonb_agg(jsonb_build_object('participantId', a.participant_id::text, 'matchId', a.match_id::text))
       FROM public.assignments a WHERE a.session_id = p_session_id)
    ),
    now()
  );

  UPDATE public.game_sessions SET state = 'in_progress'::public.session_state, started_at = now()
  WHERE id = p_session_id;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant_id,
    'session_started', concat('start-game:', p_idempotency_key::text),
    jsonb_build_object(
      'startedAt', now(),
      'relaxedConstraints', (NOT v_feasible AND p_relax_constraints),
      'filledInParticipantIds', COALESCE(
        (SELECT jsonb_agg(x::text) FROM unnest(v_filled_participant_ids) AS x),
        '[]'::jsonb
      )
    ),
    now()
  );

  RETURN jsonb_build_object(
    'status', 'started',
    'sessionId', p_session_id::text,
    'relaxedConstraints', (NOT v_feasible AND p_relax_constraints),
    'assignmentsCreated', v_assignments_created,
    'filledInParticipantIds', COALESCE(
      (SELECT jsonb_agg(x::text) FROM unnest(v_filled_participant_ids) AS x),
      '[]'::jsonb
    )
  );
END;
$function$;
