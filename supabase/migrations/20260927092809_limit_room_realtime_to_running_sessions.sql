-- Realtime membership is limited to rooms whose shared game is still active.

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
      AND gs.state = 'in_progress'::public.session_state
  );
$$;
