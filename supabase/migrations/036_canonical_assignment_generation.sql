-- 036_canonical_assignment_generation.sql
-- US5.4 (#135): server-side canonical assignment generation on game start.
-- Builds on 035 (start_game_session, set_room_assignments) and 032
-- (build_guest_room_snapshot, join_room_as_registered). Adds two room-level
-- settings, a shared feasibility computation, generation inside
-- start_game_session under its existing row lock, a host-facing shortfall
-- override, and a correctness fix to the registered-join roster lock.
--
-- Scope is the #135 slice of specs/020-canonical-assignment-generation/spec.md
-- (Delivery Slices table): US1, US2, US4, US8 only. The assignment-mode column,
-- host-assigned allocation, player-picked selection, and mid-game reassignment
-- (#184/#185/#186) are out of scope here.

-- ---------------------------------------------------------------------------
-- Room settings (FR-028, FR-028a). Defaults keep an unconfigured room's pool
-- requirement linear (1 + P) rather than quadratic (1 + P(P-1)/2) -- see
-- research.md R4.
-- ---------------------------------------------------------------------------
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS matches_per_player int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shared_matches_per_pair int NOT NULL DEFAULT 0;

DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.game_sessions'::regclass
      AND conname = 'chk_game_sessions_matches_per_player_nonneg'
) THEN
  ALTER TABLE public.game_sessions
    ADD CONSTRAINT chk_game_sessions_matches_per_player_nonneg CHECK (matches_per_player >= 0);
END IF; END; $$;

DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.game_sessions'::regclass
      AND conname = 'chk_game_sessions_shared_matches_per_pair_nonneg'
) THEN
  ALTER TABLE public.game_sessions
    ADD CONSTRAINT chk_game_sessions_shared_matches_per_pair_nonneg CHECK (shared_matches_per_pair >= 0);
END IF; END; $$;

-- ---------------------------------------------------------------------------
-- private.compute_room_assignment_plan (contracts/room-rpcs.md #2)
-- Shared by the snapshot read and the start transition so feasibility is
-- computed once, in one place. Pure read: STABLE, no mutation -- this is what
-- lets the shortfall warning be resolved from a read rather than a paused
-- mutation (research.md R2).
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

  v_effective_per_player := GREATEST(
    v_room.matches_per_player,
    v_room.shared_matches_per_pair * GREATEST(v_participant_count - 1, 0)
  );

  v_required_pool_size := 1
    + v_room.shared_matches_per_pair * (v_participant_count * (v_participant_count - 1)) / 2
    + v_participant_count * (v_effective_per_player - v_room.shared_matches_per_pair * GREATEST(v_participant_count - 1, 0));

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
REVOKE ALL ON FUNCTION private.compute_room_assignment_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.compute_room_assignment_plan(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- build_guest_room_snapshot: add assignmentPlan (FR-024, FR-033). Additive
-- only -- existing keys, ordering, and types are unchanged (contracts/room-rpcs.md #3).
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
REVOKE ALL ON FUNCTION private.build_guest_room_snapshot(uuid)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION private.build_guest_room_snapshot(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- private/public.set_room_assignment_settings (FR-028 to FR-031)
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

  SELECT count(*) INTO v_participant_count FROM public.participants
  WHERE session_id = p_session_id AND left_at IS NULL;

  v_minimum := p_shared_matches_per_pair * GREATEST(v_participant_count - 1, 0);
  IF p_matches_per_player < v_minimum THEN
    RAISE EXCEPTION 'per_player_count_below_minimum';
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
REVOKE ALL ON FUNCTION private.set_room_assignment_settings(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_room_assignment_settings(uuid, int, int) TO service_role;

CREATE OR REPLACE FUNCTION public.set_room_assignment_settings(
    session_id uuid, matches_per_player int, shared_matches_per_pair int
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.set_room_assignment_settings(session_id, matches_per_player, shared_matches_per_pair);
$$;
REVOKE ALL ON FUNCTION public.set_room_assignment_settings(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_assignment_settings(uuid, int, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- start_game_session: rewrite with the full three-argument signature
-- (contracts/room-rpcs.md #4). CREATE OR REPLACE does not replace a function
-- of a different arity, so migration 035's two-argument versions must be
-- dropped first -- leaving them in place would create a second overload and
-- an ambiguous/stale-body call (research.md R1, task-planning note).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS private.start_game_session(uuid, uuid);
DROP FUNCTION IF EXISTS public.start_game_session(uuid, uuid);

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
  v_match_id uuid;
  v_assignments_created int;
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

  -- FR-019: assignments are no longer a start precondition -- the
  -- unassigned_participants guard that existed here in migration 035 is
  -- removed. Assignments are now a product of starting, computed below.

  v_plan := private.compute_room_assignment_plan(p_session_id);
  v_effective_per_player := (v_plan->>'effectivePerPlayer')::int;
  v_shared_per_pair := (v_plan->>'sharedMatchesPerPair')::int;
  v_relaxed_floor := (v_plan->>'relaxedFloor')::int;
  v_feasible := (v_plan->>'feasible')::boolean;

  -- FR-017: the arithmetic floor is never overridable, relaxed or not.
  IF v_match_count < v_relaxed_floor THEN
    RAISE EXCEPTION 'insufficient_match_pool';
  END IF;

  -- FR-013: a satisfiable-but-under-configured pool pauses on the host's
  -- explicit choice rather than starting silently or rejecting outright.
  IF NOT v_feasible AND NOT p_relax_constraints THEN
    RAISE EXCEPTION 'assignment_constraints_unsatisfiable';
  END IF;

  -- FR-022: any prior draft/settled assignments are superseded.
  DELETE FROM public.assignments WHERE session_id = p_session_id;

  -- FR-005/FR-006: roster and pool are locked/fixed as of this point (the
  -- FOR UPDATE above), and both are shuffled here for a varied arrangement.
  SELECT array_agg(id ORDER BY random()) INTO v_participant_ids
  FROM public.participants WHERE session_id = p_session_id AND left_at IS NULL;
  v_p := array_length(v_participant_ids, 1);

  SELECT array_agg(id ORDER BY random()) INTO v_pool_ids
  FROM public.matches WHERE session_id = p_session_id AND id <> v_room.common_match_id;

  -- By this point either v_feasible is true, or it is false and
  -- p_relax_constraints is true (the only infeasible case that survives the
  -- exception above) -- so branching on v_feasible alone is exhaustive and
  -- correct: constrained generation whenever the pool actually supports it,
  -- relaxed generation only in the one surviving infeasible case.
  IF v_feasible THEN
    -- Constrained generation (research.md R3): deal K shared matches to every
    -- pair, then top up each participant to the effective per-player count
    -- with private matches. Consumes exactly required_pool_size - 1 elements
    -- of v_pool_ids, which is guaranteed available because v_feasible was
    -- checked above -- this construction cannot fail once feasibility passes.
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

  -- FR-002: every active participant also holds the Common Match.
  INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
  SELECT p_session_id, unnest(v_participant_ids), v_room.common_match_id, now();

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
    jsonb_build_object('startedAt', now(), 'relaxedConstraints', (NOT v_feasible AND p_relax_constraints)),
    now()
  );

  RETURN jsonb_build_object(
    'status', 'started',
    'sessionId', p_session_id::text,
    'relaxedConstraints', (NOT v_feasible AND p_relax_constraints),
    'assignmentsCreated', v_assignments_created
  );
END;
$$;
REVOKE ALL ON FUNCTION private.start_game_session(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.start_game_session(uuid, uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.start_game_session(
    session_id uuid, idempotency_key uuid, relax_constraints boolean DEFAULT false
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.start_game_session(session_id, idempotency_key, relax_constraints);
$$;
REVOKE ALL ON FUNCTION public.start_game_session(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session(uuid, uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- join_room_as_registered: lock the room row before reading it, matching the
-- guest path in 026_guest_room_join.sql. Without this, under READ COMMITTED a
-- registered join can commit between start_game_session's row lock and its
-- roster enumeration, producing a started room with an unassigned participant
-- (research.md R6, contracts/room-rpcs.md #5). Only the room-read line
-- changes; behaviour and return shape are otherwise identical to migration 032.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.join_room_as_registered(p_join_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_join_code text := upper(btrim(coalesce(p_join_code, '')));
  v_room public.game_sessions %ROWTYPE;
  v_active uuid;
  v_display text;
  v_participant public.participants %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.join_code = v_join_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  -- Idempotent: already a participant (possibly soft-left) of this room?
  SELECT * INTO v_participant FROM public.participants p
  WHERE p.session_id = v_room.id AND p.account_id = v_account
  LIMIT 1;
  IF FOUND THEN
    IF v_participant.left_at IS NOT NULL THEN
      UPDATE public.participants SET left_at = NULL WHERE id = v_participant.id
      RETURNING * INTO v_participant;
    END IF;
    RETURN jsonb_build_object(
      'participantId', v_participant.id::text,
      'sessionId', v_room.id::text,
      'joinCode', v_room.join_code,
      'displayName', v_participant.display_name,
      'membershipType', v_participant.membership_type::text,
      'sessionRole', v_participant.session_role::text,
      'snapshot', private.build_guest_room_snapshot(v_room.id)
    );
  END IF;

  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  v_active := private.find_active_room_for(v_account);
  IF v_active IS NOT NULL AND v_active <> v_room.id THEN RAISE EXCEPTION 'already_in_active_room'; END IF;

  SELECT coalesce(NULLIF(btrim(accounts.preferred_display_name), ''), 'Player') INTO v_display
  FROM public.accounts accounts WHERE accounts.id = v_account;
  v_display := coalesce(v_display, 'Player');

  INSERT INTO public.participants (
    session_id, account_id, display_name, membership_type, session_role,
    current_drink_total, guest_rejoin_token_hash, created_at
  ) VALUES (
    v_room.id, v_account, v_display, 'registered'::public.participant_membership_type,
    'member'::public.participant_session_role, 0, NULL, now()
  ) RETURNING * INTO v_participant;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    v_room.id, public.allocate_event_sequence(v_room.id), v_participant.id, 'participant_joined',
    concat('registered-join:', v_account::text),
    jsonb_build_object('participantId', v_participant.id::text, 'displayName', v_display,
                       'membershipType', 'registered', 'sessionRole', 'member'),
    now()
  );

  RETURN jsonb_build_object(
    'participantId', v_participant.id::text,
    'sessionId', v_room.id::text,
    'joinCode', v_room.join_code,
    'displayName', v_display,
    'membershipType', 'registered',
    'sessionRole', 'member',
    'snapshot', private.build_guest_room_snapshot(v_room.id)
  );
END;
$$;
REVOKE ALL ON FUNCTION private.join_room_as_registered(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.join_room_as_registered(text) TO service_role;

CREATE OR REPLACE FUNCTION public.join_room_as_registered(join_code text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.join_room_as_registered(join_code);
$$;
REVOKE ALL ON FUNCTION public.join_room_as_registered(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_as_registered(text) TO authenticated;
