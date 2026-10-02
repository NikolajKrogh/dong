BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

CREATE TEMP TABLE join_hardening_ctx AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'secure-join-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, username)
  SELECT id, 'Secure_Join_Host' FROM host RETURNING id
), room_a AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'HARD10' FROM account RETURNING id
), room_b AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'HARD11' FROM account RETURNING id
)
SELECT (SELECT id FROM room_a) AS room_a, (SELECT id FROM room_b) AS room_b;

SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.11"}', true);
CREATE TEMP TABLE join_hardening_results (kind text PRIMARY KEY, payload jsonb);
INSERT INTO join_hardening_results VALUES
  ('first', public.join_room_as_guest('HARD10', 'Casey', repeat('b', 64))),
  ('replay', public.join_room_as_guest('HARD10', 'Casey', repeat('b', 64)));

DO $$
DECLARE v_payload jsonb;
BEGIN
  BEGIN
    v_payload := public.join_room_as_guest('HARD11', 'Casey', repeat('b', 64));
  EXCEPTION WHEN OTHERS THEN
    v_payload := jsonb_build_object('ok', false, 'code', 'unexpected');
  END;
  INSERT INTO join_hardening_results VALUES ('cross_room', v_payload);
END $$;

SELECT is((SELECT payload->>'participantId' FROM join_hardening_results WHERE kind = 'replay'),
  (SELECT payload->>'participantId' FROM join_hardening_results WHERE kind = 'first'),
  'lost-response retry returns the original participant');
SELECT is((SELECT count(*)::text FROM public.participants p
    WHERE p.session_id = (SELECT room_a FROM join_hardening_ctx)
      AND p.guest_rejoin_token_hash = encode(extensions.digest(repeat('b',64),'sha256'),'hex')),
  '1', 'retry creates exactly one guest row');
SELECT is((SELECT count(*)::text FROM public.gameplay_events e
    WHERE e.session_id = (SELECT room_a FROM join_hardening_ctx)
      AND e.event_type = 'participant_joined'),
  '1', 'retry creates exactly one immutable join event');
SELECT is((SELECT payload->>'code' FROM join_hardening_results WHERE kind = 'cross_room'),
  'room_unavailable', 'bound token cannot join a different room or leak an index error');
SELECT ok((SELECT payload->>'grantExpiresAt' FROM join_hardening_results WHERE kind = 'first') IS NOT NULL,
  'join reports grant expiry to the client');
SELECT ok((SELECT guest_grant_expires_at <= guest_grant_issued_at + interval '48 hours'
    FROM public.participants WHERE session_id = (SELECT room_a FROM join_hardening_ctx)
      AND membership_type = 'guest'::public.participant_membership_type),
  'new guest grant expires no later than 48 hours from issue');

SELECT * FROM finish();
ROLLBACK;
