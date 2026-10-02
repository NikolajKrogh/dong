BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

CREATE TEMP TABLE realtime_ctx AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'realtime-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), member AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'realtime-member@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), outsider AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'realtime-outsider@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), accounts AS (
  INSERT INTO public.accounts (id, username)
  SELECT id, 'Realtime_Host' FROM host
  UNION ALL SELECT id, 'Realtime_Member' FROM member
  UNION ALL SELECT id, 'Realtime_Outsider' FROM outsider
  RETURNING id
), active_room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code, state)
  SELECT id, 'RT000001', 'in_progress'::public.session_state FROM host
  RETURNING id
), completed_room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code, state)
  SELECT id, 'RT000002', 'completed'::public.session_state FROM host
  RETURNING id
), active_host AS (
  INSERT INTO public.participants
    (session_id, account_id, display_name, membership_type, session_role)
  SELECT id, (SELECT id FROM host), 'Realtime Host',
    'registered'::public.participant_membership_type,
    'owner'::public.participant_session_role FROM active_room
  RETURNING id
), active_member AS (
  INSERT INTO public.participants
    (session_id, account_id, display_name, membership_type, session_role)
  SELECT id, (SELECT id FROM member), 'Realtime Member',
    'registered'::public.participant_membership_type,
    'member'::public.participant_session_role FROM active_room
  RETURNING id
), completed_host AS (
  INSERT INTO public.participants
    (session_id, account_id, display_name, membership_type, session_role)
  SELECT id, (SELECT id FROM host), 'Realtime Host',
    'registered'::public.participant_membership_type,
    'owner'::public.participant_session_role FROM completed_room
  RETURNING id
)
SELECT (SELECT id FROM host) AS host,
       (SELECT id FROM member) AS member,
       (SELECT id FROM outsider) AS outsider,
       (SELECT id FROM active_room) AS active_room,
       (SELECT id FROM completed_room) AS completed_room,
       (SELECT id FROM active_member) AS active_member;
GRANT SELECT ON TABLE realtime_ctx TO authenticated;

INSERT INTO public.gameplay_events (
  session_id, sequence_number, actor_participant_id, event_type,
  idempotency_key, payload, created_at
)
SELECT ctx.active_room, public.allocate_event_sequence(ctx.active_room), participant.id,
  'drink_changed', 'realtime-room-changed-test', '{}'::jsonb, now()
FROM realtime_ctx AS ctx
JOIN public.participants AS participant
  ON participant.session_id = ctx.active_room
 AND participant.account_id = ctx.host;
SELECT ok(EXISTS (
  SELECT 1
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND p.proname = 'broadcast_room_changed'
    AND p.prosrc LIKE '%realtime.send%'
    AND p.prosrc LIKE '%room_changed%'
    AND p.prosrc LIKE '%{}%'
    AND p.prosrc LIKE '%true%'
), 'gameplay event trigger sends an empty private room_changed broadcast');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', (SELECT member::text FROM realtime_ctx), true);
SELECT set_config('realtime.topic', 'room:' || (SELECT active_room::text FROM realtime_ctx), true);
SELECT is(private.can_access_room_realtime_channel(), true,
  'an active registered participant can authorize the private room topic');

SELECT set_config('request.jwt.claim.sub', (SELECT outsider::text FROM realtime_ctx), true);
SELECT is(private.can_access_room_realtime_channel(), false,
  'an unrelated authenticated user cannot authorize the room topic');

SELECT set_config('request.jwt.claim.sub', (SELECT member::text FROM realtime_ctx), true);
SELECT set_config('realtime.topic', 'room:00000000-0000-0000-0000-000000000000', true);
SELECT is(private.can_access_room_realtime_channel(), false,
  'a participant cannot authorize a different room topic');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM realtime_ctx), true);
SELECT set_config('realtime.topic', 'room:' || (SELECT completed_room::text FROM realtime_ctx), true);
SELECT is(private.can_access_room_realtime_channel(), false,
  'completed rooms cannot create new private Realtime subscriptions');

SET LOCAL ROLE postgres;
UPDATE public.participants SET left_at = now()
WHERE id = (SELECT active_member FROM realtime_ctx);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT member::text FROM realtime_ctx), true);
SELECT set_config('realtime.topic', 'room:' || (SELECT active_room::text FROM realtime_ctx), true);
SELECT is(private.can_access_room_realtime_channel(), false,
  'a departed participant cannot authorize the room topic');

SET LOCAL ROLE postgres;
UPDATE public.game_sessions SET state = 'closed'::public.session_state
WHERE id = (SELECT completed_room FROM realtime_ctx);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM realtime_ctx), true);
SELECT set_config('realtime.topic', 'room:' || (SELECT completed_room::text FROM realtime_ctx), true);
SELECT is(private.can_access_room_realtime_channel(), false,
  'a closed room no longer authorizes the topic');

SELECT ok((SELECT count(*) = 2 FROM pg_catalog.pg_policies
  WHERE schemaname = 'realtime' AND tablename = 'messages'
    AND policyname IN ('registered_room_realtime_read', 'registered_room_realtime_write')),
  'private room messages have explicit read and write policies');
SELECT ok(
  has_function_privilege('authenticated', 'private.can_access_room_realtime_channel()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'private.can_access_room_realtime_channel()', 'EXECUTE')
  AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgname = 'gameplay_events_broadcast_room_changed' AND NOT tgisinternal),
  'authorization helper is private and authenticated-only with an active broadcast trigger'
);
SELECT ok(to_regprocedure('public.can_access_room_realtime_channel()') IS NULL,
  'authorization is not exposed as a PostgREST RPC');

SELECT * FROM finish();
ROLLBACK;
