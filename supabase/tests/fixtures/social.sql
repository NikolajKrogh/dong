-- Stable local actors and prefix corpus; this file also validates seed.sql.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(2);
-- Actor A/B/C/D are stable, authenticated test identities; Scout001..030 share a prefix.
CREATE TEMP TABLE social_fixture AS
SELECT
  '00000000-0000-4000-8000-000000000001'::uuid AS actor_a,
  '00000000-0000-4000-8000-000000000002'::uuid AS actor_b,
  '00000000-0000-4000-8000-000000000003'::uuid AS outsider_c,
  '00000000-0000-4000-8000-000000000004'::uuid AS blocker_d;
GRANT SELECT ON social_fixture TO authenticated;
SELECT is((SELECT count(*)::integer FROM auth.users
  WHERE id BETWEEN '00000000-0000-4000-8000-000000000001'::uuid
    AND '00000000-0000-4000-8000-000000000068'::uuid), 104,
  'all disposable social actors exist');
SELECT is((SELECT count(*)::integer FROM public.accounts
  WHERE id BETWEEN '00000000-0000-4000-8000-000000000001'::uuid
    AND '00000000-0000-4000-8000-00000000001e'::uuid), 30,
  '30 same-prefix candidates exist');
SELECT * FROM finish();
ROLLBACK;
