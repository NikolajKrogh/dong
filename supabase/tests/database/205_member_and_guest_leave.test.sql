BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(3);

CREATE TEMP TABLE ctx AS
WITH host AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','lv-host@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
member AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','lv-member@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,'LV Host' FROM host UNION ALL SELECT id,'LV Member' FROM member RETURNING id
),
s AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'LEAVE1' FROM host RETURNING id),
m AS (INSERT INTO public.participants (session_id, account_id, display_name, membership_type, session_role, current_drink_total)
      SELECT (SELECT id FROM s), (SELECT id FROM member), 'LV Member', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role, 0 RETURNING id),
g AS (INSERT INTO public.participants (session_id, account_id, display_name, membership_type, session_role, current_drink_total, guest_rejoin_token_hash)
      SELECT (SELECT id FROM s), NULL, 'LV Guest', 'guest'::public.participant_membership_type, 'member'::public.participant_session_role, 0, encode(extensions.digest('lv-guest-token','sha256'),'hex') RETURNING id)
SELECT (SELECT id FROM host) AS host, (SELECT id FROM member) AS member, (SELECT id FROM s) AS session_id, (SELECT id FROM m) AS member_participant, (SELECT id FROM g) AS guest_participant;

GRANT SELECT ON TABLE ctx TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- Member leaves
SELECT set_config('request.jwt.claim.sub', (SELECT member::text FROM ctx), true);
SELECT public.leave_room_as_member((SELECT session_id FROM ctx));

-- Guest leaves (token-scoped)
SELECT public.leave_room_as_guest('lv-guest-token');

SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;

SELECT isnt(
    (SELECT left_at FROM public.participants WHERE id = (SELECT member_participant FROM ctx)),
    NULL, 'member leave sets left_at');
SELECT isnt(
    (SELECT left_at FROM public.participants WHERE id = (SELECT guest_participant FROM ctx)),
    NULL, 'guest leave sets left_at');
SELECT is(
    (SELECT count(*)::text FROM public.participants WHERE session_id = (SELECT session_id FROM ctx) AND left_at IS NULL),
    '1', 'only the host remains in the roster after member and guest leave');

SELECT * FROM finish();
ROLLBACK;
