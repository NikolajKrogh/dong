-- Keep the Realtime authorization helper outside PostgREST's exposed schema.

CREATE OR REPLACE FUNCTION private.can_access_room_realtime_channel()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.participants AS p
    JOIN public.game_sessions AS gs ON gs.id = p.session_id
    WHERE 'room:' || gs.id::text = realtime.topic()
      AND p.account_id = auth.uid()
      AND p.membership_type = 'registered'::public.participant_membership_type
      AND p.left_at IS NULL
      AND gs.state IN (
        'in_progress'::public.session_state,
        'completed'::public.session_state
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_access_room_realtime_channel()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_room_realtime_channel()
  TO authenticated;

DROP POLICY IF EXISTS registered_room_realtime_read ON realtime.messages;
CREATE POLICY registered_room_realtime_read
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    extension IN ('broadcast', 'presence')
    AND private.can_access_room_realtime_channel()
  );

DROP POLICY IF EXISTS registered_room_realtime_write ON realtime.messages;
CREATE POLICY registered_room_realtime_write
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    extension IN ('broadcast', 'presence')
    AND private.can_access_room_realtime_channel()
  );

REVOKE ALL ON FUNCTION public.can_access_room_realtime_channel()
  FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.can_access_room_realtime_channel();

NOTIFY pgrst, 'reload schema';
