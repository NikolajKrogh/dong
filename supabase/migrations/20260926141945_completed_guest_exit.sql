-- AND-191-02: completed guests can revoke access without changing history.
-- Zero-duration grants permit immediate revocation within the issuing transaction.
ALTER TABLE public.participants
  DROP CONSTRAINT chk_guest_grant_timestamps,
  ADD CONSTRAINT chk_guest_grant_timestamps CHECK (
    (membership_type = 'registered'::public.participant_membership_type
      AND guest_grant_issued_at IS NULL
      AND guest_grant_expires_at IS NULL
      AND guest_grant_previous_hash IS NULL
      AND guest_grant_rotation_id IS NULL
      AND guest_grant_retry_until IS NULL)
    OR
    (membership_type = 'guest'::public.participant_membership_type
      AND (left_at IS NOT NULL OR
        (guest_grant_issued_at IS NOT NULL AND guest_grant_expires_at IS NOT NULL))
      AND (guest_grant_expires_at IS NULL OR
        (guest_grant_issued_at IS NOT NULL
          AND guest_grant_expires_at >= guest_grant_issued_at
          AND guest_grant_expires_at <= guest_grant_issued_at + interval '48 hours'))
      AND ((guest_grant_previous_hash IS NULL AND guest_grant_rotation_id IS NULL
            AND guest_grant_retry_until IS NULL)
        OR (guest_grant_previous_hash IS NOT NULL AND guest_grant_rotation_id IS NOT NULL
            AND guest_grant_retry_until IS NOT NULL)))
  );

CREATE OR REPLACE FUNCTION private.leave_room_as_guest(p_guest_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash text;
  v_session_id uuid;
  v_room public.game_sessions;
  v_guest public.participants;
BEGIN
  IF btrim(coalesce(p_guest_token, '')) = ''
     OR length(p_guest_token) > 128 THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  v_hash := encode(extensions.digest(btrim(p_guest_token), 'sha256'), 'hex');
  SELECT p.session_id INTO v_session_id FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;

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
  IF NOT FOUND OR v_guest.left_at IS NOT NULL
     OR v_guest.guest_grant_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;

  -- Revoke only final-read access; preserve the completed roster and history.
  IF v_room.state = 'completed'::public.session_state THEN
    UPDATE public.participants SET guest_grant_expires_at = now()
    WHERE id = v_guest.id;
    RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
  END IF;

  IF v_room.state <> 'joinable'::public.session_state THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted');
  END IF;

  UPDATE public.participants p SET left_at = now()
  WHERE p.id = v_guest.id AND p.left_at IS NULL;
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    v_session_id, public.allocate_event_sequence(v_session_id), v_guest.id,
    'participant_left', concat('guest-left:', v_guest.id::text),
    jsonb_build_object('participantId', v_guest.id::text, 'membershipType', 'guest'),
    now()
  );
  RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
END;
$$;

REVOKE ALL ON FUNCTION private.leave_room_as_guest(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.leave_room_as_guest(text) TO service_role;

NOTIFY pgrst, 'reload schema';
