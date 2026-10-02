BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT has_column('public', 'participants', 'guest_grant_issued_at', 'guest issue timestamp exists');
SELECT has_column('public', 'participants', 'guest_grant_expires_at', 'guest expiry timestamp exists');
SELECT has_column('public', 'participants', 'guest_grant_previous_hash', 'rotation retry hash exists');
SELECT has_column('public', 'participants', 'guest_grant_rotation_id', 'rotation operation id exists');
SELECT ok(to_regclass('public.ux_participants_guest_token_global') IS NOT NULL,
  'current guest token hash has a global unique index');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.participants p
  WHERE p.membership_type = 'guest'::public.participant_membership_type
    AND p.left_at IS NULL AND p.guest_grant_expires_at IS NULL
), 'all migrated active guest hashes have an expiry');

CREATE TEMP TABLE hardening_ctx AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'hardening-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, username)
  SELECT id, 'Hardening_Host' FROM host RETURNING id
), room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'HARD01' FROM account RETURNING id
)
SELECT (SELECT id FROM host) AS host_id, (SELECT id FROM room) AS room_id;

SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.10"}', true);
SELECT public.join_room_as_guest('HARD01', 'Guest', repeat('a', 64));
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.participants p
  WHERE p.session_id = (SELECT room_id FROM hardening_ctx)
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND (p.guest_grant_issued_at IS NOT NULL OR p.guest_grant_expires_at IS NOT NULL)
), 'registered host has no guest grant timestamps');

UPDATE public.participants
SET guest_grant_issued_at = now() - interval '2 hours',
    guest_grant_expires_at = now() - interval '1 minute'
WHERE session_id = (SELECT room_id FROM hardening_ctx)
  AND membership_type = 'guest';
SELECT is((public.get_guest_room_snapshot(repeat('a', 64))->>'code'),
  'guest_access_lost', 'expired guest cannot read room');

UPDATE public.participants
SET guest_grant_expires_at = now() + interval '1 hour', left_at = now()
WHERE session_id = (SELECT room_id FROM hardening_ctx)
  AND membership_type = 'guest';
SELECT is((public.get_guest_room_snapshot(repeat('a', 64))->>'code'),
  'guest_access_lost', 'left guest cannot read room');

UPDATE public.participants
SET left_at = NULL
WHERE session_id = (SELECT room_id FROM hardening_ctx)
  AND membership_type = 'guest';
UPDATE public.game_sessions SET state = 'closed'::public.session_state
WHERE id = (SELECT room_id FROM hardening_ctx);
SELECT is((public.get_guest_room_snapshot(repeat('a', 64))->>'code'),
  'guest_access_lost', 'closed room denies guest read');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', (SELECT host_id::text FROM hardening_ctx), true);
SELECT lives_ok(format('SELECT public.get_room_snapshot(%L::uuid)',
  (SELECT room_id::text FROM hardening_ctx)), 'registered host snapshot still callable');

SELECT * FROM finish();
ROLLBACK;
