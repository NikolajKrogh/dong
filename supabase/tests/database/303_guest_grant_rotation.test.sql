BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

CREATE TEMP TABLE rotation_ctx AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'rotation-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, preferred_display_name)
  SELECT id, 'Rotation Host' FROM host RETURNING id
), room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'ROT301' FROM account RETURNING id
), room_b AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'ROT302' FROM account RETURNING id
)
SELECT (SELECT id FROM room) AS room_id,
       (SELECT id FROM room_b) AS other_room_id;

CREATE TEMP TABLE rotation_results (kind text PRIMARY KEY, payload jsonb);
INSERT INTO rotation_results VALUES
  ('join', public.join_room_as_guest('ROT301', 'Casey', repeat('c', 64)));

SELECT has_function('public', 'rotate_guest_room_grant', ARRAY['text', 'text', 'uuid'],
  'rotation has a public, fixed-signature entry point');

INSERT INTO rotation_results VALUES
  ('rotate', public.rotate_guest_room_grant(
    repeat('c',64), repeat('d',64), '00000000-0000-4000-8000-000000000301')),
  ('retry', public.rotate_guest_room_grant(
    repeat('c',64), repeat('d',64), '00000000-0000-4000-8000-000000000301')),
  ('wrong_new', public.rotate_guest_room_grant(
    repeat('c',64), repeat('e',64), '00000000-0000-4000-8000-000000000301')),
  ('wrong_id', public.rotate_guest_room_grant(
    repeat('c',64), repeat('d',64), '00000000-0000-4000-8000-000000000302'));

SELECT is((SELECT payload->>'ok' FROM rotation_results WHERE kind='rotate'), 'true',
  'first rotation confirms success');
SELECT is((SELECT payload->>'replayed' FROM rotation_results WHERE kind='retry'), 'true',
  'exact retry confirms without another rotation');
SELECT is((SELECT payload->>'code' FROM rotation_results WHERE kind='wrong_new'), 'guest_access_lost',
  'same operation with different replacement cannot replay');
SELECT is((SELECT payload->>'code' FROM rotation_results WHERE kind='wrong_id'), 'guest_access_lost',
  'same tokens with different operation cannot replay');
SELECT ok((SELECT payload ? 'newToken' FROM rotation_results WHERE kind='rotate') = false,
  'rotation never echoes a raw replacement token');
SELECT ok((SELECT guest_rejoin_token_hash = encode(extensions.digest(repeat('d',64),'sha256'),'hex')
    AND guest_grant_previous_hash = encode(extensions.digest(repeat('c',64),'sha256'),'hex')
    FROM public.participants WHERE id = (SELECT (payload->>'participantId')::uuid FROM rotation_results WHERE kind='join')),
  'current and previous hashes swap atomically');

SELECT ok((public.get_guest_room_snapshot(repeat('c',64))->>'code')='guest_access_lost'
  AND (public.get_guest_room_snapshot(repeat('d',64))->>'sessionId')=(SELECT room_id::text FROM rotation_ctx),
  'old bearer is denied immediately while new bearer reads');
SELECT is((public.join_room_as_guest('ROT302','Copied',repeat('c',64))->>'code'),
  'room_unavailable', 'replaced bearer cannot be rebound to another room');
SELECT is((SELECT count(*)::text FROM public.gameplay_events e
  WHERE e.session_id=(SELECT room_id FROM rotation_ctx) AND e.event_type='participant_joined'),
  '1', 'rotation and retry never duplicate the join event');

UPDATE public.participants SET guest_grant_retry_until=now()-interval '1 second'
  WHERE id=(SELECT (payload->>'participantId')::uuid FROM rotation_results WHERE kind='join');
SELECT is((public.rotate_guest_room_grant(repeat('c',64), repeat('d',64),
    '00000000-0000-4000-8000-000000000301')->>'code'),
  'guest_access_lost', 'old-hash retry confirmation ends after bounded window');

UPDATE public.participants SET
  guest_grant_issued_at=now()-interval '49 hours',
  guest_grant_expires_at=now()-interval '1 hour'
  WHERE id=(SELECT (payload->>'participantId')::uuid FROM rotation_results WHERE kind='join');
SELECT is((public.rotate_guest_room_grant(repeat('d',64), repeat('e',64),
    '00000000-0000-4000-8000-000000000303')->>'code'),
  'guest_access_lost', 'expired current grant cannot rotate');

SELECT * FROM finish();
ROLLBACK;
