-- 034_room_expiry.sql
-- US4: auto-close joinable rooms with no activity for 24h. Joinable-only (in_progress is
-- out of scope — auto-closing a live game could destroy it).

CREATE OR REPLACE FUNCTION private.expire_stale_rooms() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_room record;
  v_actor uuid;
  v_count integer := 0;
BEGIN
  FOR v_room IN
    SELECT id FROM public.game_sessions
    WHERE state = 'joinable'::public.session_state
      AND last_activity_at < now() - interval '24 hours'
  LOOP
    UPDATE public.game_sessions SET state = 'closed'::public.session_state WHERE id = v_room.id;
    SELECT p.id INTO v_actor FROM public.participants p
    WHERE p.session_id = v_room.id AND p.session_role = 'owner'::public.participant_session_role
    LIMIT 1;
    IF v_actor IS NOT NULL THEN
      INSERT INTO public.gameplay_events (
        session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
      ) VALUES (
        v_room.id, public.allocate_event_sequence(v_room.id), v_actor, 'room_closed',
        concat('room-expired:', gen_random_uuid()::text),
        jsonb_build_object('reason', 'inactivity_expired'), now()
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION private.expire_stale_rooms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.expire_stale_rooms() TO service_role;

-- Schedule every 15 minutes via pg_cron when available (skipped gracefully otherwise;
-- tests and the manual smoke path call expire_stale_rooms() directly).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('expire-stale-rooms', '*/15 * * * *', $cron$SELECT private.expire_stale_rooms();$cron$);
  END IF;
END;
$$;
