-- The retired profiles table has no policy surface; settings remain owner-private.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

INSERT INTO public.settings (account_id, settings_data)
VALUES ('00000000-0000-4000-8000-000000000001', '{"theme":"classic"}'::jsonb);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
SELECT is((SELECT settings_data->>'theme' FROM public.settings
  WHERE account_id = '00000000-0000-4000-8000-000000000001'), 'classic',
  'owner reads settings');
UPDATE public.settings SET settings_data = '{"theme":"night"}'::jsonb
WHERE account_id = '00000000-0000-4000-8000-000000000001';
SELECT is((SELECT settings_data->>'theme' FROM public.settings
  WHERE account_id = '00000000-0000-4000-8000-000000000001'), 'night',
  'owner updates settings');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
SELECT is((SELECT count(*)::integer FROM public.settings
  WHERE account_id = '00000000-0000-4000-8000-000000000001'), 0,
  'another authenticated user cannot read owner settings');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
SELECT is((SELECT count(*)::integer FROM public.settings
  WHERE account_id = '00000000-0000-4000-8000-000000000001'), 0,
  'unrelated user cannot read owner settings');
SELECT * FROM finish();
ROLLBACK;
