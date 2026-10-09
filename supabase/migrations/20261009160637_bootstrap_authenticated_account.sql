CREATE FUNCTION private.bootstrap_account()
RETURNS TABLE (id uuid, username text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.accounts (id)
  VALUES (actor)
  ON CONFLICT ON CONSTRAINT accounts_pkey DO NOTHING;

  RETURN QUERY
    SELECT a.id, a.username, a.created_at, a.updated_at
    FROM public.accounts AS a
    WHERE a.id = actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0001';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION private.bootstrap_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.bootstrap_account() TO authenticated;

CREATE FUNCTION public.bootstrap_account()
RETURNS TABLE (id uuid, username text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT * FROM private.bootstrap_account();
$fn$;

REVOKE ALL ON FUNCTION public.bootstrap_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_account() TO authenticated;
