-- Issue #165: departure capture, retry, active roster, and final history.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

CREATE TEMP TABLE leave_ctx AS SELECT gen_random_uuid() host, gen_random_uuid() member,
  gen_random_uuid() room, gen_random_uuid() member_p, gen_random_uuid() handover_room;
GRANT SELECT ON leave_ctx TO authenticated;
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
SELECT id, 'authenticated', 'authenticated', id::text || '@leave165.test', now(), now(), now(),
  '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false
FROM leave_ctx, LATERAL (VALUES (host), (member)) ids(id);
INSERT INTO public.accounts (id, username)
SELECT id, 'Leave' || left(replace(id::text, '-', ''), 20)
FROM leave_ctx, LATERAL (VALUES (host), (member)) ids(id);
INSERT INTO public.game_sessions (id, owner_account_id, join_code, state, started_at)
SELECT room, host, 'LEFT165', 'in_progress', now() - interval '1 hour' FROM leave_ctx;
INSERT INTO public.participants (id, session_id, account_id, display_name,
  membership_type, session_role, current_drink_total)
SELECT member_p, room, member, 'Leaver', 'registered', 'member', 3 FROM leave_ctx;
INSERT INTO public.participants (session_id, display_name, membership_type,
  session_role, current_drink_total, guest_rejoin_token_hash, guest_grant_expires_at)
SELECT room, 'Guest', 'guest', 'member', 4,
  encode(extensions.digest(repeat('g',64), 'sha256'), 'hex'), now() + interval '1 hour'
FROM leave_ctx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', (SELECT member::text FROM leave_ctx), true);
SELECT is(public.leave_room_as_member((SELECT room FROM leave_ctx))->>'status', 'left',
  'member can leave a running game');
SELECT is(public.leave_room_as_member((SELECT room FROM leave_ctx))->>'status', 'left',
  'member retry is safe');
SELECT throws_ok(
  $$SELECT public.change_participant_drink(c.room, c.member_p, 1, gen_random_uuid())
    FROM leave_ctx c$$,
  'P0001', 'not_room_participant', 'departed member cannot write gameplay');
SET LOCAL ROLE postgres;
SELECT is((SELECT count(*)::int FROM public.gameplay_events e, leave_ctx c
  WHERE e.session_id=c.room AND e.actor_participant_id=c.member_p
    AND e.event_type='participant_left'), 1, 'member has one departure event');
SELECT is((SELECT current_drink_total FROM public.participants p, leave_ctx c
  WHERE p.id=c.member_p), 3::numeric, 'member drink total is retained');
SELECT is((SELECT count(*)::int FROM jsonb_array_elements(
  private.build_guest_room_snapshot((SELECT room FROM leave_ctx))->'participants') p,
  leave_ctx c WHERE p->>'id'=c.member_p::text), 1, 'played leaver stays in game snapshot');
SELECT is((SELECT count(*)::int FROM jsonb_array_elements(
  private.build_guest_room_snapshot((SELECT room FROM leave_ctx))->'activeRoster') p,
  leave_ctx c WHERE p->>'id'=c.member_p::text), 0, 'leaver leaves active roster');
SELECT is((SELECT (p->>'currentDrinkTotal')::numeric FROM public.gameplay_events e, leave_ctx c,
  jsonb_array_elements(e.payload->'historySnapshot'->'participants') p
  WHERE e.actor_participant_id=c.member_p AND e.event_type='participant_left'
    AND p->>'id'=c.member_p::text), 3::numeric,
  'event captures the frozen result');

SELECT is(public.leave_room_as_guest(repeat('g',64))->>'status', 'confirmed',
  'guest can leave a running game');
SELECT is(public.leave_room_as_guest(repeat('g',64))->>'status', 'confirmed',
  'same valid guest token retrieves confirmed result');
SELECT is((SELECT count(*)::int FROM public.gameplay_events e, leave_ctx c
  WHERE e.session_id=c.room AND e.event_type='participant_left'), 2,
  'guest retry does not create another event');
SELECT ok(public.get_guest_room_snapshot(repeat('g',64))->>'code'
  IN ('guest_access_lost', 'rate_limited'), 'departed guest cannot read the live room');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT member::text FROM leave_ctx), true);
SELECT is((SELECT count(*)::int FROM public.early_leave_results r, leave_ctx c
  WHERE r.session_id=c.room), 1, 'member can read own early result');
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM leave_ctx), true);
SELECT is((SELECT count(*)::int FROM public.early_leave_results r, leave_ctx c
  WHERE r.session_id=c.room), 0, 'host cannot read another account early result');
SELECT is(public.end_game_session((SELECT room FROM leave_ctx))->>'status', 'completed',
  'host can complete after departures');
SELECT is((SELECT count(*)::int FROM public.completed_session_summaries s,
  jsonb_array_elements(s.players) p, leave_ctx c
  WHERE s.session_id=c.room AND p->>'id'=c.member_p::text), 1,
  'final history contains the early leaver once');
SELECT is((SELECT count(*)::int FROM public.early_leave_results r, leave_ctx c
  WHERE r.session_id=c.room), 0, 'provisional result disappears after completion');

SET LOCAL ROLE postgres;
INSERT INTO public.game_sessions (id, owner_account_id, join_code, state, started_at)
SELECT handover_room, host, 'HAND165', 'in_progress', now() - interval '1 hour' FROM leave_ctx;
INSERT INTO public.participants (session_id, account_id, display_name,
  membership_type, session_role, current_drink_total)
SELECT handover_room, member, 'Successor', 'registered', 'member', 1 FROM leave_ctx;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM leave_ctx), true);
SELECT is(public.leave_room_as_host((SELECT handover_room FROM leave_ctx))->>'status',
  'transferred', 'host hands over a running game');
SET LOCAL ROLE postgres;
SELECT is((SELECT count(*)::int FROM public.gameplay_events e, leave_ctx c
  WHERE e.session_id=c.handover_room AND e.event_type='participant_left'
    AND e.payload ? 'historySnapshot'), 1, 'handover captures host result once');

SELECT * FROM finish();
ROLLBACK;
