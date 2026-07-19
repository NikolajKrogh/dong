BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(26);

-- Seed: three hosts each owning a joinable room, plus a registered member in room 1.
CREATE TEMP TABLE ctx AS
WITH h1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','csg-h1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
h2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','csg-h2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
h3 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','csg-h3@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','csg-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CSG Host One' FROM h1
    UNION ALL SELECT id, 'CSG Host Two' FROM h2
    UNION ALL SELECT id, 'CSG Host Three' FROM h3
    UNION ALL SELECT id, 'CSG Member One' FROM m1
    RETURNING id
),
r1 AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'CSGR01' FROM h1 RETURNING id),
r2 AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'CSGR02' FROM h2 RETURNING id),
r3 AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id,'CSGR03' FROM h3 RETURNING id)
SELECT (SELECT id FROM h1) AS h1, (SELECT id FROM h2) AS h2, (SELECT id FROM h3) AS h3, (SELECT id FROM m1) AS m1,
       (SELECT id FROM r1) AS r1, (SELECT id FROM r2) AS r2, (SELECT id FROM r3) AS r3;

GRANT SELECT ON TABLE ctx TO authenticated;

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL);
GRANT INSERT ON TABLE results TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- Join m1 into r1 as a registered member (needed for assignment tests).
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM ctx), true);
CREATE TEMP TABLE m1_join AS SELECT public.join_room_as_registered('CSGR01') AS payload;

-- ---------------------------------------------------------------------------
-- add_room_match (US1, FR-014 dedupe) + not_host guard
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT h1::text FROM ctx), true);
CREATE TEMP TABLE match_a AS SELECT public.add_room_match((SELECT r1 FROM ctx), 'espn', 'espn-m1', 'Home A', 'Away A', now()) AS id;
CREATE TEMP TABLE match_a_repeat AS SELECT public.add_room_match((SELECT r1 FROM ctx), 'espn', 'espn-m1', 'Home A', 'Away A', now()) AS id;
CREATE TEMP TABLE match_b AS SELECT public.add_room_match((SELECT r1 FROM ctx), 'espn', 'espn-m2', 'Home B', 'Away B', now()) AS id;

-- Snapshotted here, before the "remove_room_match" section below deletes match_a
-- (it becomes r1's common match and is then removed to test that clears
-- common_match_id) — the dedupe assertion needs the row count as it stood right
-- after the add_room_match/add_room_match-repeat calls, not at end-of-script.
CREATE TEMP TABLE match_a_dedupe_count AS
  SELECT count(*)::int AS n FROM public.matches
  WHERE session_id = (SELECT r1 FROM ctx) AND source_match_id = 'espn-m1';

SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.add_room_match((SELECT r1 FROM ctx), 'espn', 'espn-m3', 'Home C', 'Away C', now());
    INSERT INTO results VALUES ('add_room_match_not_host_v2', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('add_room_match_not_host_v2', SQLERRM = 'not_host');
  END;
END $$;

-- ---------------------------------------------------------------------------
-- set_common_match (US2) — set, no-op replay, match_not_found
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT h1::text FROM ctx), true);
SELECT public.set_common_match((SELECT r1 FROM ctx), (SELECT id FROM match_a));
SELECT public.set_common_match((SELECT r1 FROM ctx), (SELECT id FROM match_a)); -- no-op replay

DO $$ BEGIN
  BEGIN
    PERFORM public.set_common_match((SELECT r1 FROM ctx), gen_random_uuid());
    INSERT INTO results VALUES ('set_common_match_not_found', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('set_common_match_not_found', SQLERRM = 'match_not_found');
  END;
END $$;

-- ---------------------------------------------------------------------------
-- set_room_assignments (US3) — replace semantics
-- ---------------------------------------------------------------------------
SELECT public.set_room_assignments(
  (SELECT r1 FROM ctx),
  jsonb_build_array(
    jsonb_build_object('participantId', (SELECT payload->>'participantId' FROM m1_join), 'matchId', (SELECT id::text FROM match_b))
  )
);

-- ---------------------------------------------------------------------------
-- remove_room_match — purges assignments/common match, idempotent repeat
-- ---------------------------------------------------------------------------
SELECT public.remove_room_match((SELECT r1 FROM ctx), (SELECT id FROM match_b));
SELECT public.remove_room_match((SELECT r1 FROM ctx), (SELECT id FROM match_b)); -- no-op, already gone
SELECT public.remove_room_match((SELECT r1 FROM ctx), (SELECT id FROM match_a)); -- was the common match

-- ---------------------------------------------------------------------------
-- start_game_session (US3) — success, row-lock/state-guard, not_host
-- ---------------------------------------------------------------------------
-- Give r2 a valid start-game configuration first (h2 is both host and, thanks to
-- sync_session_owner_participant, the room's sole participant) so the happy path
-- below also exercises start_game_session's own FR-006–FR-009 backstop re-check.
SELECT set_config('request.jwt.claim.sub', (SELECT h2::text FROM ctx), true);
CREATE TEMP TABLE r2_common_match AS SELECT public.add_room_match((SELECT r2 FROM ctx), 'espn', 'espn-r2-1', 'Home R2A', 'Away R2A', now()) AS id;
CREATE TEMP TABLE r2_extra_match AS SELECT public.add_room_match((SELECT r2 FROM ctx), 'espn', 'espn-r2-2', 'Home R2B', 'Away R2B', now()) AS id;
SELECT public.set_common_match((SELECT r2 FROM ctx), (SELECT id FROM r2_common_match));
CREATE TEMP TABLE r2_host_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT r2 FROM ctx) AND account_id = (SELECT h2 FROM ctx);
SELECT public.set_room_assignments(
  (SELECT r2 FROM ctx),
  jsonb_build_array(jsonb_build_object(
    'participantId', (SELECT id::text FROM r2_host_participant), 'matchId', (SELECT id::text FROM r2_extra_match)))
);

CREATE TEMP TABLE start_result AS SELECT public.start_game_session((SELECT r2 FROM ctx), gen_random_uuid()) AS payload;

DO $$ BEGIN
  BEGIN
    PERFORM public.start_game_session((SELECT r2 FROM ctx), gen_random_uuid());
    INSERT INTO results VALUES ('start_game_twice_invalid_state', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('start_game_twice_invalid_state', SQLERRM = 'invalid_room_state');
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', (SELECT h1::text FROM ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.start_game_session((SELECT r2 FROM ctx), gen_random_uuid());
    INSERT INTO results VALUES ('start_game_not_host', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('start_game_not_host', SQLERRM = 'not_host');
  END;
END $$;

-- ---------------------------------------------------------------------------
-- start_game_session backstop (research.md R4/R7) — re-validates FR-006–FR-009
-- under its own row lock, independent of the Java-side optimistic check, closing
-- the race where the room's configuration changes between a get_room_snapshot
-- read and this call. r3 is joinable but has no matches selected.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT h3::text FROM ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.start_game_session((SELECT r3 FROM ctx), gen_random_uuid());
    INSERT INTO results VALUES ('start_game_backstop_empty_matches', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('start_game_backstop_empty_matches', SQLERRM = 'empty_matches');
  END;
END $$;

-- ---------------------------------------------------------------------------
-- command_idempotency: reserved / in_flight / replay / conflict / release-then-reserve
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT h1::text FROM ctx), true);

CREATE TEMP TABLE idem_key AS SELECT gen_random_uuid() AS k;
CREATE TEMP TABLE idem_reserved AS SELECT public.reserve_command_idempotency((SELECT k FROM idem_key), 'start-game', (SELECT r1 FROM ctx)) AS outcome;
CREATE TEMP TABLE idem_in_flight AS SELECT public.reserve_command_idempotency((SELECT k FROM idem_key), 'start-game', (SELECT r1 FROM ctx)) AS outcome;
SELECT public.complete_command_idempotency((SELECT k FROM idem_key), 'ACCEPTED', jsonb_build_object('sessionId', (SELECT r1::text FROM ctx)));
CREATE TEMP TABLE idem_replay AS SELECT public.reserve_command_idempotency((SELECT k FROM idem_key), 'start-game', (SELECT r1 FROM ctx)) AS outcome;
CREATE TEMP TABLE idem_conflict AS SELECT public.reserve_command_idempotency((SELECT k FROM idem_key), 'start-game', (SELECT r2 FROM ctx)) AS outcome;

CREATE TEMP TABLE idem_key2 AS SELECT gen_random_uuid() AS k;
CREATE TEMP TABLE idem_reserved2 AS SELECT public.reserve_command_idempotency((SELECT k FROM idem_key2), 'start-game', (SELECT r1 FROM ctx)) AS outcome;
SELECT public.release_command_idempotency((SELECT k FROM idem_key2));
CREATE TEMP TABLE idem_reserved2_again AS SELECT public.reserve_command_idempotency((SELECT k FROM idem_key2), 'start-game', (SELECT r1 FROM ctx)) AS outcome;

SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Assertions
-- ---------------------------------------------------------------------------
SELECT is((SELECT n FROM match_a_dedupe_count), 1, 'add_room_match inserts exactly one row per fixture');
SELECT is((SELECT id FROM match_a_repeat), (SELECT id FROM match_a), 'repeat add_room_match of the same fixture returns the existing match id (FR-014)');
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id = (SELECT r1 FROM ctx) AND event_type = 'match_added'), 2, 'match_added is emitted once per distinct fixture, not on the dedup replay');
SELECT ok((SELECT passed FROM results WHERE name = 'add_room_match_not_host_v2'), 'add_room_match rejects a non-owner participant with not_host');

SELECT is((SELECT common_match_id FROM public.game_sessions WHERE id = (SELECT r1 FROM ctx)), NULL, 'common_match_id is cleared once the common match is removed');
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id = (SELECT r1 FROM ctx) AND event_type = 'common_match_selected'), 1, 'set_common_match no-op replay does not emit a second event');
SELECT ok((SELECT passed FROM results WHERE name = 'set_common_match_not_found'), 'set_common_match rejects a match id outside the session with match_not_found');

SELECT is((SELECT count(*)::int FROM public.assignments WHERE session_id = (SELECT r1 FROM ctx)), 0, 'removing an assigned match purges its assignment row');
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id = (SELECT r1 FROM ctx) AND event_type = 'assignment_replaced'), 1, 'assignment_replaced is emitted once for set_room_assignments');
SELECT is((SELECT count(*)::int FROM public.matches WHERE session_id = (SELECT r1 FROM ctx)), 0, 'both matches are gone after remove_room_match, including the idempotent repeat');

SELECT is((SELECT payload->>'status' FROM start_result), 'started', 'start_game_session transitions a joinable room and returns status=started');
SELECT is((SELECT state::text FROM public.game_sessions WHERE id = (SELECT r2 FROM ctx)), 'in_progress', 'start_game_session persists the in_progress transition');
SELECT isnt((SELECT started_at FROM public.game_sessions WHERE id = (SELECT r2 FROM ctx)), NULL, 'start_game_session stamps started_at');
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id = (SELECT r2 FROM ctx) AND event_type = 'session_started'), 1, 'session_started is emitted exactly once');
SELECT ok((SELECT passed FROM results WHERE name = 'start_game_twice_invalid_state'), 'starting an already in_progress room raises invalid_room_state (row-lock/state-guard backstop)');
SELECT ok((SELECT passed FROM results WHERE name = 'start_game_not_host'), 'start_game_session rejects a non-owner caller with not_host');

SELECT ok((SELECT passed FROM results WHERE name = 'start_game_backstop_empty_matches'), 'start_game_session rejects a joinable room with no matches selected via its own re-validation, not just the Java-side check (FR-006-FR-009 backstop)');
SELECT is((SELECT state::text FROM public.game_sessions WHERE id = (SELECT r3 FROM ctx)), 'joinable', 'a room rejected by the start_game_session backstop is left untouched (still joinable)');

SELECT is((SELECT outcome->>'outcome' FROM idem_reserved), 'reserved', 'reserve_command_idempotency: a fresh key reserves');
SELECT is((SELECT outcome->>'outcome' FROM idem_in_flight), 'in_flight', 'reserve_command_idempotency: same command+room before completion is in_flight, not an error');
SELECT is((SELECT outcome->>'outcome' FROM idem_replay), 'replay', 'reserve_command_idempotency: same command+room after completion replays');
SELECT is((SELECT outcome->>'responseStatus' FROM idem_replay), 'ACCEPTED', 'the replayed outcome carries the original cached response status');
SELECT is((SELECT outcome->>'outcome' FROM idem_conflict), 'conflict', 'reserve_command_idempotency: same key against a different room is a conflict');
SELECT is((SELECT outcome->>'outcome' FROM idem_reserved2), 'reserved', 'a second fresh key reserves independently');
SELECT is((SELECT outcome->>'outcome' FROM idem_reserved2_again), 'reserved', 'after release_command_idempotency, the same key can be reserved again (failed attempts are retryable)');

SELECT is(private.find_active_room_for((SELECT h2 FROM ctx)), (SELECT r2 FROM ctx), 'find_active_room_for still resolves a session once state = in_progress (R9)');

SELECT * FROM finish();
ROLLBACK;
