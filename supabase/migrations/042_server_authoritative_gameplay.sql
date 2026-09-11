-- 042_server_authoritative_gameplay.sql
-- Server-authoritative active gameplay for issue #190.
--
-- This migration is additive. Existing event types and #186 reassignment/
-- completion functions remain valid; new participant commands serialize on the
-- game_sessions row, append immutable events, and return sequence-fenced results.

-- ---------------------------------------------------------------------------
-- Event vocabulary and direct-RPC replay records
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
      'manual_score_changed',
      'provider_score_changed',
      'drink_changed',
      'session_started',
      'session_completed'
    )
  );

CREATE TABLE IF NOT EXISTS public.gameplay_command_results (
  session_id uuid NOT NULL REFERENCES public.game_sessions(id),
  idempotency_key uuid NOT NULL,
  command_type text NOT NULL,
  actor_participant_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, idempotency_key),
  CONSTRAINT fk_gameplay_command_results_actor
    FOREIGN KEY (session_id, actor_participant_id)
    REFERENCES public.participants(session_id, id)
);

ALTER TABLE public.gameplay_command_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gameplay_command_results FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gameplay_command_results TO service_role;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source_league_code text;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS chk_matches_source_league_code;
ALTER TABLE public.matches
  ADD CONSTRAINT chk_matches_source_league_code CHECK (
    source_league_code IS NULL OR btrim(source_league_code) <> ''
  );

CREATE TABLE IF NOT EXISTS private.provider_score_refresh_leases (
  session_id uuid PRIMARY KEY REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  not_before timestamptz NOT NULL
);

ALTER TABLE private.provider_score_refresh_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.provider_score_refresh_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.provider_score_refresh_leases TO service_role;

CREATE INDEX IF NOT EXISTS idx_gameplay_command_results_session_created
  ON public.gameplay_command_results(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gameplay_command_results_actor
  ON public.gameplay_command_results(session_id, actor_participant_id);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.authoritative_snapshot(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_snapshot jsonb;
  v_matches jsonb;
BEGIN
  v_snapshot := private.build_guest_room_snapshot(p_session_id);

  SELECT COALESCE(
    jsonb_agg(
      match_item.value || jsonb_build_object(
        'sourceLeagueCode', matches.source_league_code
      )
      ORDER BY match_item.ordinality
    ),
    '[]'::jsonb
  ) INTO v_matches
  FROM jsonb_array_elements(COALESCE(v_snapshot->'matches', '[]'::jsonb))
    WITH ORDINALITY AS match_item(value, ordinality)
  JOIN public.matches matches
    ON matches.id = (match_item.value->>'id')::uuid
   AND matches.session_id = p_session_id;

  RETURN jsonb_set(v_snapshot, '{matches}', v_matches, true)
    || jsonb_build_object(
      'ownerParticipantId', (
        SELECT p.id::text
        FROM public.participants p
        JOIN public.game_sessions gs ON gs.owner_account_id = p.account_id
          AND gs.id = p_session_id
        WHERE p.session_id = p_session_id
          AND p.session_role = 'owner'::public.participant_session_role
          AND p.left_at IS NULL
        ORDER BY p.created_at, p.id
        LIMIT 1
      ),
      'lastEventSequence', (
        SELECT gs.last_event_sequence
        FROM public.game_sessions gs
        WHERE gs.id = p_session_id
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION private.authoritative_snapshot(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.authoritative_snapshot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.require_registered_participant(
  p_session_id uuid
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_participant_id uuid;
BEGIN
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.id INTO v_participant_id
  FROM public.participants p
  WHERE p.session_id = p_session_id
    AND p.account_id = v_account
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND p.left_at IS NULL
  LIMIT 1;

  IF v_participant_id IS NULL THEN
    RAISE EXCEPTION 'not_room_participant';
  END IF;
  RETURN v_participant_id;
END;
$$;

REVOKE ALL ON FUNCTION private.require_registered_participant(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.require_registered_participant(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.require_registered_participant_for_account(
  p_session_id uuid,
  p_account_id uuid
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_participant_id uuid;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.id INTO v_participant_id
  FROM public.participants p
  WHERE p.session_id = p_session_id
    AND p.account_id = p_account_id
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND p.left_at IS NULL
  LIMIT 1;

  IF v_participant_id IS NULL THEN
    RAISE EXCEPTION 'not_room_participant';
  END IF;
  RETURN v_participant_id;
END;
$$;

REVOKE ALL ON FUNCTION private.require_registered_participant_for_account(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.require_registered_participant_for_account(uuid, uuid)
  TO service_role;

-- New clients preserve the provider league without breaking the deployed
-- six-argument add_room_match contract.
CREATE OR REPLACE FUNCTION private.add_room_match_v2(
  p_session_id uuid,
  p_source_provider text,
  p_source_match_id text,
  p_source_league_code text,
  p_home_team_name text,
  p_away_team_name text,
  p_kickoff_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_match_id uuid;
BEGIN
  IF lower(btrim(coalesce(p_source_provider, ''))) <> 'manual'
     AND nullif(btrim(coalesce(p_source_league_code, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_provider_metadata';
  END IF;

  v_match_id := private.add_room_match(
    p_session_id, p_source_provider, p_source_match_id,
    p_home_team_name, p_away_team_name, p_kickoff_at
  );

  UPDATE public.matches
  SET source_league_code = nullif(btrim(p_source_league_code), '')
  WHERE id = v_match_id
    AND source_league_code IS DISTINCT FROM nullif(btrim(p_source_league_code), '');

  RETURN v_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_room_match_v2(
  session_id uuid,
  source_provider text,
  source_match_id text,
  source_league_code text,
  home_team_name text,
  away_team_name text,
  kickoff_at timestamptz
) RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.add_room_match_v2(
  session_id, source_provider, source_match_id, source_league_code,
  home_team_name, away_team_name, kickoff_at
);
$$;

REVOKE ALL ON FUNCTION private.add_room_match_v2(uuid, text, text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_room_match_v2(uuid, text, text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.add_room_match_v2(uuid, text, text, text, text, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.add_room_match_v2(uuid, text, text, text, text, text, timestamptz)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.add_room_matches(
  p_session_id uuid,
  p_matches jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_match jsonb;
  v_added int := 0;
  v_skipped int := 0;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RETURN jsonb_build_object('added', 0, 'skipped', 0);
  END IF;

  FOR v_match IN SELECT * FROM jsonb_array_elements(p_matches) LOOP
    IF lower(btrim(coalesce(v_match->>'sourceProvider', ''))) <> 'manual'
       AND v_match ? 'sourceLeagueCode'
       AND nullif(btrim(coalesce(v_match->>'sourceLeagueCode', '')), '') IS NULL THEN
      RAISE EXCEPTION 'invalid_provider_metadata';
    END IF;

    BEGIN
      INSERT INTO public.matches (
        session_id, source_provider, source_match_id, source_league_code,
        home_team_name, away_team_name, kickoff_at
      ) VALUES (
        p_session_id,
        v_match->>'sourceProvider',
        v_match->>'sourceMatchId',
        nullif(btrim(v_match->>'sourceLeagueCode'), ''),
        v_match->>'homeTeamName',
        v_match->>'awayTeamName',
        (v_match->>'kickoffAt')::timestamptz
      );
      v_added := v_added + 1;
    EXCEPTION WHEN unique_violation THEN
      UPDATE public.matches
      SET source_league_code = COALESCE(
        source_league_code,
        nullif(btrim(v_match->>'sourceLeagueCode'), '')
      )
      WHERE session_id = p_session_id
        AND source_provider = v_match->>'sourceProvider'
        AND source_match_id = v_match->>'sourceMatchId';
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('added', v_added, 'skipped', v_skipped);
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_guest_participant(
  p_guest_token text
) RETURNS public.participants
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_token text := btrim(coalesce(p_guest_token, ''));
  v_hash text;
  v_participant public.participants;
BEGIN
  IF v_token = '' THEN
    RAISE EXCEPTION 'guest_token_expired';
  END IF;

  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  SELECT p.* INTO v_participant
  FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
    AND p.left_at IS NULL
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_token_expired';
  END IF;
  RETURN v_participant;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_guest_participant(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.resolve_guest_participant(text)
  TO service_role;

CREATE OR REPLACE FUNCTION private.command_result_or_conflict(
  p_session_id uuid,
  p_idempotency_key uuid,
  p_command_type text,
  p_actor_participant_id uuid,
  p_request_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_result public.gameplay_command_results;
BEGIN
  SELECT r.* INTO v_result
  FROM public.gameplay_command_results r
  WHERE r.session_id = p_session_id
    AND r.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_result.command_type <> p_command_type
       OR v_result.actor_participant_id <> p_actor_participant_id
       OR v_result.request_fingerprint <> p_request_fingerprint THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN v_result.response || jsonb_build_object('replayed', true);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.command_result_or_conflict(uuid, uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.command_result_or_conflict(uuid, uuid, text, uuid, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Canonical snapshot reads (registered + guest)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_room_snapshot(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT gs.* INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF NOT private.can_access_session(p_session_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_room.state = 'in_progress'::public.session_state
     AND NOT EXISTS (
       SELECT 1 FROM public.participants p
       WHERE p.session_id = p_session_id
         AND p.account_id = v_account
         AND p.left_at IS NULL
     )
     AND v_room.owner_account_id IS DISTINCT FROM v_account THEN
    RAISE EXCEPTION 'not_room_participant';
  END IF;
  RETURN private.authoritative_snapshot(p_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_room_snapshot(session_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.get_room_snapshot(session_id);
$$;

REVOKE ALL ON FUNCTION private.get_room_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_room_snapshot(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_room_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_snapshot(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.get_guest_room_snapshot(p_guest_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_participant public.participants;
BEGIN
  v_participant := private.resolve_guest_participant(p_guest_token);
  RETURN private.authoritative_snapshot(v_participant.session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_guest_room_snapshot(guest_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.get_guest_room_snapshot(guest_token);
$$;

REVOKE ALL ON FUNCTION private.get_guest_room_snapshot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_guest_room_snapshot(text) TO service_role;
REVOKE ALL ON FUNCTION public.get_guest_room_snapshot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_room_snapshot(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Manual score command
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.change_manual_score_for_participant(
  p_session_id uuid,
  p_actor_participant_id uuid,
  p_match_id uuid,
  p_team text,
  p_delta_goals integer,
  p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room public.game_sessions;
  v_match public.matches;
  v_fingerprint text;
  v_replay jsonb;
  v_previous integer;
  v_resulting integer;
  v_sequence bigint;
  v_event_id uuid;
  v_response jsonb;
BEGIN
  IF p_session_id IS NULL OR p_actor_participant_id IS NULL
     OR p_match_id IS NULL OR p_idempotency_key IS NULL
     OR p_team NOT IN ('home', 'away') OR p_delta_goals NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'invalid_delta';
  END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.session_id = p_session_id AND p.id = p_actor_participant_id
      AND p.left_at IS NULL
  ) THEN RAISE EXCEPTION 'not_room_participant'; END IF;

  v_fingerprint := encode(extensions.digest(
    concat('manual-score:', p_match_id::text, ':', p_team, ':', p_delta_goals::text),
    'sha256'), 'hex');
  v_replay := private.command_result_or_conflict(
    p_session_id, p_idempotency_key, 'manual_score',
    p_actor_participant_id, v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT m.* INTO v_match FROM public.matches m
  WHERE m.session_id = p_session_id AND m.id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_in_room'; END IF;
  IF lower(v_match.source_provider) <> 'manual' THEN
    RAISE EXCEPTION 'provider_score_required';
  END IF;

  v_previous := CASE WHEN p_team = 'home' THEN v_match.home_score ELSE v_match.away_score END;
  v_resulting := v_previous + p_delta_goals;
  IF v_resulting < 0 THEN RAISE EXCEPTION 'negative_result'; END IF;

  IF p_team = 'home' THEN
    UPDATE public.matches SET home_score = v_resulting WHERE id = p_match_id;
  ELSE
    UPDATE public.matches SET away_score = v_resulting WHERE id = p_match_id;
  END IF;

  v_sequence := public.allocate_event_sequence(p_session_id);
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, v_sequence, p_actor_participant_id, 'manual_score_changed',
    p_idempotency_key::text,
    jsonb_build_object(
      'sessionId', p_session_id::text, 'matchId', p_match_id::text,
      'team', p_team, 'deltaGoals', p_delta_goals,
      'previousScore', v_previous, 'resultingScore', v_resulting,
      'homeScore', CASE WHEN p_team = 'home' THEN v_resulting ELSE v_match.home_score END,
      'awayScore', CASE WHEN p_team = 'away' THEN v_resulting ELSE v_match.away_score END,
      'origin', 'manual', 'requestFingerprint', v_fingerprint,
      'sequenceNumber', v_sequence, 'replayed', false
    ), now()
  ) RETURNING id INTO v_event_id;

  v_response := jsonb_build_object(
    'sessionId', p_session_id::text, 'matchId', p_match_id::text,
    'team', p_team, 'deltaGoals', p_delta_goals,
    'previousScore', v_previous, 'resultingScore', v_resulting,
    'homeScore', CASE WHEN p_team = 'home' THEN v_resulting ELSE v_match.home_score END,
    'awayScore', CASE WHEN p_team = 'away' THEN v_resulting ELSE v_match.away_score END,
    'origin', 'manual', 'eventId', v_event_id::text,
    'sequenceNumber', v_sequence, 'replayed', false,
    'requestFingerprint', v_fingerprint
  );
  INSERT INTO public.gameplay_command_results (
    session_id, idempotency_key, command_type, actor_participant_id,
    request_fingerprint, response
  ) VALUES (
    p_session_id, p_idempotency_key, 'manual_score', p_actor_participant_id,
    v_fingerprint, v_response
  );
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION private.change_manual_score(
  p_session_id uuid, p_match_id uuid, p_team text,
  p_delta_goals integer, p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN private.change_manual_score_for_participant(
    p_session_id, private.require_registered_participant(p_session_id),
    p_match_id, p_team, p_delta_goals, p_idempotency_key);
END;
$$;

CREATE OR REPLACE FUNCTION private.change_manual_score_as_guest(
  p_guest_token text, p_match_id uuid, p_team text,
  p_delta_goals integer, p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_participant public.participants;
BEGIN
  v_participant := private.resolve_guest_participant(p_guest_token);
  RETURN private.change_manual_score_for_participant(
    v_participant.session_id, v_participant.id,
    p_match_id, p_team, p_delta_goals, p_idempotency_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_manual_score(
  session_id uuid, match_id uuid, team text,
  delta_goals integer, idempotency_key uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.change_manual_score(session_id, match_id, team, delta_goals, idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.change_manual_score_as_guest(
  guest_token text, match_id uuid, team text,
  delta_goals integer, idempotency_key uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.change_manual_score_as_guest(guest_token, match_id, team, delta_goals, idempotency_key);
$$;

REVOKE ALL ON FUNCTION private.change_manual_score_for_participant(uuid, uuid, uuid, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.change_manual_score(uuid, uuid, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.change_manual_score_as_guest(text, uuid, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_manual_score(uuid, uuid, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_manual_score_as_guest(text, uuid, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.change_manual_score_for_participant(uuid, uuid, uuid, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.change_manual_score(uuid, uuid, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.change_manual_score_as_guest(text, uuid, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_manual_score(uuid, uuid, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_manual_score_as_guest(text, uuid, text, integer, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Drink command (half-drink integer boundary)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.change_participant_drink_for_actor(
  p_session_id uuid, p_actor_participant_id uuid, p_target_participant_id uuid,
  p_delta_half_drinks integer, p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room public.game_sessions;
  v_target public.participants;
  v_fingerprint text;
  v_replay jsonb;
  v_previous numeric(6,1);
  v_resulting numeric(6,1);
  v_sequence bigint;
  v_event_id uuid;
  v_response jsonb;
BEGIN
  IF p_session_id IS NULL OR p_actor_participant_id IS NULL
     OR p_target_participant_id IS NULL OR p_idempotency_key IS NULL
     OR p_delta_half_drinks NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'invalid_delta';
  END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.session_id = p_session_id AND p.id = p_actor_participant_id
      AND p.left_at IS NULL
  ) THEN RAISE EXCEPTION 'not_room_participant'; END IF;

  v_fingerprint := encode(extensions.digest(
    concat('drink:', p_target_participant_id::text, ':', p_delta_half_drinks::text),
    'sha256'), 'hex');
  v_replay := private.command_result_or_conflict(
    p_session_id, p_idempotency_key, 'drink',
    p_actor_participant_id, v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT p.* INTO v_target FROM public.participants p
  WHERE p.session_id = p_session_id AND p.id = p_target_participant_id
    AND p.left_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'target_inactive'; END IF;

  v_previous := v_target.current_drink_total;
  v_resulting := v_previous + (p_delta_half_drinks * 0.5)::numeric;
  IF v_resulting < 0 THEN RAISE EXCEPTION 'negative_result'; END IF;

  UPDATE public.participants SET current_drink_total = v_resulting
  WHERE id = p_target_participant_id;
  v_sequence := public.allocate_event_sequence(p_session_id);

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, v_sequence, p_actor_participant_id, 'drink_changed',
    p_idempotency_key::text,
    jsonb_build_object(
      'sessionId', p_session_id::text,
      'participantId', p_target_participant_id::text,
      'deltaHalfDrinks', p_delta_half_drinks,
      'previousTotal', v_previous, 'resultingTotal', v_resulting,
      'requestFingerprint', v_fingerprint, 'sequenceNumber', v_sequence,
      'replayed', false
    ), now()
  ) RETURNING id INTO v_event_id;

  v_response := jsonb_build_object(
    'sessionId', p_session_id::text,
    'participantId', p_target_participant_id::text,
    'deltaHalfDrinks', p_delta_half_drinks,
    'currentDrinkTotal', v_resulting,
    'eventId', v_event_id::text, 'sequenceNumber', v_sequence,
    'replayed', false, 'requestFingerprint', v_fingerprint
  );
  INSERT INTO public.gameplay_command_results (
    session_id, idempotency_key, command_type, actor_participant_id,
    request_fingerprint, response
  ) VALUES (
    p_session_id, p_idempotency_key, 'drink', p_actor_participant_id,
    v_fingerprint, v_response
  );
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION private.change_participant_drink(
  p_session_id uuid, p_target_participant_id uuid,
  p_delta_half_drinks integer, p_idempotency_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN private.change_participant_drink_for_actor(
    p_session_id, private.require_registered_participant(p_session_id),
    p_target_participant_id, p_delta_half_drinks, p_idempotency_key);
END;
$$;

CREATE OR REPLACE FUNCTION private.change_participant_drink_as_guest(
  p_guest_token text, p_target_participant_id uuid,
  p_delta_half_drinks integer, p_idempotency_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_participant public.participants;
BEGIN
  v_participant := private.resolve_guest_participant(p_guest_token);
  RETURN private.change_participant_drink_for_actor(
    v_participant.session_id, v_participant.id,
    p_target_participant_id, p_delta_half_drinks, p_idempotency_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_participant_drink(
  session_id uuid, participant_id uuid,
  delta_half_drinks integer, idempotency_key uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.change_participant_drink(session_id, participant_id, delta_half_drinks, idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.change_participant_drink_as_guest(
  guest_token text, participant_id uuid,
  delta_half_drinks integer, idempotency_key uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.change_participant_drink_as_guest(guest_token, participant_id, delta_half_drinks, idempotency_key);
$$;

REVOKE ALL ON FUNCTION private.change_participant_drink_for_actor(uuid, uuid, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.change_participant_drink(uuid, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.change_participant_drink_as_guest(text, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_participant_drink(uuid, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_participant_drink_as_guest(text, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.change_participant_drink_for_actor(uuid, uuid, uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.change_participant_drink(uuid, uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.change_participant_drink_as_guest(text, uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_participant_drink(uuid, uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_participant_drink_as_guest(text, uuid, integer, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trusted provider absolute score command (Edge Function only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.accept_provider_score_for_actor(
  p_session_id uuid, p_actor_participant_id uuid, p_match_id uuid,
  p_provider text, p_source_match_id text, p_home_score integer,
  p_away_score integer, p_observed_at timestamptz, p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room public.game_sessions;
  v_match public.matches;
  v_fingerprint text;
  v_replay jsonb;
  v_sequence bigint;
  v_event_id uuid;
  v_response jsonb;
  v_changed boolean;
BEGIN
  IF p_session_id IS NULL OR p_actor_participant_id IS NULL
     OR p_match_id IS NULL OR p_idempotency_key IS NULL
     OR nullif(btrim(coalesce(p_provider, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_source_match_id, '')), '') IS NULL
     OR p_home_score IS NULL OR p_away_score IS NULL
     OR p_home_score < 0 OR p_away_score < 0 THEN
    RAISE EXCEPTION 'invalid_provider_score';
  END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.session_id = p_session_id AND p.id = p_actor_participant_id
      AND p.membership_type = 'registered'::public.participant_membership_type
      AND p.left_at IS NULL
  ) THEN RAISE EXCEPTION 'not_room_participant'; END IF;

  v_fingerprint := encode(extensions.digest(
    concat('provider:', p_match_id::text, ':', p_provider, ':',
      p_source_match_id, ':', p_home_score::text, ':', p_away_score::text),
    'sha256'), 'hex');
  v_replay := private.command_result_or_conflict(
    p_session_id, p_idempotency_key, 'provider_score',
    p_actor_participant_id, v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT m.* INTO v_match FROM public.matches m
  WHERE m.session_id = p_session_id AND m.id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_in_room'; END IF;
  IF lower(v_match.source_provider) = 'manual'
     OR v_match.source_provider <> p_provider
     OR v_match.source_match_id IS DISTINCT FROM p_source_match_id THEN
    RAISE EXCEPTION 'provider_match_mismatch';
  END IF;

  v_changed := v_match.home_score <> p_home_score OR v_match.away_score <> p_away_score;
  UPDATE public.matches SET home_score = p_home_score, away_score = p_away_score
  WHERE id = p_match_id;

  IF v_changed THEN
    v_sequence := public.allocate_event_sequence(p_session_id);
    INSERT INTO public.gameplay_events (
      session_id, sequence_number, actor_participant_id, event_type,
      idempotency_key, payload, created_at
    ) VALUES (
      p_session_id, v_sequence, p_actor_participant_id, 'provider_score_changed',
      p_idempotency_key::text,
      jsonb_build_object(
        'sessionId', p_session_id::text, 'matchId', p_match_id::text,
        'provider', p_provider, 'sourceMatchId', p_source_match_id,
        'previousHomeScore', v_match.home_score,
        'previousAwayScore', v_match.away_score,
        'resultingHomeScore', p_home_score,
        'resultingAwayScore', p_away_score,
        'origin', 'provider', 'observedAt', p_observed_at,
        'requestFingerprint', v_fingerprint, 'sequenceNumber', v_sequence,
        'replayed', false
      ), now()
    ) RETURNING id INTO v_event_id;
  ELSE
    v_sequence := v_room.last_event_sequence;
  END IF;

  v_response := jsonb_build_object(
    'sessionId', p_session_id::text, 'matchId', p_match_id::text,
    'provider', p_provider, 'sourceMatchId', p_source_match_id,
    'homeScore', p_home_score, 'awayScore', p_away_score,
    'origin', 'provider', 'changed', v_changed,
    'eventId', v_event_id::text, 'sequenceNumber', v_sequence,
    'replayed', false, 'requestFingerprint', v_fingerprint
  );
  INSERT INTO public.gameplay_command_results (
    session_id, idempotency_key, command_type, actor_participant_id,
    request_fingerprint, response
  ) VALUES (
    p_session_id, p_idempotency_key, 'provider_score', p_actor_participant_id,
    v_fingerprint, v_response
  );
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION private.accept_provider_score_for_actor(uuid, uuid, uuid, text, text, integer, integer, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.accept_provider_score_for_actor(uuid, uuid, uuid, text, text, integer, integer, timestamptz, uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.claim_provider_score_refresh(
  p_session_id uuid,
  p_actor_account_id uuid,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room public.game_sessions;
  v_actor_participant_id uuid;
  v_lease private.provider_score_refresh_leases;
  v_now timestamptz := clock_timestamp();
  v_not_before timestamptz;
BEGIN
  IF p_session_id IS NULL OR p_actor_account_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid_provider_refresh';
  END IF;

  SELECT gs.* INTO v_room
  FROM public.game_sessions gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  v_actor_participant_id := private.require_registered_participant_for_account(
    p_session_id, p_actor_account_id
  );
  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT lease.* INTO v_lease
  FROM private.provider_score_refresh_leases lease
  WHERE lease.session_id = p_session_id
  FOR UPDATE;

  IF FOUND AND v_lease.not_before > v_now THEN
    RETURN jsonb_build_object(
      'status', 'not_due',
      'sessionId', p_session_id::text,
      'requestId', p_request_id::text,
      'notBefore', v_lease.not_before,
      'matches', '[]'::jsonb
    );
  END IF;

  v_not_before := v_now + interval '60 seconds';
  INSERT INTO private.provider_score_refresh_leases(session_id, request_id, not_before)
  VALUES (p_session_id, p_request_id, v_not_before)
  ON CONFLICT (session_id) DO UPDATE
  SET request_id = EXCLUDED.request_id,
      not_before = EXCLUDED.not_before;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'sessionId', p_session_id::text,
    'requestId', p_request_id::text,
    'actorParticipantId', v_actor_participant_id::text,
    'notBefore', v_not_before,
    'matches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'matchId', m.id::text,
        'provider', lower(m.source_provider),
        'sourceMatchId', m.source_match_id,
        'sourceLeagueCode', m.source_league_code,
        'kickoffAt', m.kickoff_at
      ) ORDER BY m.created_at, m.id)
      FROM public.matches m
      WHERE m.session_id = p_session_id
        AND lower(m.source_provider) <> 'manual'
        AND m.source_match_id IS NOT NULL
        AND m.kickoff_at IS NOT NULL
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_provider_score_refresh(
  session_id uuid,
  actor_account_id uuid,
  request_id uuid
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
SELECT private.claim_provider_score_refresh(session_id, actor_account_id, request_id);
$$;

CREATE OR REPLACE FUNCTION private.accept_provider_score_batch_from_edge(
  p_session_id uuid,
  p_actor_account_id uuid,
  p_request_id uuid,
  p_observations jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room public.game_sessions;
  v_actor_participant_id uuid;
  v_lease private.provider_score_refresh_leases;
  v_observation jsonb;
  v_match public.matches;
  v_match_id uuid;
  v_source_match_id text;
  v_source_league_code text;
  v_home_score integer;
  v_away_score integer;
  v_match_key uuid;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF p_session_id IS NULL OR p_actor_account_id IS NULL OR p_request_id IS NULL
     OR p_observations IS NULL OR jsonb_typeof(p_observations) <> 'array'
     OR jsonb_array_length(p_observations) > 100 THEN
    RAISE EXCEPTION 'invalid_provider_refresh';
  END IF;

  SELECT gs.* INTO v_room
  FROM public.game_sessions gs
  WHERE gs.id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  v_actor_participant_id := private.require_registered_participant_for_account(
    p_session_id, p_actor_account_id
  );
  IF v_room.state <> 'in_progress'::public.session_state THEN
    RAISE EXCEPTION 'invalid_room_state';
  END IF;

  SELECT lease.* INTO v_lease
  FROM private.provider_score_refresh_leases lease
  WHERE lease.session_id = p_session_id
  FOR UPDATE;
  IF NOT FOUND OR v_lease.request_id <> p_request_id THEN
    RAISE EXCEPTION 'stale_provider_refresh';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_observations) observation
    GROUP BY observation->>'matchId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_provider_observation';
  END IF;

  FOR v_observation IN SELECT * FROM jsonb_array_elements(p_observations) LOOP
    BEGIN
      v_match_id := (v_observation->>'matchId')::uuid;
      v_home_score := (v_observation->>'homeScore')::integer;
      v_away_score := (v_observation->>'awayScore')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_provider_score';
    END;

    v_source_match_id := nullif(btrim(coalesce(v_observation->>'sourceMatchId', '')), '');
    v_source_league_code := nullif(btrim(coalesce(v_observation->>'sourceLeagueCode', '')), '');

    IF v_match_id IS NULL OR v_source_match_id IS NULL
       OR v_source_league_code IS NULL
       OR v_home_score IS NULL OR v_away_score IS NULL
       OR v_home_score < 0 OR v_away_score < 0 THEN
      RAISE EXCEPTION 'invalid_provider_score';
    END IF;

    SELECT m.* INTO v_match
    FROM public.matches m
    WHERE m.session_id = p_session_id AND m.id = v_match_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'match_not_in_room'; END IF;
    IF lower(v_match.source_provider) <> 'espn'
       OR v_match.source_match_id IS DISTINCT FROM v_source_match_id
       OR (v_match.source_league_code IS NOT NULL
           AND v_match.source_league_code IS DISTINCT FROM v_source_league_code) THEN
      RAISE EXCEPTION 'provider_match_mismatch';
    END IF;

    IF v_match.source_league_code IS NULL AND v_source_league_code IS NOT NULL THEN
      UPDATE public.matches
      SET source_league_code = v_source_league_code
      WHERE id = v_match_id;
    END IF;

    -- md5 is used only to deterministically fit request+match identity into the
    -- existing uuid idempotency column; it is not a security primitive.
    v_match_key := md5(p_request_id::text || ':' || v_match_id::text)::uuid;
    v_result := private.accept_provider_score_for_actor(
      p_session_id,
      v_actor_participant_id,
      v_match_id,
      'espn',
      v_source_match_id,
      v_home_score,
      v_away_score,
      clock_timestamp(),
      v_match_key
    );
    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  RETURN jsonb_build_object(
    'sessionId', p_session_id::text,
    'requestId', p_request_id::text,
    'refreshedAt', clock_timestamp(),
    'results', v_results
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_provider_score_batch_from_edge(
  session_id uuid,
  actor_account_id uuid,
  request_id uuid,
  observations jsonb
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
SELECT private.accept_provider_score_batch_from_edge(
  session_id, actor_account_id, request_id, observations
);
$$;

REVOKE ALL ON FUNCTION private.claim_provider_score_refresh(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_provider_score_refresh(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.accept_provider_score_batch_from_edge(uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_provider_score_batch_from_edge(uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.claim_provider_score_refresh(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_provider_score_refresh(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION private.accept_provider_score_batch_from_edge(uuid, uuid, uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_provider_score_batch_from_edge(uuid, uuid, uuid, jsonb)
  TO service_role;
