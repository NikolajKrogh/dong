BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

CREATE TEMP TABLE ctx AS
WITH host AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','snap-host@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
member AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','snap-member@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
outsider AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','snap-outsider@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,'Snap Host' FROM host
    UNION ALL SELECT id,'Snap Member' FROM member
    UNION ALL SELECT id,'Snap Outsider' FROM outsider
    RETURNING id
),
s AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'SNAP01' FROM host RETURNING id),
m AS (
    INSERT INTO public.participants (session_id, account_id, display_name, membership_type, session_role, current_drink_total)
    SELECT (SELECT id FROM s), (SELECT id FROM member), 'Snap Member', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role, 0
    RETURNING id
)
SELECT (SELECT id FROM host) AS host, (SELECT id FROM member) AS member, (SELECT id FROM outsider) AS outsider, (SELECT id FROM s) AS session_id;

GRANT SELECT ON TABLE ctx TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- Host reads snapshot
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM ctx), true);
CREATE TEMP TABLE host_snap AS SELECT public.get_room_snapshot((SELECT session_id FROM ctx)) AS payload;
CREATE TEMP TABLE host_active AS SELECT public.get_my_active_room() AS payload;

-- Member's active room
SELECT set_config('request.jwt.claim.sub', (SELECT member::text FROM ctx), true);
CREATE TEMP TABLE member_active AS SELECT public.get_my_active_room() AS payload;

-- Outsider denied
CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL);
SELECT set_config('request.jwt.claim.sub', (SELECT outsider::text FROM ctx), true);
DO $$ BEGIN
  BEGIN PERFORM public.get_room_snapshot((SELECT session_id FROM ctx));
    INSERT INTO results VALUES ('forbidden', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('forbidden', SQLERRM = 'forbidden');
  END;
END $$;

RESET ROLE;

SELECT is((SELECT jsonb_array_length(payload->'participants')::text FROM host_snap), '2', 'host snapshot lists host + member');
SELECT ok((SELECT passed FROM results WHERE name='forbidden'), 'an outsider cannot read the snapshot (forbidden)');
SELECT is((SELECT payload->>'role' FROM member_active), 'member', 'get_my_active_room reports member role for a member');
SELECT is((SELECT payload->>'joinCode' FROM member_active), NULL, 'members do not get the join code from get_my_active_room');
SELECT is((SELECT payload->>'joinCode' FROM host_active), 'SNAP01', 'host gets the join code from get_my_active_room');

SELECT * FROM finish();
ROLLBACK;
