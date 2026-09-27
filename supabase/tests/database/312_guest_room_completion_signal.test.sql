-- 312_guest_room_completion_signal.test.sql
-- Host completion/closure gives currently valid guest grants a terminal,
-- no-data room_ended response. Other invalid grants stay indistinguishable.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'dong_guest_abuse_hmac_v1'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'dong_guest_abuse_hmac_v1'
    );
  END IF;
END $$;
SELECT set_config('request.headers',
  '{"x-dong-guest-caller":"192.0.2.10"}', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT plan(15);

CREATE TEMP TABLE signal_users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  display_name text
);
INSERT INTO signal_users VALUES
  (gen_random_uuid(), 'signal-complete@test.local', 'Signal Completion Host'),
  (gen_random_uuid(), 'signal-close@test.local', 'Signal Close Host');

INSERT INTO auth.users
  (id, aud, role, email, email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
SELECT id, 'authenticated', 'authenticated', email, now(), now(), now(),
       '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false
FROM signal_users;

INSERT INTO public.accounts (id, preferred_display_name)
SELECT id, display_name FROM signal_users;

CREATE TEMP TABLE signal_rooms (
  kind text PRIMARY KEY,
  session_id uuid NOT NULL,
  host_id uuid NOT NULL
);
INSERT INTO public.game_sessions (owner_account_id, join_code)
SELECT id, CASE email
  WHEN 'signal-complete@test.local' THEN 'SIGC01'
  ELSE 'SIGX01'
END
FROM signal_users;
INSERT INTO signal_rooms
SELECT CASE gs.join_code WHEN 'SIGC01' THEN 'complete' ELSE 'close' END,
       gs.id, gs.owner_account_id
FROM public.game_sessions gs
WHERE gs.join_code IN ('SIGC01', 'SIGX01');
INSERT INTO public.participants
  (session_id, account_id, display_name, membership_type, session_role)
SELECT r.session_id, r.host_id, u.display_name,
       'registered'::public.participant_membership_type,
       'owner'::public.participant_session_role
FROM signal_rooms r
JOIN signal_users u ON u.id = r.host_id ON CONFLICT (session_id, account_id) WHERE account_id IS NOT NULL DO NOTHING;
CREATE TEMP TABLE signal_ctx AS
SELECT
  (SELECT host_id FROM signal_rooms WHERE kind = 'complete') AS complete_host,
  (SELECT session_id FROM signal_rooms WHERE kind = 'complete') AS complete_room,
  (SELECT host_id FROM signal_rooms WHERE kind = 'close') AS close_host,
  (SELECT session_id FROM signal_rooms WHERE kind = 'close') AS close_room;
GRANT SELECT ON signal_ctx TO authenticated;

-- Four guests in the completion room cover active, rotated, expired, and left
-- credentials. A guest in the second room covers the host-close branch.
SELECT public.join_room_as_guest('SIGC01', 'Active guest', repeat('c', 64));
SELECT public.join_room_as_guest('SIGC01', 'Rotated guest', repeat('a', 64));
SELECT public.join_room_as_guest('SIGC01', 'Expired guest', repeat('e', 64));
SELECT public.join_room_as_guest('SIGC01', 'Departed guest', repeat('f', 64));
SELECT public.join_room_as_guest('SIGX01', 'Closed-room guest', repeat('d', 64));

SELECT is(
  public.rotate_guest_room_grant(repeat('a', 64), repeat('b', 64), gen_random_uuid())->>'ok',
  'true',
  'guest rotation replaces the current token before the room ends'
);

UPDATE public.participants
SET guest_grant_issued_at = now() - interval '2 hours',
    guest_grant_expires_at = now() - interval '1 hour'
WHERE guest_rejoin_token_hash = encode(extensions.digest(repeat('e', 64), 'sha256'), 'hex');
UPDATE public.game_sessions
SET state = 'in_progress'::public.session_state
WHERE id IN (SELECT session_id FROM signal_rooms);
SELECT is(
  public.leave_room_as_guest(repeat('f', 64))->>'status',
  'confirmed',
  'the departed guest is already invalid before host completion'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', (SELECT complete_host::text FROM signal_ctx), true);
SELECT is(
  public.end_game_session((SELECT complete_room FROM signal_ctx))->>'status',
  'completed',
  'host completion succeeds'
);

SET LOCAL ROLE postgres;
SELECT ok(
  (SELECT guest_revocation_reason = 'room_ended'
      AND guest_grant_expires_at <= now() AND left_at IS NULL
   FROM public.participants
   WHERE guest_rejoin_token_hash = encode(extensions.digest(repeat('c', 64), 'sha256'), 'hex')),
  'completion marks and expires the currently valid guest grant'
);
SELECT ok(
  (SELECT guest_revocation_reason IS NULL
      AND guest_grant_expires_at < now()
   FROM public.participants
   WHERE guest_rejoin_token_hash = encode(extensions.digest(repeat('e', 64), 'sha256'), 'hex'))
  AND
  (SELECT guest_revocation_reason IS NULL AND left_at IS NOT NULL
   FROM public.participants
   WHERE guest_rejoin_token_hash = encode(extensions.digest(repeat('f', 64), 'sha256'), 'hex')),
  'completion leaves naturally expired and departed grants unmarked'
);

SET LOCAL ROLE postgres;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT is(
  public.rotate_guest_room_grant(repeat('b', 64), repeat('9', 64), gen_random_uuid())->>'code',
  'room_unavailable',
  'guest grant rotation is rejected after host completion'
);
SELECT is(
  public.get_guest_room_snapshot(repeat('c', 64)),
  jsonb_build_object('ok', false, 'code', 'room_ended'),
  'a currently valid token receives only the room_ended error envelope'
);
SELECT is(
  public.get_guest_room_snapshot(repeat('b', 64))->>'code',
  'room_ended',
  'the replacement current token receives the terminal signal'
);
SELECT is(
  public.get_guest_room_snapshot(repeat('a', 64))->>'code',
  'guest_access_lost',
  'a replaced token stays a generic invalid credential after completion'
);
SELECT is(
  public.get_guest_room_snapshot(repeat('e', 64))->>'code',
  'guest_access_lost',
  'a naturally expired token stays a generic invalid credential'
);
SELECT is(
  public.get_guest_room_snapshot(repeat('f', 64))->>'code',
  'guest_access_lost',
  'a departed guest token stays a generic invalid credential'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', (SELECT close_host::text FROM signal_ctx), true);
SELECT is(
  public.leave_room_as_host((SELECT close_room FROM signal_ctx))->>'status',
  'closed',
  'host closure succeeds when there is no registered successor'
);

SET LOCAL ROLE postgres;
SELECT is(
  (SELECT state::text FROM public.game_sessions
   WHERE id = (SELECT close_room FROM signal_ctx)),
  'closed',
  'the host-close branch leaves the room terminal'
);
SELECT ok(
  (SELECT guest_revocation_reason = 'room_ended'
      AND guest_grant_expires_at <= now() AND left_at IS NULL
   FROM public.participants
   WHERE guest_rejoin_token_hash = encode(extensions.digest(repeat('d', 64), 'sha256'), 'hex')),
  'host closure marks and expires the currently valid guest grant'
);
SET LOCAL ROLE postgres;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT is(
  public.get_guest_room_snapshot(repeat('d', 64)),
  jsonb_build_object('ok', false, 'code', 'room_ended'),
  'a closed room returns the same safe terminal envelope'
);

SELECT * FROM finish();
ROLLBACK;
