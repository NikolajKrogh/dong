BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);

CREATE TEMP TABLE account_bootstrap_context AS
WITH owner_user AS (
  INSERT INTO auth.users (
    id, aud, role, email, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  )
  VALUES (
    gen_random_uuid(), 'authenticated', 'authenticated',
    gen_random_uuid()::text || '@fixture.invalid', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false
  )
  RETURNING id
), stranger_user AS (
  INSERT INTO auth.users (
    id, aud, role, email, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  )
  VALUES (
    gen_random_uuid(), 'authenticated', 'authenticated',
    gen_random_uuid()::text || '@fixture.invalid', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false
  )
  RETURNING id
)
SELECT (SELECT id FROM owner_user) AS owner_id,
       (SELECT id FROM stranger_user) AS stranger_id;
GRANT SELECT ON account_bootstrap_context TO authenticated;

SELECT ok(
  has_function_privilege('authenticated', 'public.bootstrap_account()', 'EXECUTE'),
  'authenticated users can bootstrap their own account'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.bootstrap_account()', 'EXECUTE'),
  'anonymous users cannot execute account bootstrap'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT owner_id::text FROM account_bootstrap_context),
  true
);
SELECT is(
  (SELECT id FROM public.bootstrap_account()),
  (SELECT owner_id FROM account_bootstrap_context),
  'bootstrap derives the account id from auth.uid()'
);
SELECT is(
  (SELECT username FROM public.bootstrap_account()),
  NULL::text,
  'bootstrap preserves the unclaimed username'
);
SELECT is(
  (SELECT count(*)::integer FROM public.accounts
    WHERE id = (SELECT owner_id FROM account_bootstrap_context)),
  1,
  'repeated bootstrap returns the single existing account'
);

SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT stranger_id::text FROM account_bootstrap_context),
  true
);
SELECT throws_ok(
  $$INSERT INTO public.accounts (id)
    SELECT owner_id FROM account_bootstrap_context$$,
  '42501', NULL,
  'authenticated users cannot insert another account id'
);

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT throws_ok(
  $$SELECT * FROM public.bootstrap_account()$$,
  'P0001', 'not_authenticated',
  'bootstrap rejects a missing auth.uid()'
);

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);
SELECT throws_ok(
  $$SELECT * FROM public.bootstrap_account()$$,
  '42501', NULL,
  'anonymous users are denied account bootstrap'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
