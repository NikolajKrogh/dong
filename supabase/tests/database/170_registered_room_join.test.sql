BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

-- Seed: two hosts with joinable rooms, one completed room, two joiners.
CREATE TEMP TABLE ctx AS
WITH host1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','rj-host1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
host2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','rj-host2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
host3 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','rj-host3@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
j1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','rj-joiner1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
j2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','rj-joiner2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'Host One' FROM host1
    UNION ALL SELECT id, 'Host Two' FROM host2
    UNION ALL SELECT id, 'Host Three' FROM host3
    UNION ALL SELECT id, 'Joiner One' FROM j1
    UNION ALL SELECT id, 'Joiner Two' FROM j2
    RETURNING id
),
r1 AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'ROOMR1' FROM host1 RETURNING id),
r2 AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'ROOMR2' FROM host2 RETURNING id),
r3 AS (INSERT INTO public.game_sessions (owner_account_id, join_code, state, completed_at) SELECT id,'ROOMR3','completed'::public.session_state, now() FROM host3 RETURNING id)
SELECT (SELECT id FROM j1) AS j1, (SELECT id FROM j2) AS j2,
       (SELECT id FROM r1) AS r1, (SELECT id FROM r2) AS r2, (SELECT id FROM r3) AS r3;

GRANT SELECT ON TABLE ctx TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub', (SELECT j1::text FROM ctx), true);

CREATE TEMP TABLE join1 AS SELECT public.join_room_as_registered('ROOMR1') AS payload;
CREATE TEMP TABLE join1_again AS SELECT public.join_room_as_registered('ROOMR1') AS payload;

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL);

-- J1 already in R1 → joining R2 must raise already_in_active_room
DO $$ BEGIN
  BEGIN PERFORM public.join_room_as_registered('ROOMR2');
    INSERT INTO results VALUES ('already_in_active_room', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('already_in_active_room', SQLERRM = 'already_in_active_room');
  END;
END $$;

-- J2 joining a completed room → room_not_joinable
SELECT set_config('request.jwt.claim.sub', (SELECT j2::text FROM ctx), true);
DO $$ BEGIN
  BEGIN PERFORM public.join_room_as_registered('ROOMR3');
    INSERT INTO results VALUES ('room_not_joinable', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('room_not_joinable', SQLERRM = 'room_not_joinable');
  END;
END $$;

SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;

SELECT is((SELECT payload->>'membershipType' FROM join1), 'registered', 'registered join records a registered member');
SELECT is((SELECT payload->>'sessionRole' FROM join1), 'member', 'registered join records a member role');
SELECT is((SELECT payload->>'participantId' FROM join1_again), (SELECT payload->>'participantId' FROM join1), 'second join is idempotent (same participant)');
SELECT ok((SELECT passed FROM results WHERE name = 'already_in_active_room'), 'joining a second room raises already_in_active_room');
SELECT ok((SELECT passed FROM results WHERE name = 'room_not_joinable'), 'joining a completed room raises room_not_joinable');

SELECT * FROM finish();
ROLLBACK;
