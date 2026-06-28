BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(3);

CREATE TEMP TABLE ctx AS
WITH h1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','exp-h1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
h2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','exp-h2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
h3 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','exp-h3@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,'Exp H1' FROM h1 UNION ALL SELECT id,'Exp H2' FROM h2 UNION ALL SELECT id,'Exp H3' FROM h3 RETURNING id
),
ra AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'EXPIRA' FROM h1 RETURNING id),
rb AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'EXPIRB' FROM h2 RETURNING id),
rc AS (INSERT INTO public.game_sessions (owner_account_id, join_code, state) SELECT id,'EXPIRC','in_progress'::public.session_state FROM h3 RETURNING id)
SELECT (SELECT id FROM ra) AS ra, (SELECT id FROM rb) AS rb, (SELECT id FROM rc) AS rc;

-- Age RA (joinable) and RC (in_progress) past the threshold; leave RB fresh.
UPDATE public.game_sessions SET last_activity_at = now() - interval '2 days'
WHERE id IN ((SELECT ra FROM ctx), (SELECT rc FROM ctx));

SELECT private.expire_stale_rooms();

SELECT is((SELECT state::text FROM public.game_sessions WHERE id = (SELECT ra FROM ctx)), 'closed', 'a stale joinable room is closed');
SELECT is((SELECT state::text FROM public.game_sessions WHERE id = (SELECT rb FROM ctx)), 'joinable', 'a fresh joinable room is left alone');
SELECT is((SELECT state::text FROM public.game_sessions WHERE id = (SELECT rc FROM ctx)), 'in_progress', 'a stale in_progress room is NOT expired (joinable-only)');

SELECT * FROM finish();
ROLLBACK;
