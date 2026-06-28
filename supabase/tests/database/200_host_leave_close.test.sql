BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(3);

CREATE TEMP TABLE ctx AS
WITH host AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','close-host@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (INSERT INTO public.accounts (id, preferred_display_name) SELECT id,'Close Host' FROM host RETURNING id),
s AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'CLOSE1' FROM host RETURNING id),
g AS (INSERT INTO public.participants (session_id, account_id, display_name, membership_type, session_role, current_drink_total, guest_rejoin_token_hash)
      SELECT (SELECT id FROM s), NULL, 'Only Guest', 'guest'::public.participant_membership_type, 'member'::public.participant_session_role, 0, encode(extensions.digest('close-guest-token','sha256'),'hex') RETURNING id)
SELECT (SELECT id FROM host) AS host, (SELECT id FROM s) AS session_id;

GRANT SELECT ON TABLE ctx TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM ctx), true);

CREATE TEMP TABLE closed AS SELECT public.leave_room_as_host((SELECT session_id FROM ctx), NULL) AS payload;

SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;

SELECT is((SELECT payload->>'status' FROM closed), 'closed', 'host leaving a guest-only room closes it');
SELECT is(
    (SELECT state::text FROM public.game_sessions WHERE id = (SELECT session_id FROM ctx)),
    'closed', 'the room state becomes closed');
SELECT is(
    (SELECT count(*)::text FROM public.completed_session_summaries WHERE session_id = (SELECT session_id FROM ctx)),
    '0', 'a closed room produces no completed-game history record');

SELECT * FROM finish();
ROLLBACK;
