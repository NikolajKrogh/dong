-- 032_room_membership_rpcs.sql
-- US1: registered-member join, authenticated room snapshot, one-active-room rule + resume,
-- member/guest soft-leave. Builds on 031 ('closed' state, left_at, snapshot filter).

-- ---------------------------------------------------------------------------
-- Active-room lookup (one-room guard + resume). Active = not completed/closed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.find_active_room_for(p_account uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT gs.id
FROM public.game_sessions gs
WHERE gs.state NOT IN ('completed'::public.session_state, 'closed'::public.session_state)
  AND (
    gs.owner_account_id = p_account
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.session_id = gs.id
        AND p.account_id = p_account
        AND p.left_at IS NULL
    )
  )
ORDER BY gs.created_at DESC
LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.find_active_room_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.find_active_room_for(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.get_my_active_room() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_session_id uuid;
  v_is_owner boolean;
  v_join_code text;
  v_participant_id uuid;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_session_id := private.find_active_room_for(v_account);
  IF v_session_id IS NULL THEN RETURN NULL; END IF;
  SELECT (gs.owner_account_id = v_account), gs.join_code
  INTO v_is_owner, v_join_code
  FROM public.game_sessions gs WHERE gs.id = v_session_id;
  SELECT p.id INTO v_participant_id
  FROM public.participants p
  WHERE p.session_id = v_session_id AND p.account_id = v_account AND p.left_at IS NULL
  LIMIT 1;
  RETURN jsonb_build_object(
    'sessionId', v_session_id::text,
    'participantId', v_participant_id::text,
    'role', CASE WHEN v_is_owner THEN 'owner' ELSE 'member' END,
    'joinCode', CASE WHEN v_is_owner THEN v_join_code ELSE NULL END
  );
END;
$$;
REVOKE ALL ON FUNCTION private.get_my_active_room() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_my_active_room() TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_active_room() RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.get_my_active_room();
$$;
REVOKE ALL ON FUNCTION public.get_my_active_room() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_active_room() TO authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated room snapshot (host + members). Reuses build_guest_room_snapshot.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_room_snapshot(p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_account uuid := auth.uid();
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT private.can_access_session(p_session_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN private.build_guest_room_snapshot(p_session_id);
END;
$$;
REVOKE ALL ON FUNCTION private.get_room_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_room_snapshot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_room_snapshot(session_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.get_room_snapshot(session_id);
$$;
REVOKE ALL ON FUNCTION public.get_room_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_snapshot(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Registered-member join (idempotent; one-room guard; re-join un-leaves).
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

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.join_code = v_join_code;
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

-- ---------------------------------------------------------------------------
-- MODIFY create_room_as_host (029) to honor the one-active-room rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.create_room_as_host() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account_id uuid;
  v_join_code text;
  v_session_id uuid;
  v_participant_id uuid;
  v_participant_display_name text;
  v_attempt integer := 0;
BEGIN
  v_account_id := auth.uid();
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Return existing joinable room owned by this host (idempotent).
  SELECT gs.id, gs.join_code, p.id, p.display_name
  INTO v_session_id, v_join_code, v_participant_id, v_participant_display_name
  FROM public.game_sessions gs
  JOIN public.participants p
    ON p.session_id = gs.id
    AND p.account_id = gs.owner_account_id
    AND p.session_role = 'owner'::public.participant_session_role
  WHERE gs.owner_account_id = v_account_id
    AND gs.state = 'joinable'::public.session_state
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'sessionId', v_session_id::text, 'joinCode', v_join_code,
      'hostParticipantId', v_participant_id::text, 'hostDisplayName', v_participant_display_name
    );
  END IF;

  -- One active room rule: not already a member of another active room.
  IF private.find_active_room_for(v_account_id) IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_active_room';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_join_code := LPAD(FLOOR(RANDOM() * 1000000)::int::text, 6, '0');
    BEGIN
      INSERT INTO public.game_sessions (owner_account_id, join_code, state, created_at)
      VALUES (v_account_id, v_join_code, 'joinable'::public.session_state, now())
      RETURNING id INTO v_session_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN RAISE EXCEPTION 'create_room_code_exhausted'; END IF;
    END;
  END LOOP;

  SELECT p.id, p.display_name INTO v_participant_id, v_participant_display_name
  FROM public.participants p
  WHERE p.session_id = v_session_id AND p.account_id = v_account_id
    AND p.session_role = 'owner'::public.participant_session_role;

  RETURN jsonb_build_object(
    'sessionId', v_session_id::text, 'joinCode', v_join_code,
    'hostParticipantId', v_participant_id::text, 'hostDisplayName', v_participant_display_name
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Member leave (soft-leave, joinable-only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.leave_room_as_member(p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_participant public.participants %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left'); END IF;
  IF v_room.owner_account_id = v_account THEN RAISE EXCEPTION 'use_leave_room_as_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN
    RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left');
  END IF;

  SELECT * INTO v_participant FROM public.participants p
  WHERE p.session_id = p_session_id AND p.account_id = v_account
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND p.left_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.participants SET left_at = now() WHERE id = v_participant.id;
    INSERT INTO public.gameplay_events (
      session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
    ) VALUES (
      p_session_id, public.allocate_event_sequence(p_session_id), v_participant.id, 'participant_left',
      concat('member-left:', v_participant.id::text, ':', gen_random_uuid()::text),
      jsonb_build_object('participantId', v_participant.id::text, 'membershipType', 'registered'),
      now()
    );
  END IF;
  RETURN jsonb_build_object('sessionId', p_session_id::text, 'status', 'left');
END;
$$;
REVOKE ALL ON FUNCTION private.leave_room_as_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.leave_room_as_member(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.leave_room_as_member(session_id uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.leave_room_as_member(session_id);
$$;
REVOKE ALL ON FUNCTION public.leave_room_as_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room_as_member(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Guest leave (token-scoped soft-leave, joinable-only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.leave_room_as_guest(p_guest_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_token text := btrim(coalesce(p_guest_token, ''));
  v_hash text;
  v_participant public.participants %ROWTYPE;
  v_room public.game_sessions %ROWTYPE;
BEGIN
  IF v_token = '' THEN RETURN jsonb_build_object('status', 'left'); END IF;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  SELECT * INTO v_participant FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
    AND p.left_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'left'); END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = v_participant.session_id;
  IF v_room.state = 'joinable'::public.session_state THEN
    UPDATE public.participants SET left_at = now() WHERE id = v_participant.id;
    INSERT INTO public.gameplay_events (
      session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
    ) VALUES (
      v_participant.session_id, public.allocate_event_sequence(v_participant.session_id), v_participant.id,
      'participant_left',
      concat('guest-left:', v_participant.id::text, ':', gen_random_uuid()::text),
      jsonb_build_object('participantId', v_participant.id::text, 'membershipType', 'guest'),
      now()
    );
  END IF;
  RETURN jsonb_build_object('status', 'left');
END;
$$;
REVOKE ALL ON FUNCTION private.leave_room_as_guest(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.leave_room_as_guest(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.leave_room_as_guest(guest_token text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.leave_room_as_guest(guest_token);
$$;
REVOKE ALL ON FUNCTION public.leave_room_as_guest(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room_as_guest(text) TO anon, authenticated, service_role;
