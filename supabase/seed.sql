-- Disposable local social fixtures. No hosted credentials or live accounts.
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
SELECT ('00000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
  'authenticated', 'authenticated', 'social-' || n || '@fixture.invalid',
  now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false
FROM generate_series(1, 104) AS n
ON CONFLICT (id) DO NOTHING;

DO $seed$
DECLARE
  name_column text;
BEGIN
  SELECT column_name INTO name_column
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'accounts'
    AND column_name IN ('username', 'preferred_display_name')
  ORDER BY (column_name = 'username') DESC LIMIT 1;
  IF name_column IS NULL THEN
    RAISE EXCEPTION 'Social fixture requires an account name column';
  END IF;
  EXECUTE format($sql$
    INSERT INTO public.accounts (id, %I)
    SELECT ('00000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
      CASE n WHEN 101 THEN 'Émile' WHEN 102 THEN 'Μαρία'
        WHEN 103 THEN '東京123' WHEN 104 THEN 'ThirdParty_C'
        ELSE CASE WHEN n <= 30 THEN 'Scout' ELSE 'Player' END || lpad(n::text, 3, '0') END
    FROM generate_series(1, 104) AS n
    ON CONFLICT (id) DO NOTHING
  $sql$, name_column);
END;
$seed$;
