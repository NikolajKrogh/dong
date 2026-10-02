-- Retire importer APIs and bookkeeping only; canonical sessions/events remain.
DROP FUNCTION public.get_history_import_links();
DROP FUNCTION private.get_history_import_links();
DROP FUNCTION public.import_legacy_history(text,jsonb);
DROP FUNCTION private.import_legacy_history(text,jsonb);
DROP FUNCTION private.compute_legacy_history_fingerprint(jsonb);
DROP TABLE private.legacy_history_import_sessions;
DROP TABLE private.legacy_history_import_state;
DROP TYPE public.legacy_history_import_session_state;
DROP TYPE public.legacy_history_import_state;

-- Keep privileged username implementation in private, with a narrow invoker wrapper.
ALTER FUNCTION public.set_account_username(text) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.set_account_username(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.set_account_username(text) TO authenticated;
CREATE FUNCTION public.set_account_username(requested_username text)
RETURNS TABLE(id uuid,username text,created_at timestamptz,updated_at timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.set_account_username(requested_username);
$$;
REVOKE ALL ON FUNCTION public.set_account_username(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_account_username(text) TO authenticated;
