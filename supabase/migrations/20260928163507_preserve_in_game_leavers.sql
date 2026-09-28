-- Issue #165: retain played participants in shared snapshots.
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
            'currentDrinkTotal', participants.current_drink_total,
            'leftAt', participants.left_at
          )
          ORDER BY participants.created_at, participants.id
        )
        FROM public.participants participants
        WHERE participants.session_id = game_sessions.id
          AND (participants.left_at IS NULL
            OR (game_sessions.started_at IS NOT NULL
              AND participants.left_at >= game_sessions.started_at))
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
            'currentDrinkTotal', participants.current_drink_total,
            'leftAt', participants.left_at
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

-- Lobby leavers did not play; an in-progress leaver did. Keep that distinction
-- in final history as well as the live snapshot.
CREATE OR REPLACE VIEW private._history_completed_participants
WITH (security_invoker = true) AS
SELECT p.session_id, p.id AS participant_id, p.account_id, p.display_name,
       p.membership_type, p.current_drink_total, p.created_at,
       names.preferred_display_name AS account_display_name, p.left_at
FROM public.participants p
JOIN private._history_completed_sessions completed
  ON completed.session_id = p.session_id
LEFT JOIN private._history_account_display_names names
  ON names.account_id = p.account_id
JOIN public.game_sessions gs ON gs.id = p.session_id
WHERE p.left_at IS NULL OR (gs.started_at IS NOT NULL AND p.left_at >= gs.started_at);

-- The departure result is captured after left_at changes, inside the same
-- room-locked transaction as the leave. The active roster still excludes the
-- leaver, while participants now retains every player who took part.
CREATE OR REPLACE FUNCTION private.capture_in_game_departure()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_state public.session_state;
  v_left_at timestamptz;
  v_snapshot jsonb;
BEGIN
  IF NEW.event_type::text <> 'participant_left' THEN RETURN NEW; END IF;
  SELECT state INTO v_state FROM public.game_sessions WHERE id = NEW.session_id;
  IF v_state <> 'in_progress'::public.session_state THEN RETURN NEW; END IF;
  SELECT left_at INTO v_left_at FROM public.participants
  WHERE id = NEW.actor_participant_id AND session_id = NEW.session_id;
  IF v_left_at IS NULL THEN RAISE EXCEPTION 'departure_not_confirmed'; END IF;
  v_snapshot := private.build_guest_room_snapshot(NEW.session_id)
    - 'joinCode' - 'activeRoster' - 'picks';
  NEW.payload := COALESCE(NEW.payload, '{}'::jsonb) || jsonb_build_object(
    'leftAt', v_left_at,
    'historySnapshot', v_snapshot
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.capture_in_game_departure()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS capture_in_game_departure ON public.gameplay_events;
CREATE TRIGGER capture_in_game_departure
  BEFORE INSERT ON public.gameplay_events
  FOR EACH ROW EXECUTE FUNCTION private.capture_in_game_departure();

-- Preserve joinable leave semantics, but commit a real departure during play.
CREATE OR REPLACE FUNCTION private.leave_room_as_member(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions;
  v_participant public.participants;
  v_event_payload jsonb;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs
  WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left'); END IF;
  IF v_room.owner_account_id = v_account THEN RAISE EXCEPTION 'use_leave_room_as_host'; END IF;
  IF v_room.state NOT IN ('joinable'::public.session_state, 'in_progress'::public.session_state) THEN
    RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left');
  END IF;

  SELECT * INTO v_participant FROM public.participants p
  WHERE p.session_id = p_session_id AND p.account_id = v_account
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND p.left_at IS NULL
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left');
  END IF;

  UPDATE public.participants SET left_at = now() WHERE id = v_participant.id;
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_participant.id,
    'participant_left', concat('member-left:', v_participant.id::text),
    jsonb_build_object('participantId', v_participant.id::text,
                       'membershipType', 'registered'), now()
  ) RETURNING payload INTO v_event_payload;

  IF v_room.state = 'in_progress'::public.session_state THEN
    RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left',
      'result', v_event_payload -> 'historySnapshot',
      'leftAt', v_event_payload ->> 'leftAt');
  END IF;
  RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left');
END;
$$;
REVOKE ALL ON FUNCTION private.leave_room_as_member(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.leave_room_as_member(uuid) TO service_role;

-- The existing guest grant validator/room lock remains in force. Return the
-- atomic capture on confirmed in-progress departure before clearing the bearer.
CREATE OR REPLACE FUNCTION private.leave_room_as_guest(p_guest_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash text;
  v_session_id uuid;
  v_room public.game_sessions;
  v_guest public.participants;
  v_event_payload jsonb;
BEGIN
  IF btrim(coalesce(p_guest_token, '')) = '' OR length(p_guest_token) > 128 THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  v_hash := encode(extensions.digest(btrim(p_guest_token), 'sha256'), 'hex');
  SELECT p.session_id INTO v_session_id FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'status', 'already_invalid'); END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = v_session_id FOR UPDATE;
  IF NOT FOUND OR v_room.state = 'closed'::public.session_state THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  SELECT p.* INTO v_guest FROM public.participants p
  WHERE p.session_id = v_session_id
    AND p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
  FOR UPDATE;
  IF NOT FOUND OR v_guest.guest_grant_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  IF v_guest.left_at IS NOT NULL THEN
    -- A lost response can be retried with the same still-valid bearer. This
    -- returns only that guest's immutable departure result, never live room data.
    SELECT e.payload INTO v_event_payload FROM public.gameplay_events e
    WHERE e.session_id = v_session_id
      AND e.actor_participant_id = v_guest.id
      AND e.event_type = 'participant_left'
      AND e.payload ? 'historySnapshot'
    ORDER BY e.created_at DESC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'status', 'confirmed',
        'result', v_event_payload -> 'historySnapshot',
        'leftAt', v_event_payload ->> 'leftAt');
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;

  IF v_room.state = 'completed'::public.session_state THEN
    UPDATE public.participants SET guest_grant_expires_at = now()
    WHERE id = v_guest.id;
    RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
  END IF;
  IF v_room.state NOT IN ('joinable'::public.session_state, 'in_progress'::public.session_state) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted');
  END IF;

  UPDATE public.participants SET left_at = now()
  WHERE id = v_guest.id AND left_at IS NULL;
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    v_session_id, public.allocate_event_sequence(v_session_id), v_guest.id,
    'participant_left', concat('guest-left:', v_guest.id::text),
    jsonb_build_object('participantId', v_guest.id::text,
                       'membershipType', 'guest'), now()
  ) RETURNING payload INTO v_event_payload;

  IF v_room.state = 'in_progress'::public.session_state THEN
    RETURN jsonb_build_object('ok', true, 'status', 'confirmed',
      'result', v_event_payload -> 'historySnapshot',
      'leftAt', v_event_payload ->> 'leftAt');
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
END;
$$;
REVOKE ALL ON FUNCTION private.leave_room_as_guest(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.leave_room_as_guest(text) TO service_role;

-- A signed-in leaver sees only their own immutable capture until the canonical
-- completed history takes over. Invoker security carries underlying RLS.
CREATE VIEW public.early_leave_results WITH (security_invoker = true) AS
SELECT e.session_id, (e.payload ->> 'leftAt')::timestamptz AS left_at,
       e.payload -> 'historySnapshot' AS snapshot
FROM public.gameplay_events e
JOIN public.participants p ON p.id = e.actor_participant_id
JOIN public.game_sessions gs ON gs.id = e.session_id
WHERE e.event_type = 'participant_left'
  AND e.payload ? 'historySnapshot'
  AND p.account_id = (SELECT auth.uid())
  AND gs.state <> 'completed'::public.session_state;
REVOKE ALL ON TABLE public.early_leave_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.early_leave_results TO authenticated;

NOTIFY pgrst, 'reload schema';
