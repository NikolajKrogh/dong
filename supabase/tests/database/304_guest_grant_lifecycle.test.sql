BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

CREATE TEMP TABLE lifecycle_ctx AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'lifecycle-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, username)
  SELECT id, 'Lifecycle_Host' FROM host RETURNING id
), room_a AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'LIFE31' FROM account RETURNING id
), room_b AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'LIFE32' FROM account RETURNING id
), room_c AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'LIFE33' FROM account RETURNING id
), room_d AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'LIFE34' FROM account RETURNING id
)
SELECT (SELECT id FROM room_a) AS room_a, (SELECT id FROM room_b) AS room_b,
       (SELECT id FROM room_c) AS room_c, (SELECT id FROM room_d) AS room_d;

CREATE TEMP TABLE lifecycle_results (kind text PRIMARY KEY, payload jsonb);
INSERT INTO lifecycle_results VALUES
  ('join_a', public.join_room_as_guest('LIFE31', 'Casey', repeat('f',64))),
  ('join_b', public.join_room_as_guest('LIFE32', 'Alex', repeat('a',64))),
  ('join_c', public.join_room_as_guest('LIFE33', 'Jules', repeat('1',64))),
  ('join_d', public.join_room_as_guest('LIFE34', 'Taylor', repeat('2',64)));

INSERT INTO lifecycle_results VALUES
  ('leave_a', public.leave_room_as_guest(repeat('f',64))),
  ('leave_a_again', public.leave_room_as_guest(repeat('f',64)));

SELECT is((SELECT payload->>'status' FROM lifecycle_results WHERE kind='leave_a'),
  'confirmed', 'joinable leave confirms server revocation');
SELECT is((SELECT payload->>'status' FROM lifecycle_results WHERE kind='leave_a_again'),
  'already_invalid', 'repeat leave acknowledges already revoked access');
SELECT ok((SELECT left_at IS NOT NULL FROM public.participants
    WHERE id=(SELECT (payload->>'participantId')::uuid FROM lifecycle_results WHERE kind='join_a')),
  'confirmed leave records departure');
SELECT is(jsonb_array_length(private.build_guest_room_snapshot(
    (SELECT room_a FROM lifecycle_ctx))->'participants'), 1,
  'confirmed-left guest is removed from the active room roster');
SELECT is((SELECT count(*)::text FROM public.gameplay_events
    WHERE session_id=(SELECT room_a FROM lifecycle_ctx) AND event_type='participant_left'),
  '1', 'repeated leave emits one immutable departure event');

UPDATE public.game_sessions SET state='in_progress'::public.session_state
  WHERE id=(SELECT room_b FROM lifecycle_ctx);
INSERT INTO lifecycle_results VALUES ('leave_b', public.leave_room_as_guest(repeat('a',64)));
SELECT is((SELECT count(*)::text FROM public.gameplay_events
    WHERE session_id=(SELECT room_b FROM lifecycle_ctx) AND event_type='participant_left'),
  '1', 'in-progress departure emits one immutable event');
SELECT is((SELECT payload->>'status' FROM lifecycle_results WHERE kind='leave_b'),
  'confirmed', 'in-progress guest departure is confirmed');
SELECT ok((SELECT left_at IS NOT NULL FROM public.participants
    WHERE id=(SELECT (payload->>'participantId')::uuid FROM lifecycle_results WHERE kind='join_b')),
  'in-progress departure removes the guest from the active roster');

SELECT ok((public.get_guest_room_snapshot(repeat('f',64))->>'code')='guest_access_lost'
  AND (public.get_guest_room_snapshot(repeat('a',64))->>'code')='guest_access_lost'
  AND (public.get_guest_room_snapshot(repeat('1',64))->>'sessionId')=(SELECT room_c::text FROM lifecycle_ctx),
  'departed joinable and in-progress tokens are denied while an active grant remains valid');
SELECT is((SELECT count(*)::text FROM public.gameplay_events
    WHERE session_id=(SELECT room_a FROM lifecycle_ctx) AND event_type='participant_joined'),
  '1', 'join and leave preserve one join event');

UPDATE public.game_sessions SET state='completed'::public.session_state
  WHERE id=(SELECT room_c FROM lifecycle_ctx);
SELECT is((public.get_guest_room_snapshot(repeat('1',64))->>'finalOnly'), 'true',
  'completed room gives a final-only guest projection');
CREATE TEMP TABLE completed_before AS
SELECT (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.gameplay_events e
  WHERE e.session_id=(SELECT room_c FROM lifecycle_ctx)) AS events,
  (SELECT to_jsonb(p)-'guest_grant_expires_at' FROM public.participants p
  WHERE p.id=(SELECT (payload->>'participantId')::uuid FROM lifecycle_results WHERE kind='join_c')) AS participant;
SELECT is(public.leave_room_as_guest(repeat('1',64))->>'status', 'confirmed',
  'completed leave confirms credential revocation');
SELECT is(public.leave_room_as_guest(repeat('1',64))->>'status', 'already_invalid',
  'completed leave retry is idempotent');
SELECT is(public.get_guest_room_snapshot(repeat('1',64))->>'code', 'guest_access_lost',
  'completed leave revokes final-read access');
SELECT is((SELECT to_jsonb(p)-'guest_grant_expires_at' FROM public.participants p
  WHERE p.id=(SELECT (payload->>'participantId')::uuid FROM lifecycle_results WHERE kind='join_c')),
  (SELECT participant FROM completed_before), 'completed leave preserves historical participant and totals');
SELECT is((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.gameplay_events e
  WHERE e.session_id=(SELECT room_c FROM lifecycle_ctx)),
  (SELECT events FROM completed_before), 'completed leave neither rewrites nor appends gameplay history');
SELECT is((SELECT state::text FROM public.game_sessions WHERE id=(SELECT room_c FROM lifecycle_ctx)),
  'completed', 'completed leave preserves room state');
UPDATE public.game_sessions SET state='closed'::public.session_state
  WHERE id=(SELECT room_d FROM lifecycle_ctx);
SELECT is((public.get_guest_room_snapshot(repeat('2',64))->>'code'),
  'guest_access_lost', 'closed room denies guest read');

SELECT * FROM finish();
ROLLBACK;
