BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);
CREATE TEMP TABLE shared_caller_room AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'shared-caller-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, username)
  SELECT id, 'Shared_Caller_Host' FROM host RETURNING id
), room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'EIGHT2' FROM account RETURNING id
)
SELECT id FROM room;
CREATE TEMP TABLE shared_caller_result (kind text, payload jsonb);
DO $$
DECLARE i integer;
BEGIN
  FOR i IN 1..8 LOOP
    INSERT INTO shared_caller_result VALUES ('join', public.join_room_as_guest(
      'EIGHT2', 'Guest ' || i, lpad(to_hex(i),64,'0')));
  END LOOP;
  FOR i IN 1..60 LOOP
    INSERT INTO shared_caller_result VALUES ('poll', public.get_guest_room_snapshot(lpad(to_hex(1),64,'0')));
  END LOOP;
END $$;
SELECT is((SELECT count(*)::text FROM shared_caller_result
    WHERE kind='join' AND payload ? 'participantId'), '8',
  'eight legitimate guests sharing one caller can join');
SELECT is((SELECT count(*)::text FROM public.participants
    WHERE session_id=(SELECT id FROM shared_caller_room)
      AND membership_type='guest'::public.participant_membership_type), '8',
  'the shared-caller joins create eight distinct participants');
SELECT is((SELECT count(*)::text FROM shared_caller_result
    WHERE kind='poll' AND payload ? 'sessionId'), '60',
  'a valid grant has room for 60 refreshes within its per-minute ceiling');
SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.99"}', true);
DO $$
DECLARE i integer;
BEGIN
  FOR i IN 1..25 LOOP
    PERFORM public.get_guest_room_snapshot(lpad(to_hex(100+i),64,'0'));
  END LOOP;
END $$;
SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.10"}', true);
SELECT is((public.get_guest_room_snapshot(lpad(to_hex(1),64,'0'))->>'sessionId'),
  (SELECT id::text FROM shared_caller_room),
  'unrelated invalid spray does not block a healthy caller and grant');
SELECT * FROM finish();
ROLLBACK;
