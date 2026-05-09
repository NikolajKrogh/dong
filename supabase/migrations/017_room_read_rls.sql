-- 017_room_read_rls.sql
-- Host and current-participant read access for room snapshot tables.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private
FROM PUBLIC,
    anon,
    authenticated;
GRANT USAGE ON SCHEMA private TO authenticated,
    service_role;
CREATE OR REPLACE FUNCTION private.can_access_session(p_session_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
SELECT EXISTS (
        SELECT 1
        FROM public.game_sessions
        WHERE id = p_session_id
            AND host_account_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.participants
        WHERE session_id = p_session_id
            AND account_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION private.can_access_session(uuid)
FROM PUBLIC,
    anon;
GRANT EXECUTE ON FUNCTION private.can_access_session(uuid) TO authenticated,
    service_role;
DROP POLICY IF EXISTS game_sessions_room_members_select ON public.game_sessions;
CREATE POLICY game_sessions_room_members_select ON public.game_sessions FOR
SELECT TO authenticated USING (
        private.can_access_session(public.game_sessions.id)
    );
DROP POLICY IF EXISTS participants_room_members_select ON public.participants;
CREATE POLICY participants_room_members_select ON public.participants FOR
SELECT TO authenticated USING (
        private.can_access_session(public.participants.session_id)
    );
DROP POLICY IF EXISTS matches_room_members_select ON public.matches;
CREATE POLICY matches_room_members_select ON public.matches FOR
SELECT TO authenticated USING (
        private.can_access_session(public.matches.session_id)
    );
DROP POLICY IF EXISTS assignments_room_members_select ON public.assignments;
CREATE POLICY assignments_room_members_select ON public.assignments FOR
SELECT TO authenticated USING (
        private.can_access_session(public.assignments.session_id)
    );
DROP POLICY IF EXISTS gameplay_events_room_members_select ON public.gameplay_events;
CREATE POLICY gameplay_events_room_members_select ON public.gameplay_events FOR
SELECT TO authenticated USING (
        private.can_access_session(public.gameplay_events.session_id)
    );