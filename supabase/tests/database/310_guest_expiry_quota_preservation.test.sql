BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);

CREATE TEMP TABLE quota_ctx AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'guest-expiry-quota-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, preferred_display_name)
  SELECT id, 'Guest Expiry Quota Host' FROM host RETURNING id
), room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'QUOTA1' FROM account RETURNING id
)
SELECT (SELECT id FROM room) AS room_id;

CREATE TEMP TABLE quota_join AS
SELECT public.join_room_as_guest('QUOTA1', 'Quota Guest', repeat('q', 64)) AS result;
SELECT ok((SELECT result->>'participantId' IS NOT NULL FROM quota_join),
  'test guest joins and seeds caller and code abuse windows');

UPDATE private.guest_abuse_config
SET join_caller_limit = 1, join_code_limit = 1;
CREATE TEMP TABLE quota_before_expiry AS
SELECT kind, key_digest, window_start, count
FROM private.guest_abuse_windows
WHERE kind IN ('join_caller', 'join_code');
SELECT is((SELECT count(*)::integer FROM quota_before_expiry), 2,
  'one caller and one submitted-code counter exist before expiry');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM quota_before_expiry WHERE count <> 1
), 'both windows have one charged attempt before expiry');

UPDATE public.participants
SET guest_grant_issued_at = now() - interval '2 hours',
    guest_grant_expires_at = now() - interval '1 hour'
WHERE guest_rejoin_token_hash =
  encode(extensions.digest(repeat('q', 64), 'sha256'), 'hex');

SELECT is(
  (SELECT jsonb_agg(jsonb_build_object('kind', kind, 'count', count) ORDER BY kind)
   FROM quota_before_expiry),
  (SELECT jsonb_agg(jsonb_build_object('kind', kind, 'count', count) ORDER BY kind)
   FROM private.guest_abuse_windows
   WHERE kind IN ('join_caller', 'join_code')),
  'grant expiry leaves existing caller and submitted-code counters unchanged');
SELECT is(
  private.take_guest_quota('join_caller', '192.0.2.10', 1, 300)->>'code',
  'rate_limited', 'caller limit still rejects excess attempts after grant expiry');
SELECT is(
  private.take_guest_quota('join_code', 'QUOTA1', 1, 300)->>'code',
  'rate_limited', 'submitted-code limit still rejects excess attempts after grant expiry');
SELECT is((SELECT sum(count)::integer FROM private.guest_abuse_windows
    WHERE kind IN ('join_caller', 'join_code')),
  4, 'limited attempts remain charged instead of being refunded');
SELECT ok(EXISTS (
  SELECT 1 FROM public.participants
  WHERE guest_rejoin_token_hash =
    encode(extensions.digest(repeat('q', 64), 'sha256'), 'hex')
    AND left_at IS NULL AND guest_grant_expires_at <= now()
), 'quota enforcement is independent of the retained expired guest identity');

SELECT * FROM finish();
ROLLBACK;
