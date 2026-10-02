-- #138: durable completion and caller-scoped history. All fixtures roll back.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

CREATE TEMP TABLE history_ctx AS SELECT
  gen_random_uuid() AS host, gen_random_uuid() AS member, gen_random_uuid() AS outsider,
  gen_random_uuid() AS room, gen_random_uuid() AS rollback_room,
  gen_random_uuid() AS guest, gen_random_uuid() AS member_p,
  gen_random_uuid() AS match, gen_random_uuid() AS provider_match;
GRANT SELECT ON history_ctx TO authenticated, anon;
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
SELECT id, 'authenticated', 'authenticated', id::text || '@history138.test', now(), now(), now(),
  '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false
FROM history_ctx, LATERAL (VALUES (host), (member), (outsider)) AS ids(id);
INSERT INTO public.accounts (id, username)
SELECT id, 'History' || left(replace(id::text, '-', ''), 20)
FROM history_ctx, LATERAL (VALUES (host), (member), (outsider)) AS ids(id);
INSERT INTO public.game_sessions (id, owner_account_id, join_code, state, started_at)
SELECT room, host, 'H138MAIN', 'in_progress'::public.session_state, now() - interval '1 hour' FROM history_ctx
UNION ALL SELECT rollback_room, host, 'H138ROLL', 'in_progress', now() FROM history_ctx;
UPDATE public.participants SET current_drink_total = 2
WHERE session_id = (SELECT room FROM history_ctx);
INSERT INTO public.participants (id, session_id, account_id, display_name, membership_type,
  session_role, left_at, current_drink_total, guest_rejoin_token_hash)
SELECT member_p, room, member, 'Former member', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role, now(), 3, NULL
FROM history_ctx
UNION ALL SELECT guest, room, NULL, 'Former guest', 'guest', 'member', now(), 4,
  encode(extensions.digest(repeat('a',64), 'sha256'), 'hex')
FROM history_ctx;
INSERT INTO public.matches (id, session_id, source_provider, source_match_id,
  home_team_name, away_team_name, home_score, away_score)
SELECT match, room, 'manual', NULL, 'Home', 'Away', 2, 1 FROM history_ctx
UNION ALL SELECT provider_match, room, 'espn', 'history138', 'Provider home', 'Provider away', 3, 2 FROM history_ctx;
INSERT INTO public.assignments (session_id, participant_id, match_id)
SELECT p.session_id, p.id, c.match FROM public.participants p JOIN history_ctx c ON c.room = p.session_id;
INSERT INTO public.gameplay_events (session_id, sequence_number, actor_participant_id,
  event_type, idempotency_key, payload)
SELECT c.room, public.allocate_event_sequence(c.room), p.id, 'participant_left',
  'h138-left-' || p.id::text, jsonb_build_object('participantId', p.id::text)
FROM history_ctx c JOIN public.participants p ON p.session_id = c.room AND p.left_at IS NOT NULL;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM history_ctx), true);
SELECT is(public.end_game_session((SELECT room FROM history_ctx))->>'status', 'completed',
  'host completes the running room');
SELECT ok((SELECT completed_at IS NOT NULL FROM public.game_sessions WHERE id = (SELECT room FROM history_ctx)),
  'completion records server time');
SELECT is((SELECT completed_at FROM public.game_sessions WHERE id = (SELECT room FROM history_ctx)),
  (SELECT created_at FROM public.gameplay_events WHERE session_id = (SELECT room FROM history_ctx)
    AND event_type = 'session_completed'), 'completion time agrees with its audit event');
CREATE TEMP TABLE history_before AS
SELECT * FROM public.completed_session_summaries WHERE session_id = (SELECT room FROM history_ctx);
SELECT is((SELECT session_total_players FROM history_before), 3, 'early leavers remain in canonical roster');
SELECT is((SELECT session_total_drinks FROM history_before), 9::numeric, 'early leaver drinks remain in totals');
SELECT is((SELECT session_total_goals FROM history_before), 8, 'manual and provider scores are retained');
SELECT is((SELECT count(*)::int FROM public.assignment_snapshots WHERE session_id = (SELECT room FROM history_ctx)),
  3, 'all participant assignments are frozen');
SELECT is((SELECT count(*)::int FROM history_before, jsonb_array_elements(players) p
  WHERE p->>'leftAt' IS NOT NULL), 2, 'history exposes departure times for early leavers');
SELECT is((SELECT player_assignments->((SELECT guest::text FROM history_ctx)) FROM history_before),
  jsonb_build_array((SELECT match::text FROM history_ctx)), 'guest final assignment is available in cloud history');
SELECT is(public.end_game_session((SELECT room FROM history_ctx))->>'status', 'completed', 'end retry is idempotent');
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id = (SELECT room FROM history_ctx)
  AND event_type = 'session_completed'), 1, 'end retry does not append another completion');
SELECT is((SELECT completed_at FROM public.game_sessions WHERE id = (SELECT room FROM history_ctx)),
  (SELECT completed_at FROM history_before), 'end retry preserves original completion time');
SELECT is((SELECT to_jsonb(s) FROM public.completed_session_summaries s WHERE session_id = (SELECT room FROM history_ctx)),
  (SELECT to_jsonb(b) FROM history_before b), 'end retry preserves every canonical result');

SELECT throws_ok(
  $$SELECT public.change_manual_score(room, match, 'home', 1, gen_random_uuid()) FROM history_ctx$$,
  'P0001', 'invalid_room_state', 'manual score writes stop after completion');
SELECT throws_ok(
  $$SELECT public.change_participant_drink(c.room, p.id, 1, gen_random_uuid())
    FROM history_ctx c JOIN public.participants p ON p.session_id=c.room AND p.account_id=c.host$$,
  'P0001', 'invalid_room_state', 'drink writes stop after completion');
SELECT throws_ok(
  $$SELECT public.reassign_participant_matches(c.room, p.id, ARRAY[c.provider_match], gen_random_uuid())
    FROM history_ctx c JOIN public.participants p ON p.session_id=c.room AND p.account_id=c.host$$,
  'P0001', 'game_not_in_progress', 'assignment writes stop after completion');
SELECT throws_ok(
  $$UPDATE public.matches SET home_score=99 WHERE session_id=(SELECT room FROM history_ctx)$$,
  '42501', NULL, 'direct client writes remain forbidden');

SET LOCAL ROLE postgres;
SELECT throws_ok(
  $$SELECT public.accept_provider_score_batch_from_edge(room, host, gen_random_uuid(), '[]'::jsonb) FROM history_ctx$$,
  'P0001', 'invalid_room_state', 'late trusted provider refresh cannot change completed results');
SET LOCAL ROLE authenticated;
SELECT is((SELECT to_jsonb(s) FROM public.completed_session_summaries s WHERE session_id = (SELECT room FROM history_ctx)),
  (SELECT to_jsonb(b) FROM history_before b), 'rejected late writes leave every canonical result unchanged');

SELECT is((SELECT username FROM private._history_account_display_names
  WHERE account_id = (SELECT member FROM history_ctx)), 'Former member',
  'registered comparison names use visible participant names without exposing profiles');
SELECT is((SELECT username FROM private._history_account_display_names
  WHERE account_id = (SELECT host FROM history_ctx)),
  'History' || left(replace((SELECT host::text FROM history_ctx), '-', ''), 20),
  'own current username stays available');
SELECT throws_ok($$SELECT guest_rejoin_token_hash FROM public.participants$$, '42501', NULL,
  'history grants do not reveal guest credentials');
-- Exceptions roll back the entire completion, including event, timestamp and state.
DO $$ BEGIN
  BEGIN
    PERFORM public.end_game_session((SELECT rollback_room FROM history_ctx));
    RAISE EXCEPTION USING ERRCODE='ZX138', MESSAGE='force rollback';
  EXCEPTION WHEN SQLSTATE 'ZX138' THEN NULL;
  END;
END $$;
SELECT is((SELECT state::text FROM public.game_sessions WHERE id=(SELECT rollback_room FROM history_ctx)),
  'in_progress', 'failed transaction does not leave a completed room');
SELECT ok((SELECT completed_at IS NULL FROM public.game_sessions WHERE id=(SELECT rollback_room FROM history_ctx)),
  'failed transaction does not leave a completion time');
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id=(SELECT rollback_room FROM history_ctx)),
  0, 'failed transaction does not leave a completion event');

SELECT set_config('request.jwt.claim.sub', (SELECT member::text FROM history_ctx), true);
SELECT is((SELECT count(*)::int FROM public.completed_session_summaries WHERE session_id=(SELECT room FROM history_ctx)),
  1, 'registered early leaver retains completed history access');
SELECT is((SELECT session_total_drinks FROM public.completed_session_summaries WHERE session_id=(SELECT room FROM history_ctx)),
  9::numeric, 'member and host see the same canonical totals');

SELECT set_config('request.jwt.claim.sub', (SELECT outsider::text FROM history_ctx), true);
SELECT is((SELECT count(*)::int FROM public.completed_session_summaries WHERE session_id=(SELECT room FROM history_ctx)),
  0, 'unrelated account cannot see completed room');
SELECT is((SELECT total_sessions FROM public.history_overview_totals), 0, 'overview does not leak other accounts totals');
SELECT is((SELECT count(*)::int FROM public.lifetime_player_stats), 0, 'lifetime stats do not leak other accounts players');
SELECT is((SELECT count(*)::int FROM public.assignment_snapshots WHERE session_id=(SELECT room FROM history_ctx)),
  0, 'snapshots enforce room membership');
SELECT is((SELECT count(*)::int FROM public.accounts WHERE id=(SELECT host FROM history_ctx)), 0,
  'history does not widen account profile access');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT throws_ok($$SELECT * FROM public.completed_session_summaries$$, '42501', NULL,
  'anonymous clients cannot query cloud history');
SELECT * FROM finish();
ROLLBACK;



