-- 240_mid_game_reassignment.test.sql
-- 041_mid_game_reassignment.sql: host-only mutation, input/idempotency guards,
-- scoring immutability, and completion-history snapshots.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(54);

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL, detail text);
GRANT SELECT, INSERT ON TABLE results TO authenticated, anon;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
) VALUES
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'reassign-host@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'reassign-member@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false),
  ('00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'reassign-outsider@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false);

INSERT INTO public.accounts (id, preferred_display_name) VALUES
  ('00000000-0000-4000-8000-000000000101', 'Reassign Host'),
  ('00000000-0000-4000-8000-000000000102', 'Reassign Member'),
  ('00000000-0000-4000-8000-000000000103', 'Reassign Outsider');

INSERT INTO public.game_sessions (id, owner_account_id, join_code, state, common_match_id)
VALUES (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000101',
  'RASSIGN1',
  'in_progress'::public.session_state,
  NULL
);

-- Migration 025's owner-sync trigger creates the owner participant as part of
-- the session insert. Give that row the deterministic fixture id before adding
-- the member; inserting a second owner row would violate the session-account
-- uniqueness constraint.
UPDATE public.participants
SET id = '00000000-0000-4000-8000-000000000301',
    display_name = 'Reassign Host'
WHERE session_id = '00000000-0000-4000-8000-000000000201'
  AND account_id = '00000000-0000-4000-8000-000000000101';

INSERT INTO public.participants (
  id, session_id, account_id, display_name, membership_type, session_role
) VALUES
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000102', 'Reassign Member', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role);

INSERT INTO public.matches (
  id, session_id, source_provider, source_match_id, home_team_name, away_team_name
) VALUES
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', 'test', 'common', 'Common', 'Match'),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000201', 'test', 'one', 'One', 'Match'),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000201', 'test', 'two', 'Two', 'Match'),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000201', 'test', 'three', 'Three', 'Match');

UPDATE public.game_sessions
SET common_match_id = '00000000-0000-4000-8000-000000000401'
WHERE id = '00000000-0000-4000-8000-000000000201';

INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000401'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000402'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000403'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000401'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000402'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000403');

UPDATE public.participants
SET current_drink_total = 3.0
WHERE id = '00000000-0000-4000-8000-000000000302';
UPDATE public.matches
SET home_score = 2, away_score = 1
WHERE id = '00000000-0000-4000-8000-000000000402';

-- Preserve the real kickoff record shape so the replay invariant can fold the
-- persisted reassignment deltas forward from the canonical starting map.
INSERT INTO public.gameplay_events (
  session_id, sequence_number, actor_participant_id, event_type,
  idempotency_key, payload, created_at
) VALUES (
  '00000000-0000-4000-8000-000000000201',
  1,
  '00000000-0000-4000-8000-000000000301',
  'assignment_replaced',
  'reassign-kickoff-assignments',
  jsonb_build_object(
    'assignments', jsonb_build_array(
      jsonb_build_object('participantId', '00000000-0000-4000-8000-000000000301', 'matchId', '00000000-0000-4000-8000-000000000401'),
      jsonb_build_object('participantId', '00000000-0000-4000-8000-000000000301', 'matchId', '00000000-0000-4000-8000-000000000402'),
      jsonb_build_object('participantId', '00000000-0000-4000-8000-000000000301', 'matchId', '00000000-0000-4000-8000-000000000403'),
      jsonb_build_object('participantId', '00000000-0000-4000-8000-000000000302', 'matchId', '00000000-0000-4000-8000-000000000401'),
      jsonb_build_object('participantId', '00000000-0000-4000-8000-000000000302', 'matchId', '00000000-0000-4000-8000-000000000402'),
      jsonb_build_object('participantId', '00000000-0000-4000-8000-000000000302', 'matchId', '00000000-0000-4000-8000-000000000403')
    )
  ),
  now()
), (
  '00000000-0000-4000-8000-000000000201',
  2,
  '00000000-0000-4000-8000-000000000301',
  'session_started',
  'reassign-session-started',
  jsonb_build_object('startedAt', now()),
  now()
);
UPDATE public.game_sessions
SET last_event_sequence = 2
WHERE id = '00000000-0000-4000-8000-000000000201';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);

-- Happy path: replace match two with match four; Common Match survives.
SELECT is(
  public.reassign_participant_matches(
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000302',
    ARRAY[
      '00000000-0000-4000-8000-000000000403'::uuid,
      '00000000-0000-4000-8000-000000000404'::uuid
    ],
    '00000000-0000-4000-8000-000000000501'
  ) -> 'participantId',
  '"00000000-0000-4000-8000-000000000302"'::jsonb,
  'host can reassign an active participant'
);
SELECT is(
  (SELECT count(*)::integer FROM public.assignments WHERE participant_id = '00000000-0000-4000-8000-000000000302'),
  3,
  'the participant still has two non-Common slots plus Common Match'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.assignments WHERE participant_id = '00000000-0000-4000-8000-000000000302' AND match_id = '00000000-0000-4000-8000-000000000401'),
  'Common Match remains assigned'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.assignments WHERE participant_id = '00000000-0000-4000-8000-000000000302' AND match_id = '00000000-0000-4000-8000-000000000402'),
  'removed match is no longer assigned'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.assignments WHERE participant_id = '00000000-0000-4000-8000-000000000302' AND match_id = '00000000-0000-4000-8000-000000000404'),
  'new match is assigned'
);
SELECT is(
  (SELECT current_drink_total FROM public.participants WHERE id = '00000000-0000-4000-8000-000000000302'),
  3.0::numeric,
  'recorded drinks are untouched'
);
SELECT is(
  (SELECT home_score + away_score FROM public.matches WHERE id = '00000000-0000-4000-8000-000000000402'),
  3,
  'recorded goals are untouched'
);
SELECT is(
  (SELECT count(*)::integer FROM public.gameplay_events WHERE session_id = '00000000-0000-4000-8000-000000000201' AND event_type = 'assignment_reassigned'),
  1,
  'one audit event is appended'
);
SELECT is(
  (SELECT actor_participant_id FROM public.gameplay_events WHERE session_id = '00000000-0000-4000-8000-000000000201' AND event_type = 'assignment_reassigned'),
  '00000000-0000-4000-8000-000000000301'::uuid,
  'the event actor is the authenticated owner participant'
);
SELECT is(
  (SELECT payload -> 'requestedMatchIds' FROM public.gameplay_events WHERE session_id = '00000000-0000-4000-8000-000000000201' AND event_type = 'assignment_reassigned'),
  '["00000000-0000-4000-8000-000000000403", "00000000-0000-4000-8000-000000000404"]'::jsonb,
  'the event records the canonical desired set'
);
SELECT is(
  (SELECT payload -> 'resultingMatchIds' FROM public.gameplay_events WHERE session_id = '00000000-0000-4000-8000-000000000201' AND event_type = 'assignment_reassigned'),
  '["00000000-0000-4000-8000-000000000403", "00000000-0000-4000-8000-000000000404"]'::jsonb,
  'the event records the resulting set for replay'
);

-- No-op is successful without a second event.
SELECT is(
  public.reassign_participant_matches(
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000302',
    ARRAY[
      '00000000-0000-4000-8000-000000000403'::uuid,
      '00000000-0000-4000-8000-000000000404'::uuid
    ],
    '00000000-0000-4000-8000-000000000502'
  ) -> 'sequenceNumber',
  'null'::jsonb,
  'an empty delta does not allocate an event sequence'
);
SELECT is(
  (SELECT count(*)::integer FROM public.gameplay_events WHERE session_id = '00000000-0000-4000-8000-000000000201' AND event_type = 'assignment_reassigned'),
  1,
  'a no-op does not create an audit event'
);

-- Guard helper for expected errors.
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000403'::uuid], '00000000-0000-4000-8000-000000000503');
    INSERT INTO results VALUES ('count_mismatch', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('count_mismatch', SQLERRM = 'assignment_count_mismatch', SQLERRM); END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000401'::uuid, '00000000-0000-4000-8000-000000000404'::uuid], '00000000-0000-4000-8000-000000000504');
    INSERT INTO results VALUES ('common_match', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('common_match', SQLERRM = 'cannot_reassign_common_match', SQLERRM); END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000403'::uuid, gen_random_uuid()], '00000000-0000-4000-8000-000000000505');
    INSERT INTO results VALUES ('pool_match', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('pool_match', SQLERRM = 'match_not_in_room_pool', SQLERRM); END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000403'::uuid], '00000000-0000-4000-8000-000000000506');
    INSERT INTO results VALUES ('duplicate_match', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('duplicate_match', SQLERRM = 'invalid_reassignment_input', SQLERRM); END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', NULL, '00000000-0000-4000-8000-000000000507');
    INSERT INTO results VALUES ('null_set', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('null_set', SQLERRM = 'invalid_reassignment_input', SQLERRM); END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000403'::uuid, NULL], '00000000-0000-4000-8000-000000000508');
    INSERT INTO results VALUES ('null_element', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('null_element', SQLERRM = 'invalid_reassignment_input', SQLERRM); END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000402'::uuid, '00000000-0000-4000-8000-000000000404'::uuid], '00000000-0000-4000-8000-000000000501');
    INSERT INTO results VALUES ('key_reuse', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('key_reuse', SQLERRM = 'idempotency_key_reused', SQLERRM); END;
END $$;
DO $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid], '00000000-0000-4000-8000-000000000509');
    INSERT INTO results VALUES ('not_host', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('not_host', SQLERRM = 'not_host', SQLERRM); END;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
END $$;

SELECT ok((SELECT passed FROM results WHERE name = 'count_mismatch'), 'slot count guard');
SELECT ok((SELECT passed FROM results WHERE name = 'common_match'), 'Common Match guard');
SELECT ok((SELECT passed FROM results WHERE name = 'pool_match'), 'pool confinement guard');
SELECT ok((SELECT passed FROM results WHERE name = 'duplicate_match'), 'duplicate input guard');
SELECT ok((SELECT passed FROM results WHERE name = 'null_set'), 'null array guard');
SELECT ok((SELECT passed FROM results WHERE name = 'null_element'), 'null element guard');
SELECT ok((SELECT passed FROM results WHERE name = 'key_reuse'), 'idempotency fingerprint guard');
SELECT ok((SELECT passed FROM results WHERE name = 'not_host'), 'host-only guard');

-- Authentication, room identity, structural input, active-target, and actor
-- guards all fail before a mutation or event can be written.
SELECT set_config('request.jwt.claim.sub', NULL, true);
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches(
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000302',
      ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
      '00000000-0000-4000-8000-000000000513'
    );
    INSERT INTO results VALUES ('not_authenticated', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('not_authenticated', SQLERRM = 'not_authenticated', SQLERRM);
  END;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);

DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches(
      '00000000-0000-4000-8000-000000000999',
      '00000000-0000-4000-8000-000000000302',
      ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
      '00000000-0000-4000-8000-000000000514'
    );
    INSERT INTO results VALUES ('missing_room', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('missing_room', SQLERRM = 'room_not_found', SQLERRM);
  END;
  BEGIN
    PERFORM public.reassign_participant_matches(
      '00000000-0000-4000-8000-000000000201', NULL,
      ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
      '00000000-0000-4000-8000-000000000515'
    );
    INSERT INTO results VALUES ('null_participant', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('null_participant', SQLERRM = 'invalid_reassignment_input', SQLERRM);
  END;
  BEGIN
    PERFORM public.reassign_participant_matches(
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000302',
      ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
      NULL
    );
    INSERT INTO results VALUES ('null_key', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('null_key', SQLERRM = 'invalid_reassignment_input', SQLERRM);
  END;
END $$;

SET LOCAL ROLE postgres;
UPDATE public.participants
SET left_at = now()
WHERE id = '00000000-0000-4000-8000-000000000302';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches(
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000302',
      ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
      '00000000-0000-4000-8000-000000000516'
    );
    INSERT INTO results VALUES ('left_target', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('left_target', SQLERRM = 'participant_not_in_room', SQLERRM);
  END;
END $$;
SET LOCAL ROLE postgres;
UPDATE public.participants
SET left_at = NULL
WHERE id = '00000000-0000-4000-8000-000000000302';

-- A broken room identity must fail before target validation and before an
-- actor-less event could be inserted.
INSERT INTO public.game_sessions (id, owner_account_id, join_code, state)
VALUES (
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000101',
  'RASSIGN2',
  'in_progress'::public.session_state
);
DELETE FROM public.participants
WHERE session_id = '00000000-0000-4000-8000-000000000202';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches(
      '00000000-0000-4000-8000-000000000202',
      '00000000-0000-4000-8000-000000000302',
      ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
      '00000000-0000-4000-8000-000000000517'
    );
    INSERT INTO results VALUES ('missing_host_participant', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('missing_host_participant', SQLERRM = 'host_participant_not_found', SQLERRM);
  END;
END $$;

SELECT ok((SELECT passed FROM results WHERE name = 'not_authenticated'), 'authentication guard');
SELECT ok((SELECT passed FROM results WHERE name = 'missing_room'), 'room identity guard');
SELECT ok((SELECT passed FROM results WHERE name = 'null_participant'), 'null participant guard');
SELECT ok((SELECT passed FROM results WHERE name = 'null_key'), 'null idempotency key guard');
SELECT ok((SELECT passed FROM results WHERE name = 'left_target'), 'left participant guard');
SELECT ok((SELECT passed FROM results WHERE name = 'missing_host_participant'), 'active host actor guard');

-- A same-key retry returns the original response and creates no new event.
SELECT is(
  public.reassign_participant_matches(
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000302',
    ARRAY[
      '00000000-0000-4000-8000-000000000403'::uuid,
      '00000000-0000-4000-8000-000000000404'::uuid
    ],
    '00000000-0000-4000-8000-000000000501'
  ) -> 'sequenceNumber',
  (SELECT payload -> 'sequenceNumber' FROM public.gameplay_events WHERE idempotency_key = '00000000-0000-4000-8000-000000000501'),
  'same-key retry replays the original result'
);
SELECT is(
  (SELECT count(*)::integer FROM public.gameplay_events WHERE session_id = '00000000-0000-4000-8000-000000000201' AND event_type = 'assignment_reassigned'),
  1,
  'same-key retry does not duplicate the event'
);

DO $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
  BEGIN
    PERFORM public.reassign_participant_matches(
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000302',
      ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
      '00000000-0000-4000-8000-000000000501'
    );
    INSERT INTO results VALUES ('nonhost_replay', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('nonhost_replay', SQLERRM = 'not_host', SQLERRM);
  END;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'nonhost_replay'), 'non-host cannot replay a host key');

-- Closed/joinable/completed guards, plus snapshot creation and history.
SET LOCAL ROLE postgres;
UPDATE public.game_sessions SET state = 'joinable'::public.session_state WHERE id = '00000000-0000-4000-8000-000000000201';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid], '00000000-0000-4000-8000-000000000510');
    INSERT INTO results VALUES ('joinable', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('joinable', SQLERRM = 'game_not_in_progress', SQLERRM); END;
END $$;
SET LOCAL ROLE postgres;
UPDATE public.game_sessions SET state = 'closed'::public.session_state WHERE id = '00000000-0000-4000-8000-000000000201';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid], '00000000-0000-4000-8000-000000000511');
    INSERT INTO results VALUES ('closed', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('closed', SQLERRM = 'game_not_in_progress', SQLERRM); END;
END $$;
SET LOCAL ROLE postgres;
UPDATE public.game_sessions SET state = 'in_progress'::public.session_state WHERE id = '00000000-0000-4000-8000-000000000201';
SET LOCAL ROLE authenticated;

SELECT ok((SELECT passed FROM results WHERE name = 'joinable'), 'joinable guard');
SELECT ok((SELECT passed FROM results WHERE name = 'closed'), 'closed guard');

SELECT is(
  public.reassign_participant_matches(
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000302',
    ARRAY['00000000-0000-4000-8000-000000000402'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
    '00000000-0000-4000-8000-000000000512'
  ) -> 'sequenceNumber',
  to_jsonb(4::bigint),
  'a second reassignment gets the next event sequence'
);

SELECT is(
  public.reassign_participant_matches(
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000302',
    ARRAY[
      '00000000-0000-4000-8000-000000000403'::uuid,
      '00000000-0000-4000-8000-000000000404'::uuid
    ],
    '00000000-0000-4000-8000-000000000513'
  ) -> 'sequenceNumber',
  to_jsonb(5::bigint),
  'a later write wins and records the move-away-and-back delta'
);
SELECT is(
  (SELECT array_agg(match_id ORDER BY match_id)::text
   FROM public.assignments
   WHERE participant_id = '00000000-0000-4000-8000-000000000302'),
  ARRAY[
    '00000000-0000-4000-8000-000000000401'::uuid,
    '00000000-0000-4000-8000-000000000403'::uuid,
    '00000000-0000-4000-8000-000000000404'::uuid
  ]::text,
  'last-write-wins leaves the requested final set'
);

SELECT is(
  public.end_game_session('00000000-0000-4000-8000-000000000201') -> 'status',
  '"completed"'::jsonb,
  'completion captures the assignment map'
);
SET LOCAL ROLE postgres;
SELECT is(
  (SELECT count(*)::integer FROM public.assignment_snapshots WHERE session_id = '00000000-0000-4000-8000-000000000201'),
  (SELECT count(*)::integer FROM public.assignments WHERE session_id = '00000000-0000-4000-8000-000000000201'),
  'snapshot row count matches the captured assignment map'
);
SELECT is(
  (SELECT min(expected_assignment_count) FROM public.assignment_snapshots WHERE session_id = '00000000-0000-4000-8000-000000000201'),
  (SELECT count(*)::integer FROM public.assignment_snapshots WHERE session_id = '00000000-0000-4000-8000-000000000201'),
  'snapshot expected count is consistent'
);
SET LOCAL ROLE authenticated;
SELECT ok(
  (SELECT assignments_changed_during_play FROM public.completed_session_summaries WHERE session_id = '00000000-0000-4000-8000-000000000201'),
  'history flags a reassigned game'
);

SET LOCAL ROLE postgres;
SELECT is(
  (SELECT player_assignments -> '00000000-0000-4000-8000-000000000302' FROM public.completed_session_summaries WHERE session_id = '00000000-0000-4000-8000-000000000201'),
  (SELECT jsonb_agg(match_id::text ORDER BY match_id) FROM public.assignment_snapshots WHERE session_id = '00000000-0000-4000-8000-000000000201' AND participant_id = '00000000-0000-4000-8000-000000000302'),
  'history reads the completion snapshot'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.assignment_snapshots
    WHERE session_id = '00000000-0000-4000-8000-000000000201'
      AND participant_id = '00000000-0000-4000-8000-000000000302'
      AND match_id = '00000000-0000-4000-8000-000000000401'
  ),
  'the completion snapshot retains the Common Match'
);

-- Replay the persisted kickoff map and every ordered reassignment delta. The
-- resulting relation must equal the immutable completion checkpoint.
CREATE TEMP TABLE replay_assignments (
  participant_id uuid NOT NULL,
  match_id uuid NOT NULL,
  PRIMARY KEY (participant_id, match_id)
) ON COMMIT DROP;
INSERT INTO replay_assignments (participant_id, match_id)
SELECT (assignment ->> 'participantId')::uuid,
  (assignment ->> 'matchId')::uuid
FROM public.gameplay_events AS event
CROSS JOIN LATERAL jsonb_array_elements(event.payload -> 'assignments') AS assignment
WHERE event.session_id = '00000000-0000-4000-8000-000000000201'
  AND event.event_type = 'assignment_replaced'
  AND event.sequence_number = (
    SELECT max(kickoff.sequence_number)
    FROM public.gameplay_events AS kickoff
    WHERE kickoff.session_id = event.session_id
      AND kickoff.event_type = 'assignment_replaced'
      AND kickoff.sequence_number < (
        SELECT min(started.sequence_number)
        FROM public.gameplay_events AS started
        WHERE started.session_id = event.session_id
          AND started.event_type = 'session_started'
      )
  );
CREATE TEMP TABLE replay_before_first (LIKE replay_assignments INCLUDING ALL) ON COMMIT DROP;
INSERT INTO replay_before_first SELECT * FROM replay_assignments;

DO $$
DECLARE
  reassignment_event record;
BEGIN
  FOR reassignment_event IN
    SELECT event.payload
    FROM public.gameplay_events AS event
    WHERE event.session_id = '00000000-0000-4000-8000-000000000201'
      AND event.event_type = 'assignment_reassigned'
    ORDER BY event.sequence_number
  LOOP
    DELETE FROM replay_assignments AS current_assignment
    WHERE current_assignment.participant_id = (reassignment_event.payload ->> 'participantId')::uuid
      AND current_assignment.match_id IN (
        SELECT value::uuid
        FROM jsonb_array_elements_text(reassignment_event.payload -> 'removedMatchIds') AS removed(value)
      );
    INSERT INTO replay_assignments (participant_id, match_id)
    SELECT (reassignment_event.payload ->> 'participantId')::uuid,
      value::uuid
    FROM jsonb_array_elements_text(reassignment_event.payload -> 'addedMatchIds') AS added(value)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

SELECT ok(
  NOT EXISTS (
    SELECT participant_id, match_id FROM replay_assignments
    EXCEPT
    SELECT participant_id, match_id
    FROM public.assignment_snapshots
    WHERE session_id = '00000000-0000-4000-8000-000000000201'
  )
  AND NOT EXISTS (
    SELECT participant_id, match_id
    FROM public.assignment_snapshots
    WHERE session_id = '00000000-0000-4000-8000-000000000201'
    EXCEPT
    SELECT participant_id, match_id FROM replay_assignments
  ),
  'completion snapshot equals kickoff plus ordered reassignment deltas'
);

DO $$
DECLARE
  first_reassignment record;
BEGIN
  SELECT event.payload INTO first_reassignment
  FROM public.gameplay_events AS event
  WHERE event.session_id = '00000000-0000-4000-8000-000000000201'
    AND event.event_type = 'assignment_reassigned'
  ORDER BY event.sequence_number
  LIMIT 1;
  DELETE FROM replay_before_first AS current_assignment
  WHERE current_assignment.participant_id = (first_reassignment.payload ->> 'participantId')::uuid
    AND current_assignment.match_id IN (
      SELECT value::uuid
      FROM jsonb_array_elements_text(first_reassignment.payload -> 'removedMatchIds') AS removed(value)
    );
  INSERT INTO replay_before_first (participant_id, match_id)
  SELECT (first_reassignment.payload ->> 'participantId')::uuid,
    value::uuid
  FROM jsonb_array_elements_text(first_reassignment.payload -> 'addedMatchIds') AS added(value)
  ON CONFLICT DO NOTHING;
END $$;
SELECT ok(
  EXISTS (SELECT 1 FROM replay_before_first WHERE participant_id = '00000000-0000-4000-8000-000000000302' AND match_id = '00000000-0000-4000-8000-000000000403')
  AND EXISTS (SELECT 1 FROM replay_before_first WHERE participant_id = '00000000-0000-4000-8000-000000000302' AND match_id = '00000000-0000-4000-8000-000000000404')
  AND NOT EXISTS (SELECT 1 FROM replay_before_first WHERE participant_id = '00000000-0000-4000-8000-000000000302' AND match_id = '00000000-0000-4000-8000-000000000402'),
  'the persisted first delta reconstructs an earlier assignment moment'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.gameplay_events AS event
    WHERE event.session_id = '00000000-0000-4000-8000-000000000201'
      AND event.event_type = 'assignment_reassigned'
      AND (
        (event.payload -> 'addedMatchIds') ? '00000000-0000-4000-8000-000000000401'
        OR (event.payload -> 'removedMatchIds') ? '00000000-0000-4000-8000-000000000401'
      )
  ),
  'no reassignment delta ever removes or adds the Common Match'
);

-- Mutating the live assignment table after completion must not rewrite history.
DELETE FROM public.assignments
WHERE session_id = '00000000-0000-4000-8000-000000000201'
  AND participant_id = '00000000-0000-4000-8000-000000000302'
  AND match_id = '00000000-0000-4000-8000-000000000404';
INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000402'
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT player_assignments -> '00000000-0000-4000-8000-000000000302' FROM public.completed_session_summaries WHERE session_id = '00000000-0000-4000-8000-000000000201'),
  '["00000000-0000-4000-8000-000000000401", "00000000-0000-4000-8000-000000000403", "00000000-0000-4000-8000-000000000404"]'::jsonb,
  'history remains snapshot-backed after live assignments change'
);

SET LOCAL ROLE postgres;
DO $$ BEGIN
  BEGIN
    UPDATE public.assignment_snapshots SET captured_at = now() WHERE session_id = '00000000-0000-4000-8000-000000000201';
    INSERT INTO results VALUES ('snapshot_update', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('snapshot_update', SQLERRM = 'assignment_snapshot_is_immutable', SQLERRM); END;
  BEGIN
    DELETE FROM public.assignment_snapshots WHERE session_id = '00000000-0000-4000-8000-000000000201';
    INSERT INTO results VALUES ('snapshot_delete', false, 'no error');
  EXCEPTION WHEN OTHERS THEN INSERT INTO results VALUES ('snapshot_delete', SQLERRM = 'assignment_snapshot_is_immutable', SQLERRM); END;
END $$;
SET LOCAL ROLE authenticated;
SELECT ok((SELECT passed FROM results WHERE name = 'snapshot_update'), 'snapshot updates are blocked');
SELECT ok((SELECT passed FROM results WHERE name = 'snapshot_delete'), 'snapshot deletes are blocked');

-- A different request after completion is a state error; only the original
-- idempotency key is allowed to replay.
DO $$ BEGIN
  BEGIN
    PERFORM public.reassign_participant_matches(
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000302',
      ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
      '00000000-0000-4000-8000-000000000518'
    );
    INSERT INTO results VALUES ('completed_new_key', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('completed_new_key', SQLERRM = 'game_not_in_progress', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'completed_new_key'), 'completed room rejects a new reassignment');

-- A snapshot-less completed session retains the pre-feature history fallback,
-- and its unchanged-game flag remains false.
SET LOCAL ROLE postgres;
INSERT INTO public.game_sessions (id, owner_account_id, join_code, state)
VALUES (
  '00000000-0000-4000-8000-000000000203',
  '00000000-0000-4000-8000-000000000101',
  'RASSIGN3',
  'completed'::public.session_state
);
UPDATE public.participants
SET id = '00000000-0000-4000-8000-000000000303', display_name = 'Legacy Host'
WHERE session_id = '00000000-0000-4000-8000-000000000203'
  AND account_id = '00000000-0000-4000-8000-000000000101';
INSERT INTO public.matches (
  id, session_id, source_provider, source_match_id, home_team_name, away_team_name
) VALUES (
  '00000000-0000-4000-8000-000000000405',
  '00000000-0000-4000-8000-000000000203',
  'test', 'legacy', 'Legacy Home', 'Legacy Away'
);
INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES (
  '00000000-0000-4000-8000-000000000203',
  '00000000-0000-4000-8000-000000000303',
  '00000000-0000-4000-8000-000000000405'
);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT player_assignments -> '00000000-0000-4000-8000-000000000303' FROM public.completed_session_summaries WHERE session_id = '00000000-0000-4000-8000-000000000203'),
  '["00000000-0000-4000-8000-000000000405"]'::jsonb,
  'snapshot-less completed sessions use the live-assignment fallback'
);
SELECT ok(
  NOT (SELECT assignments_changed_during_play FROM public.completed_session_summaries WHERE session_id = '00000000-0000-4000-8000-000000000203'),
  'unchanged legacy history is not flagged as reassigned'
);

-- A deliberately partial snapshot is rejected instead of silently falling back.
SET LOCAL ROLE postgres;
INSERT INTO public.game_sessions (id, owner_account_id, join_code, state)
VALUES (
  '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000101',
  'RASSIGN4',
  'completed'::public.session_state
);
UPDATE public.participants
SET id = '00000000-0000-4000-8000-000000000304', display_name = 'Partial Host'
WHERE session_id = '00000000-0000-4000-8000-000000000204'
  AND account_id = '00000000-0000-4000-8000-000000000101';
INSERT INTO public.matches (
  id, session_id, source_provider, source_match_id, home_team_name, away_team_name
) VALUES (
  '00000000-0000-4000-8000-000000000406',
  '00000000-0000-4000-8000-000000000204',
  'test', 'partial', 'Partial Home', 'Partial Away'
);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.assignment_snapshots (
      session_id, participant_id, match_id, expected_assignment_count
    ) VALUES (
      '00000000-0000-4000-8000-000000000204',
      '00000000-0000-4000-8000-000000000304',
      '00000000-0000-4000-8000-000000000406',
      2
    );
    INSERT INTO results VALUES ('partial_snapshot', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('partial_snapshot', SQLERRM = 'assignment_snapshot_incomplete', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'partial_snapshot'), 'partial snapshots are rejected as incomplete');

-- The snapshot is retained for the session lifetime and cannot be pruned by a
-- normal authenticated caller; account deletion uses the service-only purge
-- RPC added alongside the immutable trigger.
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.assignment_snapshots', 'DELETE'),
  'authenticated callers cannot independently delete snapshots'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.purge_assignment_snapshots_for_sessions(uuid[])', 'EXECUTE'),
  'snapshot purge is service-role-only'
);

-- A retry after completion still replays before the room-state guard.
SELECT is(
  public.reassign_participant_matches(
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000302',
    ARRAY['00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000404'::uuid],
    '00000000-0000-4000-8000-000000000501'
  ) -> 'sequenceNumber',
  (SELECT payload -> 'sequenceNumber' FROM public.gameplay_events WHERE idempotency_key = '00000000-0000-4000-8000-000000000501'),
  'completed-room retry replays the original result'
);

SELECT * FROM finish();
ROLLBACK;
