BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
-- NOTE: 41 was counted by hand (grep -c 'SELECT (ok|is|isnt)(') against the
-- assertions below and has never been verified by actually running this
-- suite (no local Docker/Supabase stack was available while writing it). If
-- `npm run db:test` reports a planned/run mismatch here, trust finish()'s
-- count and correct this number rather than chasing a phantom logic bug.
SELECT plan(41);

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL);
GRANT INSERT ON TABLE results TO authenticated;

-- =============================================================================
-- Helper: create a host + N registered members joined into a fresh room, all
-- as the superuser/test-runner role (must happen before SET LOCAL ROLE
-- authenticated below, since raw auth.users/accounts inserts aren't granted
-- to 'authenticated'). Rooms are created directly via INSERT (the owner
-- participant row is populated by the existing sync_session_owner_participant
-- trigger), matching the convention in 220_configure_start_game_rpcs.test.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- r1: US1 defaults (K=0, N=1) -- 4 participants, pool of exactly 5 (T006, T010)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r1_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r1-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r1-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r1-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m3 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r1-m3@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CAG R1 Host' FROM h
    UNION ALL SELECT id, 'CAG R1 M1' FROM m1
    UNION ALL SELECT id, 'CAG R1 M2' FROM m2
    UNION ALL SELECT id, 'CAG R1 M3' FROM m3
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR001' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM m3) AS m3,
       (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r1_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- r2: US1 K=1/N=3, pool of exactly 7 -- data-model.md worked P=4/K=1/N=3 row (T007, T010)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r2_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r2-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r2-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r2-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m3 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r2-m3@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CAG R2 Host' FROM h
    UNION ALL SELECT id, 'CAG R2 M1' FROM m1
    UNION ALL SELECT id, 'CAG R2 M2' FROM m2
    UNION ALL SELECT id, 'CAG R2 M3' FROM m3
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR002' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM m3) AS m3,
       (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r2_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- r3: solo room, K=1/N=2, pool of exactly 3 (T008 solo boundary)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r3_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r3-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (INSERT INTO public.accounts (id, preferred_display_name) SELECT id, 'CAG R3 Host' FROM h RETURNING id),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR003' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r3_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- r4: two participants, K=1/N=1 (the minimum for P=2/K=1), pool of exactly 2 (T008 pair boundary)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r4_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r4-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r4-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CAG R4 Host' FROM h
    UNION ALL SELECT id, 'CAG R4 M1' FROM m1
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR004' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r4_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- r5: roster-lock test (T009) -- a participant who leaves before start must
-- receive no assignment; the roster used is the one active at call time.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r5_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r5-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r5-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r5-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CAG R5 Host' FROM h
    UNION ALL SELECT id, 'CAG R5 M1 (leaves)' FROM m1
    UNION ALL SELECT id, 'CAG R5 M2 (stays)' FROM m2
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR005' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r5_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- r14: US2 shortfall + override (T019, T020) -- 5 participants, defaults
-- (K=0,N=1 -> required=6, relaxedFloor=2), pool of only 4.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r14_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r14-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r14-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r14-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m3 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r14-m3@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m4 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r14-m4@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CAG R14 Host' FROM h
    UNION ALL SELECT id, 'CAG R14 M1' FROM m1
    UNION ALL SELECT id, 'CAG R14 M2' FROM m2
    UNION ALL SELECT id, 'CAG R14 M3' FROM m3
    UNION ALL SELECT id, 'CAG R14 M4' FROM m4
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR014' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2,
       (SELECT id FROM m3) AS m3, (SELECT id FROM m4) AS m4, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r14_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- r15: US2 hard floor, unrelaxable (T021) -- 3 participants, defaults
-- (relaxedFloor=2), pool of only 1 (which becomes the Common Match).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r15_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r15-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r15-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r15-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CAG R15 Host' FROM h
    UNION ALL SELECT id, 'CAG R15 M1' FROM m1
    UNION ALL SELECT id, 'CAG R15 M2' FROM m2
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR015' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r15_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- r16: US4 settings guards + persistence + visibility (T033, T034, T035, T037)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r16_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r16-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r16-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CAG R16 Host' FROM h
    UNION ALL SELECT id, 'CAG R16 M1' FROM m1
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR016' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r16_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- r17: US4 stale-count re-floor (T036) -- set N=1 (valid minimum at P=2,K=1),
-- then grow to P=4 so the floor rises to 3; the stale stored 1 must not block
-- start, and the effective count used must be 3.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE r17_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r17-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r17-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r17-m2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m3 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-r17-m3@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'CAG R17 Host' FROM h
    UNION ALL SELECT id, 'CAG R17 M1' FROM m1
    UNION ALL SELECT id, 'CAG R17 M2' FROM m2
    UNION ALL SELECT id, 'CAG R17 M3' FROM m3
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'CAGR017' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM m2) AS m2,
       (SELECT id FROM m3) AS m3, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE r17_ctx TO authenticated;

-- ---------------------------------------------------------------------------
-- Non-determinism rooms (T011, SC-011): 8 independent identically-shaped rooms
-- (3 participants, 4 matches added in the same fixed order, defaults K=0/N=1)
-- created up front as superuser, joined/configured/started below as
-- authenticated. Each room's first-joined participant's private match ordinal
-- (position 1-3 among the non-common matches, by creation order) is compared
-- across rooms -- if generation were deterministic, every room would land on
-- the same ordinal.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE nd_rooms (iteration int, host_id uuid, m1_id uuid, m2_id uuid, room_id uuid, join_code text);

DO $$
DECLARE
  v_iter int;
  v_host uuid; v_m1 uuid; v_m2 uuid; v_room uuid; v_code text;
BEGIN
  FOR v_iter IN 1..8 LOOP
    v_code := 'ND' || lpad(v_iter::text, 5, '0');

    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-nd-h'||v_iter||'@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false)
    RETURNING id INTO v_host;
    INSERT INTO public.accounts (id, preferred_display_name) VALUES (v_host, 'CAG ND Host ' || v_iter);

    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-nd-m1-'||v_iter||'@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false)
    RETURNING id INTO v_m1;
    INSERT INTO public.accounts (id, preferred_display_name) VALUES (v_m1, 'CAG ND M1 ' || v_iter);

    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','cag-nd-m2-'||v_iter||'@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false)
    RETURNING id INTO v_m2;
    INSERT INTO public.accounts (id, preferred_display_name) VALUES (v_m2, 'CAG ND M2 ' || v_iter);

    INSERT INTO public.game_sessions (owner_account_id, join_code) VALUES (v_host, v_code) RETURNING id INTO v_room;

    INSERT INTO nd_rooms VALUES (v_iter, v_host, v_m1, v_m2, v_room, v_code);
  END LOOP;
END $$;
GRANT SELECT ON TABLE nd_rooms TO authenticated;

-- =============================================================================
-- Switch to authenticated role. Everything below runs as per-actor JWT
-- (request.jwt.claim.sub), matching 220_configure_start_game_rpcs.test.sql.
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- ---------------------------------------------------------------------------
-- r1: join members, add 5 matches, set common, start (US1 defaults).
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r1_ctx), true);
SELECT public.join_room_as_registered('CAGR001');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r1_ctx), true);
SELECT public.join_room_as_registered('CAGR001');
SELECT set_config('request.jwt.claim.sub', (SELECT m3::text FROM r1_ctx), true);
SELECT public.join_room_as_registered('CAGR001');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r1_ctx), true);
CREATE TEMP TABLE r1_match1 AS SELECT public.add_room_match((SELECT room FROM r1_ctx), 'espn', 'r1-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r1_ctx), (SELECT id FROM r1_match1));
SELECT public.add_room_match((SELECT room FROM r1_ctx), 'espn', 'r1-2', 'H2', 'A2', now());
SELECT public.add_room_match((SELECT room FROM r1_ctx), 'espn', 'r1-3', 'H3', 'A3', now());
SELECT public.add_room_match((SELECT room FROM r1_ctx), 'espn', 'r1-4', 'H4', 'A4', now());
SELECT public.add_room_match((SELECT room FROM r1_ctx), 'espn', 'r1-5', 'H5', 'A5', now());

CREATE TEMP TABLE r1_start_result AS SELECT public.start_game_session((SELECT room FROM r1_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- r2: join members, add 7 matches, set K=1/N=3, set common, start.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r2_ctx), true);
SELECT public.join_room_as_registered('CAGR002');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r2_ctx), true);
SELECT public.join_room_as_registered('CAGR002');
SELECT set_config('request.jwt.claim.sub', (SELECT m3::text FROM r2_ctx), true);
SELECT public.join_room_as_registered('CAGR002');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r2_ctx), true);
SELECT public.set_room_assignment_settings((SELECT room FROM r2_ctx), 3, 1);
CREATE TEMP TABLE r2_match1 AS SELECT public.add_room_match((SELECT room FROM r2_ctx), 'espn', 'r2-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r2_ctx), (SELECT id FROM r2_match1));
SELECT public.add_room_match((SELECT room FROM r2_ctx), 'espn', 'r2-2', 'H2', 'A2', now());
SELECT public.add_room_match((SELECT room FROM r2_ctx), 'espn', 'r2-3', 'H3', 'A3', now());
SELECT public.add_room_match((SELECT room FROM r2_ctx), 'espn', 'r2-4', 'H4', 'A4', now());
SELECT public.add_room_match((SELECT room FROM r2_ctx), 'espn', 'r2-5', 'H5', 'A5', now());
SELECT public.add_room_match((SELECT room FROM r2_ctx), 'espn', 'r2-6', 'H6', 'A6', now());
SELECT public.add_room_match((SELECT room FROM r2_ctx), 'espn', 'r2-7', 'H7', 'A7', now());

CREATE TEMP TABLE r2_start_result AS SELECT public.start_game_session((SELECT room FROM r2_ctx), gen_random_uuid()) AS payload;

-- Calling start again on the now in_progress r2 (any args) must still hit the
-- state guard, never re-enter generation (T022 pre-existing guard still
-- applies; T044/T046 -- a duplicate direct call cannot regenerate).
DO $$ BEGIN
  BEGIN
    PERFORM public.start_game_session((SELECT room FROM r2_ctx), gen_random_uuid(), true);
    INSERT INTO results VALUES ('r2_restart_relaxed_still_guarded', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r2_restart_relaxed_still_guarded', SQLERRM = 'invalid_room_state');
  END;
END $$;

CREATE TEMP TABLE r2_assignment_count_after_restart_attempt AS
  SELECT count(*)::int AS n FROM public.assignments WHERE session_id = (SELECT room FROM r2_ctx);

-- ---------------------------------------------------------------------------
-- r3: solo, K=1/N=2, pool of 3, start.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r3_ctx), true);
SELECT public.set_room_assignment_settings((SELECT room FROM r3_ctx), 2, 1);
CREATE TEMP TABLE r3_match1 AS SELECT public.add_room_match((SELECT room FROM r3_ctx), 'espn', 'r3-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r3_ctx), (SELECT id FROM r3_match1));
SELECT public.add_room_match((SELECT room FROM r3_ctx), 'espn', 'r3-2', 'H2', 'A2', now());
SELECT public.add_room_match((SELECT room FROM r3_ctx), 'espn', 'r3-3', 'H3', 'A3', now());

CREATE TEMP TABLE r3_start_result AS SELECT public.start_game_session((SELECT room FROM r3_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- r4: two participants, K=1/N=1, pool of 2, start.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r4_ctx), true);
SELECT public.join_room_as_registered('CAGR004');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r4_ctx), true);
SELECT public.set_room_assignment_settings((SELECT room FROM r4_ctx), 1, 1);
CREATE TEMP TABLE r4_match1 AS SELECT public.add_room_match((SELECT room FROM r4_ctx), 'espn', 'r4-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r4_ctx), (SELECT id FROM r4_match1));
SELECT public.add_room_match((SELECT room FROM r4_ctx), 'espn', 'r4-2', 'H2', 'A2', now());

CREATE TEMP TABLE r4_start_result AS SELECT public.start_game_session((SELECT room FROM r4_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- r5: m1 joins and then leaves before start; m2 joins and stays. Roster used
-- for generation must be the active roster (host + m2) at call time.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r5_ctx), true);
SELECT public.join_room_as_registered('CAGR005');
SELECT public.leave_room_as_member((SELECT room FROM r5_ctx));

SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r5_ctx), true);
SELECT public.join_room_as_registered('CAGR005');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r5_ctx), true);
CREATE TEMP TABLE r5_match1 AS SELECT public.add_room_match((SELECT room FROM r5_ctx), 'espn', 'r5-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r5_ctx), (SELECT id FROM r5_match1));
SELECT public.add_room_match((SELECT room FROM r5_ctx), 'espn', 'r5-2', 'H2', 'A2', now());
SELECT public.add_room_match((SELECT room FROM r5_ctx), 'espn', 'r5-3', 'H3', 'A3', now());

CREATE TEMP TABLE r5_start_result AS SELECT public.start_game_session((SELECT room FROM r5_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- r14: 5 participants, defaults, pool of only 4 -- shortfall then override.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r14_ctx), true);
SELECT public.join_room_as_registered('CAGR014');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r14_ctx), true);
SELECT public.join_room_as_registered('CAGR014');
SELECT set_config('request.jwt.claim.sub', (SELECT m3::text FROM r14_ctx), true);
SELECT public.join_room_as_registered('CAGR014');
SELECT set_config('request.jwt.claim.sub', (SELECT m4::text FROM r14_ctx), true);
SELECT public.join_room_as_registered('CAGR014');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r14_ctx), true);
CREATE TEMP TABLE r14_match1 AS SELECT public.add_room_match((SELECT room FROM r14_ctx), 'espn', 'r14-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r14_ctx), (SELECT id FROM r14_match1));
SELECT public.add_room_match((SELECT room FROM r14_ctx), 'espn', 'r14-2', 'H2', 'A2', now());
SELECT public.add_room_match((SELECT room FROM r14_ctx), 'espn', 'r14-3', 'H3', 'A3', now());
SELECT public.add_room_match((SELECT room FROM r14_ctx), 'espn', 'r14-4', 'H4', 'A4', now());

DO $$ BEGIN
  BEGIN
    PERFORM public.start_game_session((SELECT room FROM r14_ctx), gen_random_uuid());
    INSERT INTO results VALUES ('r14_shortfall_no_relax', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r14_shortfall_no_relax', SQLERRM = 'assignment_constraints_unsatisfiable');
  END;
END $$;

CREATE TEMP TABLE r14_state_after_decline AS SELECT state::text AS state FROM public.game_sessions WHERE id = (SELECT room FROM r14_ctx);
CREATE TEMP TABLE r14_assignments_after_decline AS SELECT count(*)::int AS n FROM public.assignments WHERE session_id = (SELECT room FROM r14_ctx);

CREATE TEMP TABLE r14_relaxed_result AS SELECT public.start_game_session((SELECT room FROM r14_ctx), gen_random_uuid(), true) AS payload;

-- ---------------------------------------------------------------------------
-- r15: 3 participants, defaults, pool of only 1 -- below the relaxed floor,
-- unrelaxable either way.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r15_ctx), true);
SELECT public.join_room_as_registered('CAGR015');
SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r15_ctx), true);
SELECT public.join_room_as_registered('CAGR015');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r15_ctx), true);
CREATE TEMP TABLE r15_match1 AS SELECT public.add_room_match((SELECT room FROM r15_ctx), 'espn', 'r15-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r15_ctx), (SELECT id FROM r15_match1));

DO $$ BEGIN
  BEGIN
    PERFORM public.start_game_session((SELECT room FROM r15_ctx), gen_random_uuid());
    INSERT INTO results VALUES ('r15_insufficient_no_relax', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r15_insufficient_no_relax', SQLERRM = 'insufficient_match_pool');
  END;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.start_game_session((SELECT room FROM r15_ctx), gen_random_uuid(), true);
    INSERT INTO results VALUES ('r15_insufficient_with_relax', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r15_insufficient_with_relax', SQLERRM = 'insufficient_match_pool');
  END;
END $$;

-- ---------------------------------------------------------------------------
-- r16: settings guards, persistence, visibility, idempotent no-op (T033-T035, T037).
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r16_ctx), true);
SELECT public.join_room_as_registered('CAGR016');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r16_ctx), true);
SELECT public.set_room_assignment_settings((SELECT room FROM r16_ctx), 2, 0);

CREATE TEMP TABLE r16_events_before_noop AS
  SELECT count(*)::int AS n FROM public.gameplay_events WHERE session_id = (SELECT room FROM r16_ctx);
SELECT public.set_room_assignment_settings((SELECT room FROM r16_ctx), 2, 0); -- no-op replay
CREATE TEMP TABLE r16_events_after_noop AS
  SELECT count(*)::int AS n FROM public.gameplay_events WHERE session_id = (SELECT room FROM r16_ctx);

DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignment_settings((SELECT room FROM r16_ctx), -1, 0);
    INSERT INTO results VALUES ('r16_negative_rejected', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r16_negative_rejected', SQLERRM = 'invalid_assignment_settings');
  END;
END $$;

-- 2 active participants (host+m1), K=1 -> minimum matches_per_player is 1.
-- Attempting 0 must be rejected.
DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignment_settings((SELECT room FROM r16_ctx), 0, 1);
    INSERT INTO results VALUES ('r16_below_minimum_rejected', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r16_below_minimum_rejected', SQLERRM = 'per_player_count_below_minimum');
  END;
END $$;

-- Non-host cannot change settings.
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r16_ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignment_settings((SELECT room FROM r16_ctx), 3, 0);
    INSERT INTO results VALUES ('r16_not_host_rejected', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r16_not_host_rejected', SQLERRM = 'not_host');
  END;
END $$;

-- Member can read the host's settings back via the room snapshot.
CREATE TEMP TABLE r16_member_snapshot AS SELECT public.get_room_snapshot((SELECT room FROM r16_ctx)) AS snapshot;

-- Start r16 (host+m1, N=2/K=0 -> required = 1+2*2=5), then confirm settings
-- become immutable once the room is no longer joinable.
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r16_ctx), true);
CREATE TEMP TABLE r16_match1 AS SELECT public.add_room_match((SELECT room FROM r16_ctx), 'espn', 'r16-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r16_ctx), (SELECT id FROM r16_match1));
SELECT public.add_room_match((SELECT room FROM r16_ctx), 'espn', 'r16-2', 'H2', 'A2', now());
SELECT public.add_room_match((SELECT room FROM r16_ctx), 'espn', 'r16-3', 'H3', 'A3', now());
SELECT public.add_room_match((SELECT room FROM r16_ctx), 'espn', 'r16-4', 'H4', 'A4', now());
SELECT public.add_room_match((SELECT room FROM r16_ctx), 'espn', 'r16-5', 'H5', 'A5', now());
SELECT public.start_game_session((SELECT room FROM r16_ctx), gen_random_uuid());

DO $$ BEGIN
  BEGIN
    PERFORM public.set_room_assignment_settings((SELECT room FROM r16_ctx), 4, 0);
    INSERT INTO results VALUES ('r16_settings_locked_after_start', FALSE);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('r16_settings_locked_after_start', SQLERRM = 'room_not_joinable');
  END;
END $$;

-- ---------------------------------------------------------------------------
-- r17: stale per-player count re-floored at start (T036).
-- Set N=1 while P=2 (host+m1, K=1 -> minimum 1, valid). Then m2 and m3 join,
-- raising P to 4 (minimum becomes 1*3=3). Pool sized for the re-floored
-- requirement (1 + 1*4*3/2 + 4*(3-1*3) = 1+6+0 = 7).
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM r17_ctx), true);
SELECT public.join_room_as_registered('CAGR017');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r17_ctx), true);
SELECT public.set_room_assignment_settings((SELECT room FROM r17_ctx), 1, 1);

SELECT set_config('request.jwt.claim.sub', (SELECT m2::text FROM r17_ctx), true);
SELECT public.join_room_as_registered('CAGR017');
SELECT set_config('request.jwt.claim.sub', (SELECT m3::text FROM r17_ctx), true);
SELECT public.join_room_as_registered('CAGR017');

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM r17_ctx), true);
CREATE TEMP TABLE r17_match1 AS SELECT public.add_room_match((SELECT room FROM r17_ctx), 'espn', 'r17-1', 'H1', 'A1', now()) AS id;
SELECT public.set_common_match((SELECT room FROM r17_ctx), (SELECT id FROM r17_match1));
SELECT public.add_room_match((SELECT room FROM r17_ctx), 'espn', 'r17-2', 'H2', 'A2', now());
SELECT public.add_room_match((SELECT room FROM r17_ctx), 'espn', 'r17-3', 'H3', 'A3', now());
SELECT public.add_room_match((SELECT room FROM r17_ctx), 'espn', 'r17-4', 'H4', 'A4', now());
SELECT public.add_room_match((SELECT room FROM r17_ctx), 'espn', 'r17-5', 'H5', 'A5', now());
SELECT public.add_room_match((SELECT room FROM r17_ctx), 'espn', 'r17-6', 'H6', 'A6', now());
SELECT public.add_room_match((SELECT room FROM r17_ctx), 'espn', 'r17-7', 'H7', 'A7', now());

CREATE TEMP TABLE r17_start_result AS SELECT public.start_game_session((SELECT room FROM r17_ctx), gen_random_uuid()) AS payload;

-- ---------------------------------------------------------------------------
-- Non-determinism loop (T011, SC-011): join, configure, and start each of the
-- 8 pre-created rooms.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE nd_results (iteration int, match_ordinal int);

DO $$
DECLARE
  rec record;
  v_match_id uuid;
  v_first_participant uuid;
  v_ordinal int;
BEGIN
  FOR rec IN SELECT * FROM nd_rooms ORDER BY iteration LOOP
    PERFORM set_config('request.jwt.claim.sub', rec.host_id::text, true);
    SELECT public.add_room_match(rec.room_id, 'espn', 'nd-'||rec.iteration||'-1', 'H1', 'A1', now()) INTO v_match_id;
    PERFORM public.set_common_match(rec.room_id, v_match_id);
    PERFORM public.add_room_match(rec.room_id, 'espn', 'nd-'||rec.iteration||'-2', 'H2', 'A2', now());
    PERFORM public.add_room_match(rec.room_id, 'espn', 'nd-'||rec.iteration||'-3', 'H3', 'A3', now());
    PERFORM public.add_room_match(rec.room_id, 'espn', 'nd-'||rec.iteration||'-4', 'H4', 'A4', now());

    PERFORM set_config('request.jwt.claim.sub', rec.m1_id::text, true);
    PERFORM public.join_room_as_registered(rec.join_code);

    PERFORM set_config('request.jwt.claim.sub', rec.m2_id::text, true);
    PERFORM public.join_room_as_registered(rec.join_code);

    PERFORM set_config('request.jwt.claim.sub', rec.host_id::text, true);
    PERFORM public.start_game_session(rec.room_id, gen_random_uuid());

    -- NOTE: this whole test file runs inside one transaction, so now() (and
    -- therefore every row's created_at) is frozen at transaction start --
    -- created_at cannot be used to recover insertion order here. Use the
    -- host's account_id (deterministic across rooms) and the deterministic
    -- source_match_id suffix (-2/-3/-4, assigned in a fixed literal order at
    -- insertion) as stable, time-independent position markers instead.
    SELECT id INTO v_first_participant FROM public.participants
    WHERE session_id = rec.room_id AND account_id = rec.host_id LIMIT 1;

    SELECT ranked.ordinal INTO v_ordinal
    FROM (
      SELECT id, row_number() OVER (ORDER BY source_match_id) AS ordinal
      FROM public.matches
      WHERE session_id = rec.room_id
        AND id <> (SELECT common_match_id FROM public.game_sessions WHERE id = rec.room_id)
    ) ranked
    JOIN public.assignments a ON a.match_id = ranked.id AND a.session_id = rec.room_id
    WHERE a.participant_id = v_first_participant;

    INSERT INTO nd_results VALUES (rec.iteration, v_ordinal);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- T048: join_room_as_registered locks the room row (structural check -- a
-- genuine two-connection race cannot be executed inside this single-
-- transaction pgTAP harness). Paired with a plain functional check that the
-- added lock clause didn't change join's return shape or behaviour.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE join_functiondef AS
  SELECT pg_get_functiondef('private.join_room_as_registered'::regproc) AS def;

SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;

-- =============================================================================
-- Assertions
-- =============================================================================

-- --- r1: US1 defaults (K=0, N=1) ---
SELECT is((SELECT payload->>'status' FROM r1_start_result), 'started', 'r1: start_game_session succeeds at defaults with an exactly-sized pool');
SELECT is(
  (SELECT count(*)::int FROM public.assignments a JOIN public.participants p
     ON p.id = a.participant_id AND p.session_id = (SELECT room FROM r1_ctx)
   WHERE a.session_id = (SELECT room FROM r1_ctx)),
  8, 'r1: 4 participants each hold exactly 2 assignments (common + 1 additional)'
);
SELECT is(
  (SELECT count(*)::int FROM public.matches m
   WHERE m.session_id = (SELECT room FROM r1_ctx)
     AND m.id <> (SELECT common_match_id FROM public.game_sessions WHERE id = (SELECT room FROM r1_ctx))
     AND (SELECT count(*) FROM public.assignments a WHERE a.match_id = m.id) > 1),
  0, 'r1: at K=0 no non-common match is shared by more than one participant'
);

-- --- r2: US1 K=1/N=3 pairing ---
SELECT is((SELECT payload->>'status' FROM r2_start_result), 'started', 'r2: start_game_session succeeds at K=1/N=3 with the worked-example pool of 7');
SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE session_id = (SELECT room FROM r2_ctx) AND participant_id =
    (SELECT id FROM public.participants WHERE session_id = (SELECT room FROM r2_ctx) AND account_id = (SELECT host FROM r2_ctx))),
  4, 'r2: the host holds exactly 4 assignments (common + 3 additional)'
);
SELECT is(
  (
    SELECT bool_and(shared_count = 1) FROM (
      SELECT a1.participant_id AS p1, a2.participant_id AS p2, count(*) AS shared_count
      FROM public.assignments a1
      JOIN public.assignments a2
        ON a1.session_id = a2.session_id AND a1.match_id = a2.match_id AND a1.participant_id < a2.participant_id
      WHERE a1.session_id = (SELECT room FROM r2_ctx)
        AND a1.match_id <> (SELECT common_match_id FROM public.game_sessions WHERE id = (SELECT room FROM r2_ctx))
      GROUP BY a1.participant_id, a2.participant_id
    ) pairs
  ),
  true, 'r2: every pair of participants shares exactly 1 additional match (K=1)'
);
SELECT is(
  (SELECT count(DISTINCT (p1, p2))::int FROM (
     SELECT a1.participant_id AS p1, a2.participant_id AS p2
     FROM public.assignments a1
     JOIN public.assignments a2
       ON a1.session_id = a2.session_id AND a1.match_id = a2.match_id AND a1.participant_id < a2.participant_id
     WHERE a1.session_id = (SELECT room FROM r2_ctx)
       AND a1.match_id <> (SELECT common_match_id FROM public.game_sessions WHERE id = (SELECT room FROM r2_ctx))
   ) pairs),
  6, 'r2: all 6 possible pairs among 4 participants are represented exactly once'
);
SELECT ok((SELECT passed FROM results WHERE name = 'r2_restart_relaxed_still_guarded'), 'r2: restarting an in_progress room is rejected with invalid_room_state even when relax_constraints=true');
SELECT is((SELECT n FROM r2_assignment_count_after_restart_attempt), 16, 'r2: the rejected restart attempt left the assignment set unchanged (4 participants x 4 assignments each: common + 3 additional)');

-- --- T010: gameplay events recorded for r1's successful start ---
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id = (SELECT room FROM r1_ctx) AND event_type = 'assignment_replaced'), 1, 'r1: assignment_replaced is recorded exactly once for the canonical settlement');
SELECT is((SELECT count(*)::int FROM public.gameplay_events WHERE session_id = (SELECT room FROM r1_ctx) AND event_type = 'session_started'), 1, 'r1: session_started is recorded exactly once');
SELECT is(
  (SELECT payload->>'relaxedConstraints' FROM public.gameplay_events WHERE session_id = (SELECT room FROM r1_ctx) AND event_type = 'session_started'),
  'false', 'r1: session_started payload reports relaxedConstraints=false for a non-relaxed start'
);
SELECT isnt(
  (SELECT payload->>'startedAt' FROM public.gameplay_events WHERE session_id = (SELECT room FROM r1_ctx) AND event_type = 'session_started'),
  NULL, 'r1: session_started payload carries a startedAt timestamp'
);

-- --- r3: solo boundary ---
SELECT is((SELECT payload->>'status' FROM r3_start_result), 'started', 'r3: a solo room starts successfully (the pairing rule is vacuous at P=1)');
SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE session_id = (SELECT room FROM r3_ctx)),
  3, 'r3: the solo participant holds exactly 3 assignments (common + 2 additional)'
);

-- --- r4: two-participant boundary ---
SELECT is((SELECT payload->>'status' FROM r4_start_result), 'started', 'r4: a two-participant room starts at the K=1/N=1 minimum');
SELECT is(
  (
    SELECT a1.match_id FROM public.assignments a1
    WHERE a1.session_id = (SELECT room FROM r4_ctx)
      AND a1.match_id <> (SELECT common_match_id FROM public.game_sessions WHERE id = (SELECT room FROM r4_ctx))
    LIMIT 1
  ),
  (
    SELECT a2.match_id FROM public.assignments a2
    WHERE a2.session_id = (SELECT room FROM r4_ctx)
      AND a2.match_id <> (SELECT common_match_id FROM public.game_sessions WHERE id = (SELECT room FROM r4_ctx))
    OFFSET 1 LIMIT 1
  ),
  'r4: the pair''s two additional-match rows reference the same single shared match'
);

-- --- r5: roster lock uses the active-at-call-time roster ---
SELECT is((SELECT payload->>'status' FROM r5_start_result), 'started', 'r5: start succeeds with the active roster (host + m2)');
SELECT is(
  (SELECT count(*)::int FROM public.assignments a
   JOIN public.participants p ON p.id = a.participant_id
   WHERE p.session_id = (SELECT room FROM r5_ctx) AND p.account_id = (SELECT m1 FROM r5_ctx)),
  0, 'r5: the participant who left before start holds zero assignments'
);
SELECT is(
  (SELECT count(*)::int FROM public.assignments a
   JOIN public.participants p ON p.id = a.participant_id
   WHERE p.session_id = (SELECT room FROM r5_ctx) AND p.account_id = (SELECT m2 FROM r5_ctx)),
  2, 'r5: the participant who stayed holds the common match plus 1 additional'
);

-- --- r14: shortfall pauses, then the override completes it ---
SELECT ok((SELECT passed FROM results WHERE name = 'r14_shortfall_no_relax'), 'r14: an under-filled pool is rejected with assignment_constraints_unsatisfiable, not silently started');
SELECT is((SELECT state FROM r14_state_after_decline), 'joinable', 'r14: the room remains joinable while the shortfall is unresolved');
SELECT is((SELECT n FROM r14_assignments_after_decline), 0, 'r14: no assignments are written by the rejected attempt');
SELECT is((SELECT payload->>'status' FROM r14_relaxed_result), 'started', 'r14: the host''s explicit override starts the game');
SELECT is((SELECT payload->>'relaxedConstraints' FROM r14_relaxed_result), 'true', 'r14: the start result reports relaxedConstraints=true for the override');
SELECT is(
  (SELECT count(*)::int FROM public.assignments a
   JOIN public.participants p ON p.id = a.participant_id
   WHERE p.session_id = (SELECT room FROM r14_ctx) AND p.account_id = (SELECT host FROM r14_ctx)),
  2, 'r14: even under relaxed constraints, every participant still holds the common match plus the configured per-player count'
);
SELECT is(
  (SELECT payload->>'relaxedConstraints' FROM public.gameplay_events WHERE session_id = (SELECT room FROM r14_ctx) AND event_type = 'session_started'),
  'true', 'r14: the relaxation is recorded in the room''s history'
);

-- --- r15: below the relaxed floor is unrelaxable ---
SELECT ok((SELECT passed FROM results WHERE name = 'r15_insufficient_no_relax'), 'r15: a pool below the relaxed floor is rejected outright');
SELECT ok((SELECT passed FROM results WHERE name = 'r15_insufficient_with_relax'), 'r15: relax_constraints=true does not bypass the arithmetic floor (FR-017)');

-- --- r16: settings guards, persistence, visibility ---
SELECT is(
  (SELECT jsonb_build_object('matchesPerPlayer', matches_per_player, 'sharedMatchesPerPair', shared_matches_per_pair)
   FROM public.game_sessions WHERE id = (SELECT room FROM r16_ctx)),
  jsonb_build_object('matchesPerPlayer', 2, 'sharedMatchesPerPair', 0),
  'r16: set_room_assignment_settings persists both values'
);
SELECT is((SELECT n FROM r16_events_after_noop), (SELECT n FROM r16_events_before_noop), 'r16: re-writing the same settings values is a no-op that emits no additional gameplay event');
SELECT ok((SELECT passed FROM results WHERE name = 'r16_negative_rejected'), 'r16: a negative setting is rejected with invalid_assignment_settings');
SELECT ok((SELECT passed FROM results WHERE name = 'r16_below_minimum_rejected'), 'r16: a per-player count below the K*(P-1) minimum is rejected with per_player_count_below_minimum');
SELECT ok((SELECT passed FROM results WHERE name = 'r16_not_host_rejected'), 'r16: a non-host caller is rejected with not_host');
SELECT is(
  ((SELECT snapshot FROM r16_member_snapshot)->'assignmentPlan'->>'matchesPerPlayer'),
  '2', 'r16: a non-host member reads the host''s settings back via the room snapshot'
);
SELECT ok((SELECT passed FROM results WHERE name = 'r16_settings_locked_after_start'), 'r16: settings become immutable once the room is no longer joinable');

-- --- r17: stale per-player count is re-floored at start, not rejected ---
SELECT is((SELECT payload->>'status' FROM r17_start_result), 'started', 'r17: a stale per-player count (valid when set, stale after growth) does not block start');
SELECT is(
  (SELECT count(*)::int FROM public.assignments a
   JOIN public.participants p ON p.id = a.participant_id
   WHERE p.session_id = (SELECT room FROM r17_ctx) AND p.account_id = (SELECT host FROM r17_ctx)),
  4, 'r17: the host holds the common match plus the re-floored 3 additional matches, not the stale stored value of 1'
);

-- --- T011 / SC-011: generation produces varied arrangements ---
SELECT ok((SELECT count(DISTINCT match_ordinal) FROM nd_results) > 1, 'generation is non-deterministic: the first-joined participant''s private-match ordinal varies across 8 identically-shaped repeated rooms (SC-011)');

-- --- T048: join_room_as_registered locks the room row ---
SELECT ok((SELECT def FROM join_functiondef) LIKE '%FOR UPDATE%', 'join_room_as_registered locks the room row before reading it (closes the race with a concurrent start_game_session)');
SELECT is(
  (SELECT count(*)::int FROM public.participants WHERE session_id = (SELECT room FROM r1_ctx) AND account_id = (SELECT m1 FROM r1_ctx)),
  1, 'join_room_as_registered still creates exactly one participant row per member after the lock clause was added'
);

SELECT * FROM finish();
ROLLBACK;
