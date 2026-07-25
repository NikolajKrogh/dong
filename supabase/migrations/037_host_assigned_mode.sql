-- 037_host_assigned_mode.sql
-- US5.5 (#184): the room's assignment mode setting, plus host-assigned manual
-- allocation. Builds on 036 (compute_room_assignment_plan, start_game_session,
-- set_room_assignment_settings) and 035 (set_room_assignments, still the host
-- allocation seam -- see specs/021-host-assigned-mode/research.md R2).
--
-- Scope is the #184 slice of specs/020-canonical-assignment-generation/spec.md
-- (Delivery Slices table): User Story 3's mode setting and User Story 5.
-- Player-picked selection (#185) and mid-game reassignment (#186) are out of
-- scope; the `player_picked` enum value exists so the mode column doesn't need
-- another ALTER TYPE later.

-- ---------------------------------------------------------------------------
-- Assignment mode (FR-026, FR-027). NOT NULL DEFAULT 'automatic' means an
-- unset room reads as automatic for free -- no coalesce needed anywhere it's
-- read (data-model.md).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_type
		WHERE typname = 'assignment_mode'
	) THEN
		CREATE TYPE public.assignment_mode AS ENUM ('automatic', 'host_assigned', 'player_picked');
	END IF;
END;
$$;

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS assignment_mode public.assignment_mode NOT NULL DEFAULT 'automatic';

-- ---------------------------------------------------------------------------
-- private.compute_room_assignment_plan: mode-aware (research.md R3, FR-011).
-- Outside automatic mode, effectivePerPlayer is the stored matches_per_player,
-- never raised by the FR-009 minimum, and requiredPoolSize collapses to
-- relaxedFloor (1 + effectivePerPlayer) since there is no pairwise-overlap
-- requirement to inflate it -- which also means `feasible` is trivially true
-- once the arithmetic floor passes, so start_game_session's existing
-- shortfall-warning branch needs no separate mode check (contracts/room-rpcs.md #3).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.compute_room_assignment_plan(p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
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

  SELECT count(*) INTO v_participant_count FROM public.participants
  WHERE session_id = p_session_id AND left_at IS NULL;

  SELECT count(*) INTO v_pool_size FROM public.matches WHERE session_id = p_session_id;

  IF v_room.assignment_mode = 'automatic'::public.assignment_mode THEN
    v_effective_per_player := GREATEST(
      v_room.matches_per_player,
      v_room.shared_matches_per_pair * GREATEST(v_participant_count - 1, 0)
    );
    v_required_pool_size := 1
      + v_room.shared_matches_per_pair * (v_participant_count * (v_participant_count - 1)) / 2
      + v_participant_count * (v_effective_per_player - v_room.shared_matches_per_pair * GREATEST(v_participant_count - 1, 0));
  ELSE
    -- FR-011: host-assigned and player-picked modes are constrained by the
    -- per-player count alone -- the exact-overlap rule and its derived
    -- minimum never apply outside automatic generation.
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
$$;
-- Signature unchanged from 036 -- existing REVOKE/GRANT on this function
-- carry over automatically; no need to reissue them.

-- ---------------------------------------------------------------------------
-- build_guest_room_snapshot: add assignmentMode. Additive only -- existing
-- keys, ordering, and types are unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
SELECT jsonb_build_object(
        'sessionId',
        game_sessions.id::text,
        'joinCode',
        game_sessions.join_code,
        'state',
        game_sessions.state::text,
        'commonMatchId',
        game_sessions.common_match_id::text,
        'assignmentMode',
        game_sessions.assignment_mode::text,
        'participants',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            participants.id::text,
                            'displayName',
                            participants.display_name,
                            'membershipType',
                            participants.membership_type::text,
                            'sessionRole',
                            participants.session_role::text,
                            'currentDrinkTotal',
                            participants.current_drink_total
                        )
                        ORDER BY participants.created_at,
                            participants.id
                    )
                FROM public.participants participants
                WHERE participants.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'matches',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            matches.id::text,
                            'sourceProvider',
                            matches.source_provider,
                            'sourceMatchId',
                            matches.source_match_id,
                            'homeTeamName',
                            matches.home_team_name,
                            'awayTeamName',
                            matches.away_team_name,
                            'kickoffAt',
                            matches.kickoff_at,
                            'homeScore',
                            matches.home_score,
                            'awayScore',
                            matches.away_score
                        )
                        ORDER BY matches.created_at,
                            matches.id
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
                            'participantId',
                            assignments.participant_id::text,
                            'matchId',
                            assignments.match_id::text
                        )
                        ORDER BY assignments.participant_id,
                            assignments.match_id
                    )
                FROM public.assignments assignments
                WHERE assignments.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'assignmentPlan',
        private.compute_room_assignment_plan(game_sessions.id)
    )
FROM public.game_sessions game_sessions
WHERE game_sessions.id = p_session_id;
$$;
-- Signature unchanged -- existing REVOKE/GRANT carry over.

-- ---------------------------------------------------------------------------
-- private.set_room_assignment_settings: the FR-031 minimum-floor guard is now
-- mode-conditional (research.md R3, FR-011) -- outside automatic mode any
-- non-negative count is accepted regardless of shared_matches_per_pair.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_room_assignment_settings(
    p_session_id uuid,
    p_matches_per_player int,
    p_shared_matches_per_pair int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_participant_count int;
  v_minimum int;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  IF p_matches_per_player < 0 OR p_shared_matches_per_pair < 0 THEN
    RAISE EXCEPTION 'invalid_assignment_settings';
  END IF;

  IF v_room.assignment_mode = 'automatic'::public.assignment_mode THEN
    SELECT count(*) INTO v_participant_count FROM public.participants
    WHERE session_id = p_session_id AND left_at IS NULL;

    v_minimum := p_shared_matches_per_pair * GREATEST(v_participant_count - 1, 0);
    IF p_matches_per_player < v_minimum THEN
      RAISE EXCEPTION 'per_player_count_below_minimum';
    END IF;
  END IF;

  -- Idempotent: writing the values already stored is a no-op success.
  IF v_room.matches_per_player = p_matches_per_player
     AND v_room.shared_matches_per_pair = p_shared_matches_per_pair THEN
    RETURN;
  END IF;

  UPDATE public.game_sessions
  SET matches_per_player = p_matches_per_player,
      shared_matches_per_pair = p_shared_matches_per_pair
  WHERE id = p_session_id;
END;
$$;
-- Signature unchanged -- existing REVOKE/GRANT carry over.

-- ---------------------------------------------------------------------------
-- private/public.set_room_assignment_mode (NEW, FR-026, FR-029, FR-030)
-- contracts/room-rpcs.md #1. No gameplay event emitted -- matches the
-- existing precedent of set_room_assignment_settings (research.md R7). The
-- client-side discard-draft confirmation (FR-030a) is a UI gate before this
-- call, not a server-side rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_room_assignment_mode(
    p_session_id uuid,
    p_mode text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_mode public.assignment_mode;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  BEGIN
    v_mode := p_mode::public.assignment_mode;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_assignment_mode';
  END;

  -- Idempotent: writing the mode already stored is a no-op success.
  IF v_room.assignment_mode = v_mode THEN
    RETURN;
  END IF;

  UPDATE public.game_sessions SET assignment_mode = v_mode WHERE id = p_session_id;
END;
$$;
REVOKE ALL ON FUNCTION private.set_room_assignment_mode(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_room_assignment_mode(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_room_assignment_mode(
    session_id uuid, mode text
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.set_room_assignment_mode(session_id, mode);
$$;
REVOKE ALL ON FUNCTION public.set_room_assignment_mode(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_assignment_mode(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- start_game_session: add the host-assigned generation branch (research.md
-- R4, R5; contracts/room-rpcs.md #4). Same three-argument signature as 036 --
-- CREATE OR REPLACE is sufficient, no DROP FUNCTION needed. The five
-- pre-existing guards and the automatic/relaxed branches are unchanged; only
-- the delete-vs-preserve step and the generation branch gain a host_assigned
-- path, and the Common Match insert gains ON CONFLICT DO NOTHING so it can't
-- collide with a host allocation that already included it explicitly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.start_game_session(
    p_session_id uuid,
    p_idempotency_key uuid,
    p_relax_constraints boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  v_p int; -- active participant count, as an array bound
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

  SELECT count(*) INTO v_participant_count FROM public.participants
  WHERE session_id = p_session_id AND left_at IS NULL;
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

  -- FR-017: the arithmetic floor is never overridable, relaxed or not, in any mode.
  IF v_match_count < v_relaxed_floor THEN
    RAISE EXCEPTION 'insufficient_match_pool';
  END IF;

  -- FR-013: a satisfiable-but-under-configured pool pauses on the host's
  -- explicit choice rather than starting silently or rejecting outright.
  -- Outside automatic mode, compute_room_assignment_plan sets
  -- requiredPoolSize = relaxedFloor, so v_feasible is trivially true once the
  -- floor check above passes -- this branch never fires for host_assigned.
  IF NOT v_feasible AND NOT p_relax_constraints THEN
    RAISE EXCEPTION 'assignment_constraints_unsatisfiable';
  END IF;

  -- FR-005/FR-006: roster and pool are locked/fixed as of this point (the
  -- FOR UPDATE above), and both are shuffled here for a varied arrangement.
  SELECT array_agg(id ORDER BY random()) INTO v_participant_ids
  FROM public.participants WHERE session_id = p_session_id AND left_at IS NULL;
  v_p := array_length(v_participant_ids, 1);

  SELECT array_agg(id ORDER BY random()) INTO v_pool_ids
  FROM public.matches WHERE session_id = p_session_id AND id <> v_room.common_match_id;

  IF v_room.assignment_mode = 'host_assigned'::public.assignment_mode THEN
    -- FR-022 still holds, but selectively: only rows belonging to a
    -- participant no longer on the locked active roster are superseded here.
    -- Rows for active participants are the host's allocations and are kept.
    DELETE FROM public.assignments a
    WHERE a.session_id = p_session_id
      AND a.participant_id <> ALL (v_participant_ids);
  ELSE
    DELETE FROM public.assignments WHERE session_id = p_session_id;
  END IF;

  IF v_room.assignment_mode = 'host_assigned'::public.assignment_mode THEN
    -- FR-036: keep every match the host allocated, fill each participant's
    -- shortfall from the pool. A row equal to (participant, common_match_id)
    -- does not count toward their held additional matches (User Story 5's
    -- Common-Match-allocated-explicitly edge case is a no-op here; the
    -- ON CONFLICT DO NOTHING below is what makes it safe to have allocated).
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
    -- Constrained generation (specs/020 research.md R3): deal K shared
    -- matches to every pair, then top up each participant to the effective
    -- per-player count with private matches.
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
    -- Relaxed generation (FR-015): each participant independently draws
    -- effective_per_player matches at random from the pool minus the Common
    -- Match; overlap between participants is unconstrained.
    FOR v_i IN 1..v_p LOOP
      INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
      SELECT p_session_id, v_participant_ids[v_i], m.id, now()
      FROM public.matches m
      WHERE m.session_id = p_session_id AND m.id <> v_room.common_match_id
      ORDER BY random()
      LIMIT v_effective_per_player;
    END LOOP;
  END IF;

  -- FR-002: every active participant also holds the Common Match. ON
  -- CONFLICT DO NOTHING because host-assigned mode may have already inserted
  -- it explicitly for some participants (the no-op edge case above).
  INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
  SELECT p_session_id, unnest(v_participant_ids), v_room.common_match_id, now()
  ON CONFLICT (session_id, participant_id, match_id) DO NOTHING;

  SELECT count(*) INTO v_assignments_created FROM public.assignments WHERE session_id = p_session_id;

  SELECT id INTO v_host_participant_id FROM public.participants
  WHERE session_id = p_session_id AND account_id = v_account
    AND session_role = 'owner'::public.participant_session_role
  LIMIT 1;

  -- FR-023: settlement recorded in the room's auditable history.
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

  -- FR-016: the relaxation flag is carried in the start event's payload.
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

  -- research.md R5: which participants the server filled in, for the
  -- room's auditable history (FR-023) and for pgTAP, which calls this RPC
  -- directly. NOT surfaced to the client via the start-game HTTP response --
  -- the Java command-api's CommandResponse deliberately does not forward RPC
  -- internals (same boundary relaxedConstraints already lives behind). The
  -- host-facing echo of FR-037 is satisfied pre-start, in the lobby, from the
  -- same per-participant shortfall data the "still short" indicator already
  -- computes.
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
$$;
-- Signature unchanged from 036 -- existing REVOKE/GRANT carry over.
