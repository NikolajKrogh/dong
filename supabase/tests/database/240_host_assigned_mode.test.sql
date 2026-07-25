BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
-- NOTE: 33 was counted by hand (grep -c 'SELECT (ok|is|isnt)(') against the
-- assertions below and has never been verified by actually running this
-- suite (no local Docker/Supabase stack was available while writing it, same
-- caveat as 230_canonical_assignment_generation.test.sql). If `npm run
-- db:test` reports a planned/run mismatch here, trust finish()'s count and
-- correct this number rather than chasing a phantom logic bug.
SELECT plan(33);

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL);
GRANT INSERT ON TABLE results TO authenticated;

-- =============================================================================
-- r1: US3 default mode (T006) -- a freshly created room with no explicit
-- mode set reads as 'automatic'.
-- =============================================================================
CREATE TEMP TABLE r1_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r1-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (INSERT INTO public.accounts (id, preferred_display_name) SELECT id, 'HAM R1 Host' FROM h RETURNING id),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR001' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r1_ctx TO authenticated;

-- =============================================================================
-- r2: US3 set_room_assignment_mode guards + idempotency (T007, T008) --
-- host + m1, m2 (m2 stays as a non-host caller for the guard check).
-- =============================================================================
CREATE TEMP TABLE r2_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r2-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r2-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'HAM R2 Host' FROM h
    UNION ALL SELECT id, 'HAM R2 M1' FROM m1
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR002' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r2_ctx TO authenticated;

-- =============================================================================
-- r3: mode-conditional FR-009 minimum, both in set_room_assignment_settings
-- (T010) and in compute_room_assignment_plan's effectivePerPlayer (T009) --
-- host + 3 members (P=4), shared_matches_per_pair=1 so the automatic minimum
-- is 1*(4-1)=3.
-- =============================================================================
CREATE TEMP TABLE r3_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r3-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r3-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r3-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m3 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r3-m3@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'HAM R3 Host' FROM h
    UNION ALL SELECT id, 'HAM R3 M1' FROM m1
    UNION ALL SELECT id, 'HAM R3 M2' FROM m2
    UNION ALL SELECT id, 'HAM R3 M3' FROM m3
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR003' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM m3) AS m3,
       (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r3_ctx TO authenticated;

-- =============================================================================
-- r5: US5 full allocation (T018, issue acceptance scenario 1) -- host + m1 +
-- m2 (P=3), matches_per_player=2. All three fully allocated the same two
-- shared matches (allocation sharing is permitted).
-- =============================================================================
CREATE TEMP TABLE r5_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r5-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r5-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r5-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'HAM R5 Host' FROM h
    UNION ALL SELECT id, 'HAM R5 M1' FROM m1
    UNION ALL SELECT id, 'HAM R5 M2' FROM m2
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR005' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r5_ctx TO authenticated;

-- =============================================================================
-- r6: US5 shortfall + fill (T019, issue acceptance scenario 2) -- host + m1 +
-- m2 (P=3), matches_per_player=2. Host fully allocates itself, partially
-- allocates m1, leaves m2 untouched.
-- =============================================================================
CREATE TEMP TABLE r6_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r6-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r6-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r6-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'HAM R6 Host' FROM h
    UNION ALL SELECT id, 'HAM R6 M1' FROM m1
    UNION ALL SELECT id, 'HAM R6 M2' FROM m2
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR006' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r6_ctx TO authenticated;

-- =============================================================================
-- r7: US5 Common-Match no-op (T020) + set_room_assignments regression guards
-- (T023) -- host + m1 + m2 (P=3), matches_per_player=1. m2 attempts
-- allocation as a non-host before the host allocates m1 (including the
-- Common Match explicitly); host and m2 are left for the server to fill.
-- After start, the host's own attempt to call set_room_assignments again is
-- rejected as room_not_joinable.
-- =============================================================================
CREATE TEMP TABLE r7_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r7-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r7-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r7-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'HAM R7 Host' FROM h
    UNION ALL SELECT id, 'HAM R7 M1' FROM m1
    UNION ALL SELECT id, 'HAM R7 M2' FROM m2
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR007' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r7_ctx TO authenticated;

-- =============================================================================
-- r8: US5 shared allocation (T021) -- host + m1 + m2 (P=3),
-- matches_per_player=1. All three explicitly allocated the same single match.
-- =============================================================================
CREATE TEMP TABLE r8_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r8-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r8-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r8-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'HAM R8 Host' FROM h
    UNION ALL SELECT id, 'HAM R8 M1' FROM m1
    UNION ALL SELECT id, 'HAM R8 M2' FROM m2
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR008' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r8_ctx TO authenticated;

-- =============================================================================
-- r9: US5 uncapped over-allocation (T022) -- host + m1 (P=2),
-- matches_per_player=1. m1 is allocated 3 matches, far above the count.
-- =============================================================================
CREATE TEMP TABLE r9_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r9-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r9-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'HAM R9 Host' FROM h
    UNION ALL SELECT id, 'HAM R9 M1' FROM m1
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR009' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r9_ctx TO authenticated;

-- =============================================================================
-- r11: US5 left-participant roster lock (T024) -- host + m1 + m2 (P=3 at
-- allocation time, P=2 at start). m1 is allocated a match, then leaves before
-- start; their stray allocation row must not survive into the settled set.
-- =============================================================================
CREATE TEMP TABLE r11_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r11-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r11-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','ham-r11-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'HAM R11 Host' FROM h
    UNION ALL SELECT id, 'HAM R11 M1 (leaves)' FROM m1
    UNION ALL SELECT id, 'HAM R11 M2 (stays)' FROM m2
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'HAMR011' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r11_ctx TO authenticated;

-- =============================================================================
-- Switch to authenticated role. Everything below runs as per-actor JWT
-- (request.jwt.claim.sub), matching 230_canonical_assignment_generation.test.sql.
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- ---------------------------------------------------------------------------
-- r1: no explicit mode set -- read via the snapshot.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r1_ctx), true);
CREATE TEMP TABLE r1_snapshot AS SELECT public.get_room_snapshot((SELECT room FROM r1_ctx)) AS snapshot;

-- ---------------------------------------------------------------------------
-- r2: guards and idempotency.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r2_ctx), true);
SELECT public.join_room_as_registered('HAMR002');

DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignment_mode((SELECT room FROM r2_ctx), 'host_assigned');
    INSERT INTO results VALUES ('r2_not_host_rejected', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r2_not_host_rejected', SQLERRM = 'not_host');
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r2_ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignment_mode((SELECT room FROM r2_ctx), 'not_a_real_mode');
    INSERT INTO results VALUES ('r2_invalid_mode_rejected', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r2_invalid_mode_rejected', SQLERRM = 'invalid_assignment_mode');
  END;
END $$;

SELECT public.set_room_assignment_mode((SELECT room FROM r2_ctx), 'host_assigned');
CREATE TEMP TABLE r2_events_before_noop AS
  SELECT count(*)::int AS n FROM public.gameplay_events WHERE session_id = (SELECT room FROM r2_ctx);
SELECT public.set_room_assignment_mode((SELECT room FROM r2_ctx), 'host_assigned'); -- no-op replay
CREATE TEMP TABLE r2_events_after_noop AS
  SELECT count(*)::int AS n FROM public.gameplay_events WHERE session_id = (SELECT room FROM r2_ctx);
CREATE TEMP TABLE r2_mode_after_set AS
  SELECT assignment_mode::text AS mode FROM public.game_sessions WHERE id = (SELECT room FROM r2_ctx);
-- room_not_joinable is exercised on r7 below (post-start), once a room has
-- actually completed a start -- r2 is never started, so this guard can't be
-- tested here without adding matches/a common match this room doesn't need
-- for its own purpose.

-- ---------------------------------------------------------------------------
-- r3: mode-conditional minimum, in both set_room_assignment_settings and
-- compute_room_assignment_plan (T009, T010).
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r3_ctx), true);
SELECT public.join_room_as_registered('HAMR003');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r3_ctx), true);
SELECT public.join_room_as_registered('HAMR003');
SELECT set_config('request.jwt.claim.sub', (SELECT m3::text FROM r3_ctx), true);
SELECT public.join_room_as_registered('HAMR003');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r3_ctx), true);
-- Baseline valid in automatic mode: matches_per_player=3 (the K=1,P=4 minimum).
SELECT public.set_room_assignment_settings((SELECT room FROM r3_ctx), 3, 1);

DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignment_settings((SELECT room FROM r3_ctx), 1, 1);
    INSERT INTO results VALUES ('r3_automatic_below_minimum_rejected', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r3_automatic_below_minimum_rejected', SQLERRM = 'per_player_count_below_minimum');
  END;
END $$;

CREATE TEMP TABLE r3_snapshot_automatic AS SELECT public.get_room_snapshot((SELECT room FROM r3_ctx)) AS snapshot;

SELECT public.set_room_assignment_mode((SELECT room FROM r3_ctx), 'host_assigned');
-- Same 1/1 count that was rejected under automatic mode above must now succeed.
SELECT public.set_room_assignment_settings((SELECT room FROM r3_ctx), 1, 1);
CREATE TEMP TABLE r3_snapshot_host_assigned AS SELECT public.get_room_snapshot((SELECT room FROM r3_ctx)) AS snapshot;

-- ---------------------------------------------------------------------------
-- r5: full allocation -- host, m1, m2 all explicitly allocated the same two
-- shared matches.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r5_ctx), true);
SELECT public.join_room_as_registered('HAMR005');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r5_ctx), true);
SELECT public.join_room_as_registered('HAMR005');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r5_ctx), true);
SELECT public.set_room_assignment_mode((SELECT room FROM r5_ctx), 'host_assigned');
SELECT public.set_room_assignment_settings((SELECT room FROM r5_ctx), 2, 0);
CREATE TEMP TABLE r5_common AS SELECT public.add_room_match((SELECT room FROM r5_ctx), 'espn', 'r5-common', 'HC', 'AC', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r5_ctx), (SELECT id FROM r5_common));
CREATE TEMP TABLE r5_match_a AS SELECT public.add_room_match((SELECT room FROM r5_ctx), 'espn', 'r5-a', 'HA', 'AA', now()) AS id;
CREATE TEMP TABLE r5_match_b AS SELECT public.add_room_match((SELECT room FROM r5_ctx), 'espn', 'r5-b', 'HB', 'AB', now()) AS id;

CREATE TEMP TABLE r5_host_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r5_ctx) AND account_id = (SELECT host FROM r5_ctx);
CREATE TEMP TABLE r5_m1_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r5_ctx) AND account_id = (SELECT m1 FROM r5_ctx);
CREATE TEMP TABLE r5_m2_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r5_ctx) AND account_id = (SELECT m2 FROM r5_ctx);

SELECT public.set_room_assignments((SELECT room FROM r5_ctx), jsonb_build_array(
  jsonb_build_object('participantId', (SELECT id FROM r5_host_participant), 'matchId', (SELECT id FROM r5_match_a)),
  jsonb_build_object('participantId', (SELECT id FROM r5_host_participant), 'matchId', (SELECT id FROM r5_match_b)),
  jsonb_build_object('participantId', (SELECT id FROM r5_m1_participant), 'matchId', (SELECT id FROM r5_match_a)),
  jsonb_build_object('participantId', (SELECT id FROM r5_m1_participant), 'matchId', (SELECT id FROM r5_match_b)),
  jsonb_build_object('participantId', (SELECT id FROM r5_m2_participant), 'matchId', (SELECT id FROM r5_match_a)),
  jsonb_build_object('participantId', (SELECT id FROM r5_m2_participant), 'matchId', (SELECT id FROM r5_match_b))
));

CREATE TEMP TABLE r5_start_result AS SELECT public.start_game_session((SELECT room FROM r5_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- r6: shortfall + fill -- host fully allocates itself, partially allocates
-- m1, leaves m2 untouched.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r6_ctx), true);
SELECT public.join_room_as_registered('HAMR006');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r6_ctx), true);
SELECT public.join_room_as_registered('HAMR006');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r6_ctx), true);
SELECT public.set_room_assignment_mode((SELECT room FROM r6_ctx), 'host_assigned');
SELECT public.set_room_assignment_settings((SELECT room FROM r6_ctx), 2, 0);
CREATE TEMP TABLE r6_common AS SELECT public.add_room_match((SELECT room FROM r6_ctx), 'espn', 'r6-common', 'HC', 'AC', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r6_ctx), (SELECT id FROM r6_common));
CREATE TEMP TABLE r6_match_a AS SELECT public.add_room_match((SELECT room FROM r6_ctx), 'espn', 'r6-a', 'HA', 'AA', now()) AS id;
CREATE TEMP TABLE r6_match_b AS SELECT public.add_room_match((SELECT room FROM r6_ctx), 'espn', 'r6-b', 'HB', 'AB', now()) AS id;
CREATE TEMP TABLE r6_match_c AS SELECT public.add_room_match((SELECT room FROM r6_ctx), 'espn', 'r6-c', 'HC2', 'AC2', now()) AS id;
CREATE TEMP TABLE r6_match_d AS SELECT public.add_room_match((SELECT room FROM r6_ctx), 'espn', 'r6-d', 'HD', 'AD', now()) AS id;

CREATE TEMP TABLE r6_host_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r6_ctx) AND account_id = (SELECT host FROM r6_ctx);
CREATE TEMP TABLE r6_m1_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r6_ctx) AND account_id = (SELECT m1 FROM r6_ctx);
CREATE TEMP TABLE r6_m2_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r6_ctx) AND account_id = (SELECT m2 FROM r6_ctx);

-- Host: fully allocated (a, b). m1: short by one (only a). m2: untouched.
SELECT public.set_room_assignments((SELECT room FROM r6_ctx), jsonb_build_array(
  jsonb_build_object('participantId', (SELECT id FROM r6_host_participant), 'matchId', (SELECT id FROM r6_match_a)),
  jsonb_build_object('participantId', (SELECT id FROM r6_host_participant), 'matchId', (SELECT id FROM r6_match_b)),
  jsonb_build_object('participantId', (SELECT id FROM r6_m1_participant), 'matchId', (SELECT id FROM r6_match_a))
));

CREATE TEMP TABLE r6_start_result AS SELECT public.start_game_session((SELECT room FROM r6_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- r7: Common-Match no-op + set_room_assignments regression guards.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r7_ctx), true);
SELECT public.join_room_as_registered('HAMR007');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r7_ctx), true);
SELECT public.join_room_as_registered('HAMR007');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r7_ctx), true);
SELECT public.set_room_assignment_mode((SELECT room FROM r7_ctx), 'host_assigned');
SELECT public.set_room_assignment_settings((SELECT room FROM r7_ctx), 1, 0);
CREATE TEMP TABLE r7_common AS SELECT public.add_room_match((SELECT room FROM r7_ctx), 'espn', 'r7-common', 'HC', 'AC', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r7_ctx), (SELECT id FROM r7_common));
CREATE TEMP TABLE r7_match_a AS SELECT public.add_room_match((SELECT room FROM r7_ctx), 'espn', 'r7-a', 'HA', 'AA', now()) AS id;

CREATE TEMP TABLE r7_host_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r7_ctx) AND account_id = (SELECT host FROM r7_ctx);
CREATE TEMP TABLE r7_m1_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r7_ctx) AND account_id = (SELECT m1 FROM r7_ctx);
CREATE TEMP TABLE r7_m2_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r7_ctx) AND account_id = (SELECT m2 FROM r7_ctx);

-- Non-host (m2) may not allocate.
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r7_ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignments((SELECT room FROM r7_ctx), jsonb_build_array(
      jsonb_build_object('participantId', (SELECT id FROM r7_m2_participant), 'matchId', (SELECT id FROM r7_match_a))
    ));
    INSERT INTO results VALUES ('r7_set_assignments_not_host_rejected', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r7_set_assignments_not_host_rejected', SQLERRM = 'not_host');
  END;
END $$;

-- Host allocates m1 the Common Match explicitly (the no-op edge case) plus
-- the one required additional match. Host and m2 are left for the server to
-- fill.
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r7_ctx), true);
SELECT public.set_room_assignments((SELECT room FROM r7_ctx), jsonb_build_array(
  jsonb_build_object('participantId', (SELECT id FROM r7_m1_participant), 'matchId', (SELECT id FROM r7_common)),
  jsonb_build_object('participantId', (SELECT id FROM r7_m1_participant), 'matchId', (SELECT id FROM r7_match_a))
));

CREATE TEMP TABLE r7_start_result AS SELECT public.start_game_session((SELECT room FROM r7_ctx), gen_random_uuid()) AS payload;

-- Post-start: the host's own allocation call is now rejected as not-joinable.
DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignments((SELECT room FROM r7_ctx), '[]'::jsonb);
    INSERT INTO results VALUES ('r7_set_assignments_locked_after_start', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r7_set_assignments_locked_after_start', SQLERRM = 'room_not_joinable');
  END;
END $$;

-- Same guard for set_room_assignment_mode, now that a room has actually started.
DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignment_mode((SELECT room FROM r7_ctx), 'automatic');
    INSERT INTO results VALUES ('r7_mode_locked_after_start', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r7_mode_locked_after_start', SQLERRM = 'room_not_joinable');
  END;
END $$;

-- ---------------------------------------------------------------------------
-- r8: shared allocation -- all three participants explicitly allocated the
-- same single match.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r8_ctx), true);
SELECT public.join_room_as_registered('HAMR008');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r8_ctx), true);
SELECT public.join_room_as_registered('HAMR008');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r8_ctx), true);
SELECT public.set_room_assignment_mode((SELECT room FROM r8_ctx), 'host_assigned');
SELECT public.set_room_assignment_settings((SELECT room FROM r8_ctx), 1, 0);
CREATE TEMP TABLE r8_common AS SELECT public.add_room_match((SELECT room FROM r8_ctx), 'espn', 'r8-common', 'HC', 'AC', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r8_ctx), (SELECT id FROM r8_common));
CREATE TEMP TABLE r8_match_a AS SELECT public.add_room_match((SELECT room FROM r8_ctx), 'espn', 'r8-a', 'HA', 'AA', now()) AS id;

CREATE TEMP TABLE r8_host_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r8_ctx) AND account_id = (SELECT host FROM r8_ctx);
CREATE TEMP TABLE r8_m1_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r8_ctx) AND account_id = (SELECT m1 FROM r8_ctx);
CREATE TEMP TABLE r8_m2_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r8_ctx) AND account_id = (SELECT m2 FROM r8_ctx);

SELECT public.set_room_assignments((SELECT room FROM r8_ctx), jsonb_build_array(
  jsonb_build_object('participantId', (SELECT id FROM r8_host_participant), 'matchId', (SELECT id FROM r8_match_a)),
  jsonb_build_object('participantId', (SELECT id FROM r8_m1_participant), 'matchId', (SELECT id FROM r8_match_a)),
  jsonb_build_object('participantId', (SELECT id FROM r8_m2_participant), 'matchId', (SELECT id FROM r8_match_a))
));

CREATE TEMP TABLE r8_start_result AS SELECT public.start_game_session((SELECT room FROM r8_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- r9: uncapped over-allocation -- m1 allocated 3 matches against a count of 1.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r9_ctx), true);
SELECT public.join_room_as_registered('HAMR009');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r9_ctx), true);
SELECT public.set_room_assignment_mode((SELECT room FROM r9_ctx), 'host_assigned');
SELECT public.set_room_assignment_settings((SELECT room FROM r9_ctx), 1, 0);
CREATE TEMP TABLE r9_common AS SELECT public.add_room_match((SELECT room FROM r9_ctx), 'espn', 'r9-common', 'HC', 'AC', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r9_ctx), (SELECT id FROM r9_common));
CREATE TEMP TABLE r9_match_a AS SELECT public.add_room_match((SELECT room FROM r9_ctx), 'espn', 'r9-a', 'HA', 'AA', now()) AS id;
CREATE TEMP TABLE r9_match_b AS SELECT public.add_room_match((SELECT room FROM r9_ctx), 'espn', 'r9-b', 'HB', 'AB', now()) AS id;
CREATE TEMP TABLE r9_match_c AS SELECT public.add_room_match((SELECT room FROM r9_ctx), 'espn', 'r9-c', 'HC2', 'AC2', now()) AS id;

CREATE TEMP TABLE r9_host_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r9_ctx) AND account_id = (SELECT host FROM r9_ctx);
CREATE TEMP TABLE r9_m1_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r9_ctx) AND account_id = (SELECT m1 FROM r9_ctx);

SELECT public.set_room_assignments((SELECT room FROM r9_ctx), jsonb_build_array(
  jsonb_build_object('participantId', (SELECT id FROM r9_host_participant), 'matchId', (SELECT id FROM r9_match_a)),
  jsonb_build_object('participantId', (SELECT id FROM r9_m1_participant), 'matchId', (SELECT id FROM r9_match_a)),
  jsonb_build_object('participantId', (SELECT id FROM r9_m1_participant), 'matchId', (SELECT id FROM r9_match_b)),
  jsonb_build_object('participantId', (SELECT id FROM r9_m1_participant), 'matchId', (SELECT id FROM r9_match_c))
));

CREATE TEMP TABLE r9_start_result AS SELECT public.start_game_session((SELECT room FROM r9_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- r11: left-participant roster lock -- m1 is allocated a match, then leaves
-- before start.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r11_ctx), true);
SELECT public.join_room_as_registered('HAMR011');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r11_ctx), true);
SELECT public.join_room_as_registered('HAMR011');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r11_ctx), true);
SELECT public.set_room_assignment_mode((SELECT room FROM r11_ctx), 'host_assigned');
SELECT public.set_room_assignment_settings((SELECT room FROM r11_ctx), 1, 0);
CREATE TEMP TABLE r11_common AS SELECT public.add_room_match((SELECT room FROM r11_ctx), 'espn', 'r11-common', 'HC', 'AC', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r11_ctx), (SELECT id FROM r11_common));
CREATE TEMP TABLE r11_match_a AS SELECT public.add_room_match((SELECT room FROM r11_ctx), 'espn', 'r11-a', 'HA', 'AA', now()) AS id;
CREATE TEMP TABLE r11_match_b AS SELECT public.add_room_match((SELECT room FROM r11_ctx), 'espn', 'r11-b', 'HB', 'AB', now()) AS id;

CREATE TEMP TABLE r11_m1_participant AS
  SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r11_ctx) AND account_id = (SELECT m1 FROM r11_ctx);

SELECT public.set_room_assignments((SELECT room FROM r11_ctx), jsonb_build_array(
  jsonb_build_object('participantId', (SELECT id FROM r11_m1_participant), 'matchId', (SELECT id FROM r11_match_a))
));

SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r11_ctx), true);
SELECT public.leave_room_as_member((SELECT room FROM r11_ctx));

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r11_ctx), true);
CREATE TEMP TABLE r11_start_result AS SELECT public.start_game_session((SELECT room FROM r11_ctx), gen_random_uuid()) AS payload;

SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;

-- =============================================================================
-- Assertions
-- =============================================================================

-- --- r1: default mode reads automatic (T006) ---
SELECT is(
  (SELECT snapshot->>'assignmentMode' FROM r1_snapshot),
  'automatic', 'r1: a room with no explicit mode set reads assignmentMode=automatic'
);

-- --- r2: set_room_assignment_mode guards + idempotency (T007, T008) ---
SELECT ok((SELECT passed FROM results WHERE name = 'r2_not_host_rejected'), 'r2: a non-host caller is rejected with not_host');
SELECT ok((SELECT passed FROM results WHERE name = 'r2_invalid_mode_rejected'), 'r2: an unrecognized mode string is rejected with invalid_assignment_mode');
SELECT is((SELECT mode FROM r2_mode_after_set), 'host_assigned', 'r2: a successful mode change persists');
SELECT is((SELECT n FROM r2_events_after_noop), (SELECT n FROM r2_events_before_noop), 'r2: re-writing the same mode is a no-op that emits no gameplay event');

-- --- r3: mode-conditional FR-009 minimum (T009, T010) ---
SELECT ok((SELECT passed FROM results WHERE name = 'r3_automatic_below_minimum_rejected'), 'r3: automatic mode still rejects a per-player count below the K*(P-1) minimum');
SELECT is(
  (SELECT snapshot->'assignmentPlan'->>'effectivePerPlayer' FROM r3_snapshot_automatic),
  '3', 'r3: in automatic mode effectivePerPlayer is raised to the FR-009 minimum (3)'
);
SELECT is(
  (SELECT snapshot->'assignmentPlan'->>'matchesPerPlayer' FROM r3_snapshot_host_assigned),
  '1', 'r3: host-assigned mode accepts the count (1) that automatic mode rejected'
);
SELECT is(
  (SELECT snapshot->'assignmentPlan'->>'effectivePerPlayer' FROM r3_snapshot_host_assigned),
  '1', 'r3: in host-assigned mode effectivePerPlayer reads the stored count unraised (FR-011)'
);

-- --- r5: full allocation is kept exactly (T018, issue acceptance scenario 1) ---
SELECT is((SELECT payload->>'status' FROM r5_start_result), 'started', 'r5: a fully host-allocated room starts successfully');
SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE session_id = (SELECT room FROM r5_ctx)),
  9, 'r5: 3 participants x 3 assignments each (2 allocated + common) = 9 rows, nothing added or dropped'
);
SELECT is(
  (SELECT payload->'filledInParticipantIds' FROM r5_start_result),
  '[]'::jsonb, 'r5: filledInParticipantIds is empty when every participant was already fully allocated'
);

-- --- r6: shortfall kept + filled (T019, issue acceptance scenario 2) ---
SELECT is((SELECT payload->>'status' FROM r6_start_result), 'started', 'r6: a partially host-allocated room starts successfully');
SELECT is(
  (SELECT count(*)::int FROM public.assignments a WHERE a.session_id = (SELECT room FROM r6_ctx) AND a.participant_id = (SELECT id FROM r6_host_participant)),
  3, 'r6: the fully-allocated host keeps exactly their 2 allocated matches plus the common match'
);
SELECT is(
  (SELECT count(*)::int FROM public.assignments a WHERE a.session_id = (SELECT room FROM r6_ctx) AND a.participant_id = (SELECT id FROM r6_m1_participant)),
  3, 'r6: the partially-allocated m1 ends with 2 additional matches (1 kept + 1 filled) plus the common match'
);
SELECT ok(
  EXISTS(SELECT 1 FROM public.assignments a WHERE a.session_id = (SELECT room FROM r6_ctx) AND a.participant_id = (SELECT id FROM r6_m1_participant) AND a.match_id = (SELECT id FROM r6_match_a)),
  'r6: m1''s host-allocated match is kept, not replaced by the fill'
);
SELECT is(
  (SELECT count(*)::int FROM public.assignments a WHERE a.session_id = (SELECT room FROM r6_ctx) AND a.participant_id = (SELECT id FROM r6_m2_participant)),
  3, 'r6: the untouched m2 is fully filled by the server (2 additional matches plus the common match)'
);
SELECT is(
  (SELECT payload->'filledInParticipantIds' FROM r6_start_result) @> jsonb_build_array((SELECT id FROM r6_m1_participant)::text)
  AND (SELECT payload->'filledInParticipantIds' FROM r6_start_result) @> jsonb_build_array((SELECT id FROM r6_m2_participant)::text)
  AND NOT ((SELECT payload->'filledInParticipantIds' FROM r6_start_result) @> jsonb_build_array((SELECT id FROM r6_host_participant)::text)),
  true, 'r6: filledInParticipantIds names exactly m1 and m2, not the already-complete host'
);

-- --- r7: Common-Match no-op + set_room_assignments regression guards (T020, T023) ---
SELECT ok((SELECT passed FROM results WHERE name = 'r7_set_assignments_not_host_rejected'), 'r7: a non-host cannot call set_room_assignments even in host-assigned mode');
SELECT is((SELECT payload->>'status' FROM r7_start_result), 'started', 'r7: starting after an explicit Common-Match allocation does not error (ON CONFLICT DO NOTHING)');
SELECT is(
  (SELECT count(*)::int FROM public.assignments a WHERE a.session_id = (SELECT room FROM r7_ctx) AND a.participant_id = (SELECT id FROM r7_m1_participant) AND a.match_id = (SELECT id FROM r7_common)),
  1, 'r7: m1 holds the Common Match exactly once despite allocating it explicitly'
);
SELECT is(
  (SELECT count(*)::int FROM public.assignments a WHERE a.session_id = (SELECT room FROM r7_ctx) AND a.participant_id = (SELECT id FROM r7_m1_participant)),
  2, 'r7: m1''s total holdings are exactly the common match plus their one allocated additional match'
);
SELECT ok((SELECT passed FROM results WHERE name = 'r7_set_assignments_locked_after_start'), 'r7: set_room_assignments is rejected as room_not_joinable once the room has started');
SELECT ok((SELECT passed FROM results WHERE name = 'r7_mode_locked_after_start'), 'r7: set_room_assignment_mode is rejected as room_not_joinable once the room has started');

-- --- r8: shared allocation is permitted (T021) ---
SELECT is((SELECT payload->>'status' FROM r8_start_result), 'started', 'r8: starting with a match shared across all three participants does not error');
SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE session_id = (SELECT room FROM r8_ctx) AND match_id = (SELECT id FROM r8_match_a)),
  3, 'r8: the shared match is held by all 3 participants -- no exclusivity rule in host-assigned mode'
);
SELECT is(
  (SELECT payload->'filledInParticipantIds' FROM r8_start_result),
  '[]'::jsonb, 'r8: filledInParticipantIds is empty -- every participant was already at their count via the shared match'
);

-- --- r9: uncapped over-allocation (T022) ---
SELECT is((SELECT payload->>'status' FROM r9_start_result), 'started', 'r9: an over-allocated participant does not block the start');
SELECT is(
  (SELECT count(*)::int FROM public.assignments a WHERE a.session_id = (SELECT room FROM r9_ctx) AND a.participant_id = (SELECT id FROM r9_m1_participant)),
  4, 'r9: m1 keeps all 3 over-allocated matches plus the common match, uncapped by matches_per_player=1'
);
SELECT ok(
  NOT ((SELECT payload->'filledInParticipantIds' FROM r9_start_result) @> jsonb_build_array((SELECT id FROM r9_m1_participant)::text)),
  'r9: an over-allocated participant is never listed in filledInParticipantIds'
);

-- --- r11: a participant who left before start holds no assignment (T024) ---
SELECT is((SELECT payload->>'status' FROM r11_start_result), 'started', 'r11: start succeeds with the active roster (host + m2)');
SELECT is(
  (SELECT count(*)::int FROM public.assignments a
   JOIN public.participants p ON p.id = a.participant_id
   WHERE p.session_id = (SELECT room FROM r11_ctx) AND p.account_id = (SELECT m1 FROM r11_ctx)),
  0, 'r11: the participant who left before start (and whose stray allocation row was never deleted by set_room_assignments) holds zero assignments after start'
);
SELECT is(
  (SELECT count(*)::int FROM public.assignments a
   JOIN public.participants p ON p.id = a.participant_id
   WHERE p.session_id = (SELECT room FROM r11_ctx) AND p.account_id = (SELECT m2 FROM r11_ctx)),
  2, 'r11: the participant who stayed is filled with the common match plus their 1 additional match'
);

SELECT * FROM finish();
ROLLBACK;
