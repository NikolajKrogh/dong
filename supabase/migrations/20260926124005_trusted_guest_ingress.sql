-- Forward fix for #191: never trust client-supplied forwarding chains.
CREATE OR REPLACE FUNCTION private.guest_caller_identity() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_headers jsonb; v_address inet;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RETURN NULL; END IF;
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  IF length(v_headers->>'x-dong-guest-caller') > 64
     OR v_headers->>'x-dong-guest-caller' LIKE '%/%' THEN RETURN NULL; END IF;
  v_address := (v_headers->>'x-dong-guest-caller')::inet;
  RETURN host(v_address);
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value OR null_value_not_allowed THEN
  RETURN NULL;
END;
$$;

-- Cover every overload, including historic signatures, without changing
-- registered host/member functions. API roles cannot bypass the Edge boundary.
DO $$
DECLARE v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'join_room_as_guest','get_guest_room_snapshot','leave_room_as_guest',
      'rotate_guest_room_grant','set_my_room_picks_as_guest',
      'change_manual_score_as_guest','change_participant_drink_as_guest')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function);
  END LOOP;
END;
$$;
NOTIFY pgrst, 'reload schema';
