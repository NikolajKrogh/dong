BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

-- Room A: host + two registered members + one guest. Room B: host + one member (auto).
CREATE TEMP TABLE ctx AS
WITH ha AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ho-ha@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ho-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ho-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
hb AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ho-hb@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
mb AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ho-mb@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,'Host A' FROM ha UNION ALL SELECT id,'Member One' FROM m1 UNION ALL SELECT id,'Member Two' FROM m2
    UNION ALL SELECT id,'Host B' FROM hb UNION ALL SELECT id,'Member B' FROM mb
    RETURNING id
),
ra AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'HOROOMA' FROM ha RETURNING id),
rb AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'HOROOMB' FROM hb RETURNING id),
pm1 AS (INSERT INTO public.participants (session_id, account_id, display_name, membership_type, session_role, current_drink_total)
        SELECT (SELECT id FROM ra), (SELECT id FROM m1), 'Member One', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role, 0 RETURNING id),
pm2 AS (INSERT INTO public.participants (session_id, account_id, display_name, membership_type, session_role, current_drink_total)
        SELECT (SELECT id FROM ra), (SELECT id FROM m2), 'Member Two', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role, 0 RETURNING id),
pg AS (INSERT INTO public.participants (session_id, account_id, display_name, membership_type, session_role, current_drink_total, guest_rejoin_token_hash)
        SELECT (SELECT id FROM ra), NULL, 'Guesty', 'guest'::public.participant_membership_type, 'member'::public.participant_session_role, 0, encode(extensions.digest('ho-guest-token','sha256'),'hex') RETURNING id),
pmb AS (INSERT INTO public.participants (session_id, account_id, display_name, membership_type, session_role, current_drink_total)
        SELECT (SELECT id FROM rb), (SELECT id FROM mb), 'Member B', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role, 0 RETURNING id)
SELECT (SELECT id FROM ha) AS ha, (SELECT id FROM m1) AS m1, (SELECT id FROM hb) AS hb,
       (SELECT id FROM ra) AS ra, (SELECT id FROM rb) AS rb,
       (SELECT id FROM pm1) AS pm1, (SELECT id FROM pg) AS pg;

GRANT SELECT ON TABLE ctx TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL);

-- Host A leaves with >1 eligible, no successor → successor_required
SELECT set_config('request.jwt.claim.sub', (SELECT ha::text FROM ctx), true);
DO $$ BEGIN
  BEGIN PERFORM public.leave_room_as_host((SELECT ra FROM ctx), NULL);
    INSERT INTO results VALUES ('successor_required', FALSE);
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('successor_required', SQLERRM = 'successor_required'); END;
END $$;

-- Host A chooses the guest → successor_not_eligible
DO $$ BEGIN
  BEGIN PERFORM public.leave_room_as_host((SELECT ra FROM ctx), (SELECT pg FROM ctx));
    INSERT INTO results VALUES ('guest_not_eligible', FALSE);
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('guest_not_eligible', SQLERRM = 'successor_not_eligible'); END;
END $$;

-- Host A chooses Member One → transferred
CREATE TEMP TABLE transfer AS SELECT public.leave_room_as_host((SELECT ra FROM ctx), (SELECT pm1 FROM ctx)) AS payload;

-- Host B leaves with exactly one eligible member → auto-transfer
SELECT set_config('request.jwt.claim.sub', (SELECT hb::text FROM ctx), true);
CREATE TEMP TABLE auto AS SELECT public.leave_room_as_host((SELECT rb FROM ctx), NULL) AS payload;

SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;

SELECT ok((SELECT passed FROM results WHERE name='successor_required'), 'leaving with >1 eligible and no choice raises successor_required');
SELECT ok((SELECT passed FROM results WHERE name='guest_not_eligible'), 'choosing a guest raises successor_not_eligible');
SELECT is((SELECT payload->>'status' FROM transfer), 'transferred', 'choosing a member transfers the room');
SELECT is(
    (SELECT count(*)::text FROM public.participants p WHERE p.session_id = (SELECT ra FROM ctx) AND p.session_role='owner' AND p.left_at IS NULL),
    '1', 'exactly one active owner after transfer');
SELECT is(
    (SELECT p.account_id::text FROM public.participants p WHERE p.session_id = (SELECT ra FROM ctx) AND p.session_role='owner' AND p.left_at IS NULL),
    (SELECT m1::text FROM ctx), 'the chosen member is the new owner');
SELECT is((SELECT payload->>'status' FROM auto), 'transferred', 'leaving with exactly one eligible member auto-transfers');

SELECT * FROM finish();
ROLLBACK;
