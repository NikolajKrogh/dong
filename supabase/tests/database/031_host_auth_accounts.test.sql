BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.accounts'::regclass),
  'accounts uses row-level security');

CREATE TEMP TABLE bootstrap_actor AS SELECT gen_random_uuid() AS id;
GRANT SELECT ON bootstrap_actor TO authenticated;
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
SELECT id, 'authenticated', 'authenticated', id::text || '@fixture.invalid', now(), now(), now(),
  '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false FROM bootstrap_actor;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
SELECT is((SELECT username FROM public.accounts
  WHERE id = '00000000-0000-4000-8000-000000000001'), 'Scout001',
  'owner reads their current username');
SELECT is((SELECT username FROM public.set_account_username('Scout_One')), 'Scout_One',
  'owner renames through the username command');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
SELECT is((SELECT count(*)::integer FROM public.accounts
  WHERE id = '00000000-0000-4000-8000-000000000001'), 0,
  'another account cannot read the owner row');
SELECT set_config('request.jwt.claim.sub', (SELECT id::text FROM bootstrap_actor), true);
WITH inserted AS (INSERT INTO public.accounts (id) SELECT id FROM bootstrap_actor RETURNING id)
SELECT is((SELECT count(*)::integer FROM inserted), 1,
  'owner bootstraps an account without a username');
SELECT * FROM finish();
ROLLBACK;
