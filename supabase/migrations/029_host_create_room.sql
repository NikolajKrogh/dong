-- 029_host_create_room.sql
-- Add create_room_as_host RPC: authenticated host creates a joinable room with a 6-digit numeric code.
-- The sync_session_owner_participant trigger (025) auto-creates the owner participant on game_sessions INSERT.

CREATE OR REPLACE FUNCTION private.create_room_as_host()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_account_id uuid;
  v_join_code text;
  v_session_id uuid;
  v_participant_id uuid;
  v_participant_display_name text;
  v_attempt integer := 0;
BEGIN
  v_account_id := auth.uid();

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Return existing joinable room for this host if one exists
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
      'sessionId', v_session_id::text,
      'joinCode', v_join_code,
      'hostParticipantId', v_participant_id::text,
      'hostDisplayName', v_participant_display_name
    );
  END IF;

  -- Generate unique 6-digit code, retrying on collision
  LOOP
    v_attempt := v_attempt + 1;
    v_join_code := LPAD(FLOOR(RANDOM() * 1000000)::int::text, 6, '0');

    BEGIN
      INSERT INTO public.game_sessions (owner_account_id, join_code, state, created_at)
      VALUES (v_account_id, v_join_code, 'joinable'::public.session_state, now())
      RETURNING id INTO v_session_id;

      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt >= 5 THEN
          RAISE EXCEPTION 'create_room_code_exhausted';
        END IF;
    END;
  END LOOP;

  -- Read participant row created by sync_session_owner_participant trigger
  SELECT p.id, p.display_name
  INTO v_participant_id, v_participant_display_name
  FROM public.participants p
  WHERE p.session_id = v_session_id
    AND p.account_id = v_account_id
    AND p.session_role = 'owner'::public.participant_session_role;

  RETURN jsonb_build_object(
    'sessionId', v_session_id::text,
    'joinCode', v_join_code,
    'hostParticipantId', v_participant_id::text,
    'hostDisplayName', v_participant_display_name
  );
END;
$$;

REVOKE ALL ON FUNCTION private.create_room_as_host()
FROM PUBLIC,
  anon,
  authenticated;

GRANT EXECUTE ON FUNCTION private.create_room_as_host() TO service_role;

CREATE OR REPLACE FUNCTION public.create_room_as_host()
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = '' AS $$
SELECT private.create_room_as_host();
$$;

REVOKE ALL ON FUNCTION public.create_room_as_host()
FROM PUBLIC,
  anon,
  authenticated;

GRANT EXECUTE ON FUNCTION public.create_room_as_host() TO authenticated;
