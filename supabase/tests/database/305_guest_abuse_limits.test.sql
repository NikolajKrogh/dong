BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(13);
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='dong_guest_abuse_hmac_v1') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'dong_guest_abuse_hmac_v1');
  END IF;
END $$;

CREATE TEMP TABLE abuse_ctx AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'abuse-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, preferred_display_name)
  SELECT id, 'Abuse Host' FROM host RETURNING id
), room_a AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'LIMIT1' FROM account RETURNING id
), room_b AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'LIMIT2' FROM account RETURNING id
), room_c AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'EIGHT1' FROM account RETURNING id
)
SELECT (SELECT id FROM room_a) AS room_a,
       (SELECT id FROM room_b) AS room_b,
       (SELECT id FROM room_c) AS room_c;

SELECT has_table('private', 'guest_abuse_windows', 'private counters table exists');
UPDATE private.guest_abuse_config SET
  join_caller_limit=2, join_code_limit=5,
  invalid_caller_limit=2, invalid_token_limit=1,
  valid_caller_limit=4, valid_grant_limit=3;

SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.31"}', true);
CREATE TEMP TABLE abuse_results (kind text PRIMARY KEY, payload jsonb);
INSERT INTO abuse_results VALUES
  ('join1', public.join_room_as_guest('LIMIT1','A',repeat('1',64))),
  ('join2', public.join_room_as_guest('LIMIT1','B',repeat('2',64))),
  ('join3', public.join_room_as_guest('LIMIT1','C',repeat('3',64)));
SELECT is((SELECT payload->>'code' FROM abuse_results WHERE kind='join3'),
  'rate_limited', 'third caller join is limited before insertion');
SELECT is((SELECT count(*)::text FROM public.participants
    WHERE session_id=(SELECT room_a FROM abuse_ctx) AND membership_type='guest'::public.participant_membership_type),
  '2', 'over-limit caller cannot create a participant');

UPDATE private.guest_abuse_config SET join_caller_limit=20, join_code_limit=2;
SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.32"}', true);
INSERT INTO abuse_results VALUES ('code1', public.join_room_as_guest('LIMIT2','D',repeat('4',64)));
SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.33"}', true);
INSERT INTO abuse_results VALUES ('code2', public.join_room_as_guest('LIMIT2','E',repeat('5',64)));
SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.34"}', true);
INSERT INTO abuse_results VALUES ('code3', public.join_room_as_guest('LIMIT2','F',repeat('6',64)));
SELECT is((SELECT payload->>'code' FROM abuse_results WHERE kind='code3'),
  'rate_limited', 'submitted-code quota applies across callers');

SELECT set_config('request.headers', '{}', true);
SELECT is((public.join_room_as_guest('LIMIT1','NoCaller',repeat('7',64))->>'code'),
  'rate_limited', 'missing caller identity fails closed');
SELECT set_config('request.headers', '{"x-dong-guest-caller":"not-an-ip"}', true);
SELECT is((public.join_room_as_guest('LIMIT1','BadCaller',repeat('8',64))->>'code'),
  'rate_limited', 'malformed caller identity fails closed');

SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.35"}', true);
INSERT INTO abuse_results VALUES
  ('invalid1', public.get_guest_room_snapshot(repeat('a',64))),
  ('invalid2', public.get_guest_room_snapshot(repeat('a',64)));
SELECT is((SELECT payload->>'code' FROM abuse_results WHERE kind='invalid1'),
  'guest_access_lost', 'unproven token gets only a generic access-loss envelope');
SELECT is((SELECT payload->>'code' FROM abuse_results WHERE kind='invalid2'),
  'rate_limited', 'invalid token has a stricter per-token limit');

SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.36"}', true);
INSERT INTO abuse_results VALUES
  ('valid1', public.get_guest_room_snapshot(repeat('1',64))),
  ('valid2', public.get_guest_room_snapshot(repeat('1',64))),
  ('valid3', public.get_guest_room_snapshot(repeat('1',64))),
  ('valid4', public.get_guest_room_snapshot(repeat('1',64)));
SELECT is((SELECT payload->>'code' FROM abuse_results WHERE kind='valid4'),
  'rate_limited', 'valid grant has its own server-enforced snapshot ceiling');
SELECT is((SELECT count(*)::text FROM private.guest_abuse_windows
    WHERE kind='valid_grant' AND count=4), '1',
  'over-limit envelope commits its atomic counter instead of rolling it back');
SELECT ok(NOT EXISTS (
    SELECT 1 FROM private.guest_abuse_windows
    WHERE key_digest IN ('LIMIT1','192.0.2.31',repeat('1',64))
       OR length(key_digest) <> 64),
  'counter table contains only HMAC digests, not raw caller/code/token');

SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.37"}', true);
SELECT is((public.join_room_as_guest(repeat('X',1000),'Oversized',repeat('a',64))->>'code'),
  'invalid_request', 'oversized join input is rejected after caller admission without hashing the full code');
SELECT is((public.get_guest_room_snapshot(repeat('a',1000))->>'code'),
  'guest_access_lost', 'oversized snapshot bearer is treated as invalid without hashing the full input');

SELECT * FROM finish();
ROLLBACK;
