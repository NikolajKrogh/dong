-- 013_enable_rls_and_grants.sql
-- Explicit grants plus RLS enablement for personal, social, and room data surfaces.
REVOKE ALL ON TABLE public.profiles
FROM anon,
    authenticated;
GRANT SELECT,
    INSERT,
    UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.profiles TO service_role;
REVOKE ALL ON TABLE public.settings
FROM anon,
    authenticated;
GRANT SELECT,
    INSERT,
    UPDATE ON TABLE public.settings TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.settings TO service_role;
REVOKE ALL ON TABLE public.friendships
FROM anon,
    authenticated;
GRANT SELECT,
    INSERT ON TABLE public.friendships TO authenticated;
GRANT UPDATE (status, responded_at) ON TABLE public.friendships TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.friendships TO service_role;
REVOKE ALL ON TABLE public.game_sessions
FROM anon,
    authenticated;
GRANT SELECT ON TABLE public.game_sessions TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.game_sessions TO service_role;
REVOKE ALL ON TABLE public.participants
FROM anon,
    authenticated;
GRANT SELECT ON TABLE public.participants TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.participants TO service_role;
REVOKE ALL ON TABLE public.matches
FROM anon,
    authenticated;
GRANT SELECT ON TABLE public.matches TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.matches TO service_role;
REVOKE ALL ON TABLE public.assignments
FROM anon,
    authenticated;
GRANT SELECT ON TABLE public.assignments TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.assignments TO service_role;
REVOKE ALL ON TABLE public.gameplay_events
FROM anon,
    authenticated;
GRANT SELECT ON TABLE public.gameplay_events TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.gameplay_events TO service_role;
REVOKE ALL ON FUNCTION public.allocate_event_sequence(uuid)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_event_sequence(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.prevent_events_on_completed()
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_events_on_completed() TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gameplay_events ENABLE ROW LEVEL SECURITY;