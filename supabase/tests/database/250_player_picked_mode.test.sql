-- 250_player_picked_mode.test.sql
-- US5.6 (#185): player-picked assignment mode. Covers specs/022-player-picked-mode
-- tasks T010-T024.
--
-- Unlike 230/240, this suite's plan() count was verified before commit by
-- running it against a real PostgreSQL 17 instance through a local shim that
-- stubs pgTAP's plan/ok/is/finish (Docker was unavailable and the pgtap
-- extension is not installable here). The count below is therefore measured,
-- not hand-counted.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(36);

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL, detail text);
GRANT SELECT, INSERT ON TABLE results TO authenticated, anon;

-- =============================================================================
-- p1: the main room -- host + registered member + guest (P=3), 6 matches, a
-- Common Match, cap 2, mode player_picked. Carries the authorisation boundary
-- (T010-T014), the cap/pool/mode guards (T015-T018), and the cascade (T024).
-- An outsider account exists but never joins, for the not_a_participant guard.
-- =============================================================================
CREATE TEMP TABLE p1_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p1-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p1-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
out1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p1-out@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'PP P1 Host' FROM h
    UNION ALL SELECT id, 'PP P1 M1' FROM m1
    UNION ALL SELECT id, 'PP P1 Outsider' FROM out1
    RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'PPR0001' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM out1) AS outsider,
       (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE p1_ctx TO authenticated, anon;

CREATE TEMP TABLE p1_matches AS
WITH i AS (
    INSERT INTO public.matches (session_id, source_provider, home_team_name, away_team_name)
    SELECT room, 'espn', t.h, t.a FROM p1_ctx,
      (VALUES ('Common','Z'),('Alpha','Z'),('Bravo','Z'),('Charlie','Z'),('Delta','Z'),('Echo','Z')) AS t(h,a)
    RETURNING id, home_team_name
) SELECT id, home_team_name FROM i;
GRANT SELECT ON TABLE p1_matches TO authenticated, anon;

-- A second room, so pool confinement can be tested against a real match id that
-- simply belongs elsewhere.
CREATE TEMP TABLE p1_foreign AS
WITH h2 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p1-h2@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc2 AS (INSERT INTO public.accounts (id, preferred_display_name) SELECT id, 'PP P1 Host2' FROM h2 RETURNING id),
r2 AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'PPR0002' FROM h2 RETURNING id),
m2 AS (
    INSERT INTO public.matches (session_id, source_provider, home_team_name, away_team_name)
    SELECT id, 'espn', 'Foreign', 'Match' FROM r2 RETURNING id
)
SELECT (SELECT id FROM r2) AS room, (SELECT id FROM m2) AS match;
GRANT SELECT ON TABLE p1_foreign TO authenticated, anon;

-- =============================================================================
-- p2: settlement -- host + m1 (P=2), 5 matches, cap 2. m1 picks 1, the host
-- picks 0, so both need filling (T019).
-- =============================================================================
CREATE TEMP TABLE p2_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p2-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p2-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'PP P2 Host' FROM h UNION ALL SELECT id, 'PP P2 M1' FROM m1 RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'PPR0003' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE p2_ctx TO authenticated, anon;

CREATE TEMP TABLE p2_matches AS
WITH i AS (
    INSERT INTO public.matches (session_id, source_provider, home_team_name, away_team_name)
    SELECT room, 'espn', t.h, t.a FROM p2_ctx,
      (VALUES ('Common','Z'),('Alpha','Z'),('Bravo','Z'),('Charlie','Z'),('Delta','Z')) AS t(h,a)
    RETURNING id, home_team_name
) SELECT id, home_team_name FROM i;
GRANT SELECT ON TABLE p2_matches TO authenticated, anon;

-- =============================================================================
-- p3: nobody picks anything (T020) -- host + m1 (P=2), cap 1.
-- =============================================================================
CREATE TEMP TABLE p3_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p3-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p3-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'PP P3 Host' FROM h UNION ALL SELECT id, 'PP P3 M1' FROM m1 RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'PPR0004' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE p3_ctx TO authenticated, anon;

CREATE TEMP TABLE p3_matches AS
WITH i AS (
    INSERT INTO public.matches (session_id, source_provider, home_team_name, away_team_name)
    SELECT room, 'espn', t.h, t.a FROM p3_ctx,
      (VALUES ('Common','Z'),('Alpha','Z'),('Bravo','Z')) AS t(h,a)
    RETURNING id, home_team_name
) SELECT id, home_team_name FROM i;
GRANT SELECT ON TABLE p3_matches TO authenticated, anon;

-- =============================================================================
-- p4: a participant leaves after picking (T021) -- host + m1 (P=2), cap 1.
-- =============================================================================
CREATE TEMP TABLE p4_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p4-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p4-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'PP P4 Host' FROM h UNION ALL SELECT id, 'PP P4 M1' FROM m1 RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'PPR0005' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE p4_ctx TO authenticated, anon;

CREATE TEMP TABLE p4_matches AS
WITH i AS (
    INSERT INTO public.matches (session_id, source_provider, home_team_name, away_team_name)
    SELECT room, 'espn', t.h, t.a FROM p4_ctx,
      (VALUES ('Common','Z'),('Alpha','Z'),('Bravo','Z')) AS t(h,a)
    RETURNING id, home_team_name
) SELECT id, home_team_name FROM i;
GRANT SELECT ON TABLE p4_matches TO authenticated, anon;

-- =============================================================================
-- p5: a picked match is promoted to Common Match (T022) -- host + m1, cap 1.
-- =============================================================================
CREATE TEMP TABLE p5_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p5-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p5-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'PP P5 Host' FROM h UNION ALL SELECT id, 'PP P5 M1' FROM m1 RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'PPR0006' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE p5_ctx TO authenticated, anon;

CREATE TEMP TABLE p5_matches AS
WITH i AS (
    INSERT INTO public.matches (session_id, source_provider, home_team_name, away_team_name)
    SELECT room, 'espn', t.h, t.a FROM p5_ctx,
      (VALUES ('First','Z'),('Chosen','Z'),('Spare','Z')) AS t(h,a)
    RETURNING id, home_team_name
) SELECT id, home_team_name FROM i;
GRANT SELECT ON TABLE p5_matches TO authenticated, anon;

-- =============================================================================
-- p6: the cap is LOWERED after picking (T023) -- host + m1, cap 3 then 2.
-- The one settlement case with no analogue in #184's suite.
-- =============================================================================
CREATE TEMP TABLE p6_ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p6-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m1 AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','pp-p6-m1@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'PP P6 Host' FROM h UNION ALL SELECT id, 'PP P6 M1' FROM m1 RETURNING id
),
room AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'PPR0007' FROM h RETURNING id)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m1) AS m1, (SELECT id FROM room) AS room;
GRANT SELECT ON TABLE p6_ctx TO authenticated, anon;

CREATE TEMP TABLE p6_matches AS
WITH i AS (
    INSERT INTO public.matches (session_id, source_provider, home_team_name, away_team_name)
    SELECT room, 'espn', t.h, t.a FROM p6_ctx,
      (VALUES ('Common','Z'),('P1','Z'),('P2','Z'),('P3','Z'),('P4','Z'),('P5','Z'),('P6','Z')) AS t(h,a)
    RETURNING id, home_team_name
) SELECT id, home_team_name FROM i;
GRANT SELECT ON TABLE p6_matches TO authenticated, anon;

-- =============================================================================
-- Switch to the authenticated role. Everything below runs as a per-actor JWT
-- (request.jwt.claim.sub), matching 230/240.
-- =============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- -----------------------------------------------------------------------------
-- p1 setup: m1 joins, a guest joins by token, host configures the room.
-- -----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p1_ctx), true);
SELECT public.join_room_as_registered('PPR0001');

SET LOCAL ROLE anon;
SELECT public.join_room_as_guest('PPR0001', 'PP Guest', 'pp-guest-token-1');
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE p1_actors AS
SELECT (SELECT p.id FROM public.participants p
         WHERE p.session_id = (SELECT room FROM p1_ctx) AND p.session_role = 'owner'::public.participant_session_role
         LIMIT 1) AS host_p,
       (SELECT p.id FROM public.participants p
         WHERE p.session_id = (SELECT room FROM p1_ctx) AND p.account_id = (SELECT m1 FROM p1_ctx)
         LIMIT 1) AS m1_p,
       (SELECT p.id FROM public.participants p
         WHERE p.session_id = (SELECT room FROM p1_ctx)
           AND p.membership_type = 'guest'::public.participant_membership_type
         LIMIT 1) AS guest_p;
GRANT SELECT ON TABLE p1_actors TO authenticated, anon;

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p1_ctx), true);
SELECT public.set_common_match((SELECT room FROM p1_ctx), (SELECT id FROM p1_matches WHERE home_team_name='Common'));
SELECT public.set_room_assignment_settings((SELECT room FROM p1_ctx), 2, 0);

-- T018 (part 1): the mode guard fires while the room is still `automatic`.
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p1_ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[(SELECT id FROM p1_matches WHERE home_team_name='Alpha')]);
    INSERT INTO results VALUES ('p1_mode_guard_automatic', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_mode_guard_automatic', SQLERRM = 'room_not_player_picked', SQLERRM);
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p1_ctx), true);
SELECT public.set_room_assignment_mode((SELECT room FROM p1_ctx), 'player_picked');

-- T018 (part 2): host_assigned mode also refuses picks.
SELECT public.set_room_assignment_mode((SELECT room FROM p1_ctx), 'host_assigned');
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p1_ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[(SELECT id FROM p1_matches WHERE home_team_name='Alpha')]);
    INSERT INTO results VALUES ('p1_mode_guard_host_assigned', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_mode_guard_host_assigned', SQLERRM = 'room_not_player_picked', SQLERRM);
  END;
END $$;
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p1_ctx), true);
SELECT public.set_room_assignment_mode((SELECT room FROM p1_ctx), 'player_picked');

-- ---------------------------------------------------------------------------
-- T010: a registered non-host member writes its OWN picks.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p1_ctx), true);
SELECT public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[
  (SELECT id FROM p1_matches WHERE home_team_name='Alpha'),
  (SELECT id FROM p1_matches WHERE home_team_name='Bravo')]);

INSERT INTO results
SELECT 'p1_member_picks_stored_against_self',
       count(*) = 2 AND bool_and(participant_id = (SELECT m1_p FROM p1_actors)),
       'rows=' || count(*)
FROM public.assignment_picks WHERE session_id = (SELECT room FROM p1_ctx);

-- T014: the host is an ordinary participant and picks for itself too.
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p1_ctx), true);
SELECT public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[(SELECT id FROM p1_matches WHERE home_team_name='Charlie')]);
INSERT INTO results
SELECT 'p1_host_can_pick_for_itself',
       count(*) = 1, 'rows=' || count(*)
FROM public.assignment_picks
WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT host_p FROM p1_actors);

-- ---------------------------------------------------------------------------
-- T011: a session-scoped guest writes its own picks, by room-scoped token only.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT public.set_my_room_picks_as_guest('pp-guest-token-1', ARRAY[(SELECT id FROM p1_matches WHERE home_team_name='Delta')]);

-- T013 (part 1): anon has no grant on the table at all.
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.assignment_picks LIMIT 1;
    INSERT INTO results VALUES ('p1_anon_cannot_read_picks_table', FALSE, 'anon read succeeded');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO results VALUES ('p1_anon_cannot_read_picks_table', TRUE, 'permission denied');
  END;
END $$;

-- T012 (part 1): a stale/blank guest token is refused.
DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks_as_guest('not-a-real-token', ARRAY[]::uuid[]);
    INSERT INTO results VALUES ('p1_bad_guest_token_rejected', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_bad_guest_token_rejected', SQLERRM = 'guest_token_expired', SQLERRM);
  END;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p1_ctx), true);
INSERT INTO results
SELECT 'p1_guest_picks_stored_against_guest',
       count(*) = 1, 'rows=' || count(*)
FROM public.assignment_picks
WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT guest_p FROM p1_actors);

-- ---------------------------------------------------------------------------
-- T012 (part 2): one participant's write cannot disturb another's picks.
-- There is no participant_id parameter to abuse, so this asserts the
-- consequence: replacing m1's own set leaves the host's and guest's intact.
-- ---------------------------------------------------------------------------
SELECT public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[(SELECT id FROM p1_matches WHERE home_team_name='Alpha')]);
INSERT INTO results
SELECT 'p1_member_write_leaves_others_untouched',
       (SELECT count(*) FROM public.assignment_picks
         WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT m1_p FROM p1_actors)) = 1
   AND (SELECT count(*) FROM public.assignment_picks
         WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT host_p FROM p1_actors)) = 1
   AND (SELECT count(*) FROM public.assignment_picks
         WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT guest_p FROM p1_actors)) = 1,
       'each participant still holds exactly their own single pick';

-- T012 (part 3): a signed-in non-participant is refused.
SELECT set_config('request.jwt.claim.sub', (SELECT outsider::text FROM p1_ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[(SELECT id FROM p1_matches WHERE home_team_name='Echo')]);
    INSERT INTO results VALUES ('p1_non_participant_rejected', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_non_participant_rejected', SQLERRM = 'not_a_participant', SQLERRM);
  END;
END $$;

-- T013 (part 2): an authenticated non-member cannot read the room's picks
-- either -- the RLS policy is scoped by private.can_access_session.
INSERT INTO results
SELECT 'p1_rls_hides_picks_from_non_member',
       count(*) = 0, 'visible rows=' || count(*)
FROM public.assignment_picks WHERE session_id = (SELECT room FROM p1_ctx);

-- T013 (part 3): a room member CAN read them.
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p1_ctx), true);
INSERT INTO results
SELECT 'p1_rls_allows_member_to_read_picks',
       count(*) = 3, 'visible rows=' || count(*)
FROM public.assignment_picks WHERE session_id = (SELECT room FROM p1_ctx);

-- T013 (part 4): even a member has no direct write grant.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.assignment_picks (session_id, participant_id, match_id)
    VALUES ((SELECT room FROM p1_ctx), (SELECT m1_p FROM p1_actors), (SELECT id FROM p1_matches WHERE home_team_name='Echo'));
    INSERT INTO results VALUES ('p1_member_cannot_write_table_directly', FALSE, 'direct insert succeeded');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO results VALUES ('p1_member_cannot_write_table_directly', TRUE, 'permission denied');
  END;
END $$;

-- ---------------------------------------------------------------------------
-- T015: cap, release, and idempotency.
-- ---------------------------------------------------------------------------
SELECT public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[
  (SELECT id FROM p1_matches WHERE home_team_name='Alpha'),
  (SELECT id FROM p1_matches WHERE home_team_name='Bravo')]);
INSERT INTO results
SELECT 'p1_cap_exact_is_accepted', count(*) = 2, 'rows=' || count(*)
FROM public.assignment_picks
WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT m1_p FROM p1_actors);

DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[
      (SELECT id FROM p1_matches WHERE home_team_name='Alpha'),
      (SELECT id FROM p1_matches WHERE home_team_name='Bravo'),
      (SELECT id FROM p1_matches WHERE home_team_name='Echo')]);
    INSERT INTO results VALUES ('p1_cap_exceeded_rejected', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_cap_exceeded_rejected', SQLERRM = 'pick_limit_exceeded', SQLERRM);
  END;
END $$;

INSERT INTO results
SELECT 'p1_cap_rejection_changed_nothing', count(*) = 2, 'rows=' || count(*)
FROM public.assignment_picks
WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT m1_p FROM p1_actors);

SELECT public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[(SELECT id FROM p1_matches WHERE home_team_name='Bravo')]);
INSERT INTO results
SELECT 'p1_smaller_set_releases_the_difference', count(*) = 1, 'rows=' || count(*)
FROM public.assignment_picks
WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT m1_p FROM p1_actors);

SELECT public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[(SELECT id FROM p1_matches WHERE home_team_name='Bravo')]);
INSERT INTO results
SELECT 'p1_identical_resubmission_is_a_noop', count(*) = 1, 'rows=' || count(*)
FROM public.assignment_picks
WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT m1_p FROM p1_actors);

-- ---------------------------------------------------------------------------
-- T016: the empty-set release. array_length('{}'::uuid[], 1) is NULL, not 0,
-- so an unwrapped cap comparison would either raise here or pass by accident.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[]::uuid[]);
    INSERT INTO results
    SELECT 'p1_empty_array_releases_everything', count(*) = 0, 'rows=' || count(*)
    FROM public.assignment_picks
    WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT m1_p FROM p1_actors);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_empty_array_releases_everything', FALSE, 'raised: ' || SQLERRM);
  END;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), NULL);
    INSERT INTO results VALUES ('p1_null_releases_everything', TRUE, 'accepted');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_null_releases_everything', FALSE, 'raised: ' || SQLERRM);
  END;
END $$;

-- ---------------------------------------------------------------------------
-- T017: pool confinement, and the Common Match as a silent no-op.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[(SELECT match FROM p1_foreign)]);
    INSERT INTO results VALUES ('p1_foreign_match_rejected', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_foreign_match_rejected', SQLERRM = 'match_not_found', SQLERRM);
  END;
END $$;

-- The Common Match plus a full cap's worth of real picks must still succeed:
-- it is stripped, so it never consumes a cap slot (FR-040a).
DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[
      (SELECT id FROM p1_matches WHERE home_team_name='Alpha'),
      (SELECT id FROM p1_matches WHERE home_team_name='Bravo'),
      (SELECT id FROM p1_matches WHERE home_team_name='Common')]);
    INSERT INTO results
    SELECT 'p1_common_match_stripped_and_uncounted',
           count(*) = 2 AND NOT bool_or(match_id = (SELECT id FROM p1_matches WHERE home_team_name='Common')),
           'rows=' || count(*)
    FROM public.assignment_picks
    WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT m1_p FROM p1_actors);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_common_match_stripped_and_uncounted', FALSE, 'raised: ' || SQLERRM);
  END;
END $$;

-- Duplicates collapse rather than consuming cap slots.
DO $$ BEGIN
  BEGIN
    PERFORM public.set_my_room_picks((SELECT room FROM p1_ctx), ARRAY[
      (SELECT id FROM p1_matches WHERE home_team_name='Alpha'),
      (SELECT id FROM p1_matches WHERE home_team_name='Alpha'),
      (SELECT id FROM p1_matches WHERE home_team_name='Bravo')]);
    INSERT INTO results
    SELECT 'p1_duplicates_collapse', count(*) = 2, 'rows=' || count(*)
    FROM public.assignment_picks
    WHERE session_id = (SELECT room FROM p1_ctx) AND participant_id = (SELECT m1_p FROM p1_actors);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_duplicates_collapse', FALSE, 'raised: ' || SQLERRM);
  END;
END $$;

-- Every surface sees pick progress through the snapshot it already polls.
CREATE TEMP TABLE p1_snapshot AS SELECT public.get_room_snapshot((SELECT room FROM p1_ctx)) AS snapshot;
GRANT SELECT ON TABLE p1_snapshot TO authenticated, anon;

SET LOCAL ROLE anon;
CREATE TEMP TABLE p1_guest_snapshot AS SELECT public.get_guest_room_snapshot('pp-guest-token-1') AS snapshot;
GRANT SELECT ON TABLE p1_guest_snapshot TO authenticated, anon;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p1_ctx), true);

-- ---------------------------------------------------------------------------
-- T024: removing a picked match must not hit an FK violation (ON DELETE CASCADE).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  BEGIN
    PERFORM public.remove_room_match((SELECT room FROM p1_ctx), (SELECT id FROM p1_matches WHERE home_team_name='Bravo'));
    INSERT INTO results
    SELECT 'p1_removing_picked_match_cascades',
           NOT EXISTS (SELECT 1 FROM public.assignment_picks
                        WHERE match_id = (SELECT id FROM p1_matches WHERE home_team_name='Bravo')),
           'no FK violation, dependent picks gone';
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('p1_removing_picked_match_cascades', FALSE, 'raised: ' || SQLERRM);
  END;
END $$;

-- ---------------------------------------------------------------------------
-- T019: settlement keeps every pick and fills the remainder.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p2_ctx), true);
SELECT public.join_room_as_registered('PPR0003');
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p2_ctx), true);
SELECT public.set_common_match((SELECT room FROM p2_ctx), (SELECT id FROM p2_matches WHERE home_team_name='Common'));
SELECT public.set_room_assignment_mode((SELECT room FROM p2_ctx), 'player_picked');
SELECT public.set_room_assignment_settings((SELECT room FROM p2_ctx), 2, 0);

SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p2_ctx), true);
SELECT public.set_my_room_picks((SELECT room FROM p2_ctx), ARRAY[(SELECT id FROM p2_matches WHERE home_team_name='Alpha')]);

CREATE TEMP TABLE p2_picks_before AS
SELECT participant_id, match_id FROM public.assignment_picks WHERE session_id = (SELECT room FROM p2_ctx);
GRANT SELECT ON TABLE p2_picks_before TO authenticated, anon;

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p2_ctx), true);
CREATE TEMP TABLE p2_start AS
SELECT public.start_game_session((SELECT room FROM p2_ctx), gen_random_uuid(), false) AS r;
GRANT SELECT ON TABLE p2_start TO authenticated, anon;

INSERT INTO results
SELECT 'p2_every_pick_survives_settlement',
       NOT EXISTS (
         SELECT 1 FROM p2_picks_before pb
         WHERE NOT EXISTS (
           SELECT 1 FROM public.assignments a
           WHERE a.session_id = (SELECT room FROM p2_ctx)
             AND a.participant_id = pb.participant_id AND a.match_id = pb.match_id)),
       'ok';

INSERT INTO results
SELECT 'p2_everyone_reaches_the_effective_count',
       bool_and(n = 2), 'per-participant additional counts: ' || string_agg(n::text, ',')
FROM (
  SELECT count(*) AS n FROM public.assignments a
  WHERE a.session_id = (SELECT room FROM p2_ctx)
    AND a.match_id <> (SELECT id FROM p2_matches WHERE home_team_name='Common')
  GROUP BY a.participant_id
) q;

INSERT INTO results
SELECT 'p2_common_match_held_by_everyone',
       count(*) = 2, 'rows=' || count(*)
FROM public.assignments
WHERE session_id = (SELECT room FROM p2_ctx) AND match_id = (SELECT id FROM p2_matches WHERE home_team_name='Common');

-- ---------------------------------------------------------------------------
-- T020: nobody picks -- every set is server-filled.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p3_ctx), true);
SELECT public.join_room_as_registered('PPR0004');
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p3_ctx), true);
SELECT public.set_common_match((SELECT room FROM p3_ctx), (SELECT id FROM p3_matches WHERE home_team_name='Common'));
SELECT public.set_room_assignment_mode((SELECT room FROM p3_ctx), 'player_picked');
SELECT public.set_room_assignment_settings((SELECT room FROM p3_ctx), 1, 0);
CREATE TEMP TABLE p3_start AS
SELECT public.start_game_session((SELECT room FROM p3_ctx), gen_random_uuid(), false) AS r;
GRANT SELECT ON TABLE p3_start TO authenticated, anon;

INSERT INTO results
SELECT 'p3_no_picks_at_all_still_settles_fully',
       bool_and(n = 1), 'per-participant additional counts: ' || string_agg(n::text, ',')
FROM (
  SELECT count(*) AS n FROM public.assignments a
  WHERE a.session_id = (SELECT room FROM p3_ctx)
    AND a.match_id <> (SELECT id FROM p3_matches WHERE home_team_name='Common')
  GROUP BY a.participant_id
) q;

-- ---------------------------------------------------------------------------
-- T021: a participant who leaves after picking takes their picks with them.
-- Leaves are SOFT, so the rows persist -- the roster filter is what excludes
-- them, which is why this cannot be left to the FK cascade.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p4_ctx), true);
SELECT public.join_room_as_registered('PPR0005');
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p4_ctx), true);
SELECT public.set_common_match((SELECT room FROM p4_ctx), (SELECT id FROM p4_matches WHERE home_team_name='Common'));
SELECT public.set_room_assignment_mode((SELECT room FROM p4_ctx), 'player_picked');
SELECT public.set_room_assignment_settings((SELECT room FROM p4_ctx), 1, 0);

CREATE TEMP TABLE p4_actors AS
SELECT (SELECT p.id FROM public.participants p
         WHERE p.session_id = (SELECT room FROM p4_ctx) AND p.account_id = (SELECT m1 FROM p4_ctx) LIMIT 1) AS m1_p;
GRANT SELECT ON TABLE p4_actors TO authenticated, anon;

SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p4_ctx), true);
SELECT public.set_my_room_picks((SELECT room FROM p4_ctx), ARRAY[(SELECT id FROM p4_matches WHERE home_team_name='Alpha')]);
SELECT public.leave_room_as_member((SELECT room FROM p4_ctx));

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p4_ctx), true);
INSERT INTO results
SELECT 'p4_leave_is_soft_so_the_pick_row_persists',
       (SELECT left_at IS NOT NULL FROM public.participants WHERE id = (SELECT m1_p FROM p4_actors))
   AND EXISTS (SELECT 1 FROM public.assignment_picks
                WHERE session_id = (SELECT room FROM p4_ctx) AND participant_id = (SELECT m1_p FROM p4_actors)),
       'soft leave, pick row retained';

CREATE TEMP TABLE p4_start AS
SELECT public.start_game_session((SELECT room FROM p4_ctx), gen_random_uuid(), false) AS r;
GRANT SELECT ON TABLE p4_start TO authenticated, anon;

INSERT INTO results
SELECT 'p4_departed_participant_receives_no_assignments',
       NOT EXISTS (SELECT 1 FROM public.assignments
                    WHERE session_id = (SELECT room FROM p4_ctx)
                      AND participant_id = (SELECT m1_p FROM p4_actors)),
       'ok';

INSERT INTO results
SELECT 'p4_remaining_participant_is_unaffected',
       count(*) = 1, 'host additional matches=' || count(*)
FROM public.assignments a
WHERE a.session_id = (SELECT room FROM p4_ctx)
  AND a.match_id <> (SELECT id FROM p4_matches WHERE home_team_name='Common');

-- ---------------------------------------------------------------------------
-- T022: a picked match promoted to Common Match afterwards.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p5_ctx), true);
SELECT public.join_room_as_registered('PPR0006');
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p5_ctx), true);
SELECT public.set_common_match((SELECT room FROM p5_ctx), (SELECT id FROM p5_matches WHERE home_team_name='First'));
SELECT public.set_room_assignment_mode((SELECT room FROM p5_ctx), 'player_picked');
SELECT public.set_room_assignment_settings((SELECT room FROM p5_ctx), 1, 0);

CREATE TEMP TABLE p5_actors AS
SELECT (SELECT p.id FROM public.participants p
         WHERE p.session_id = (SELECT room FROM p5_ctx) AND p.account_id = (SELECT m1 FROM p5_ctx) LIMIT 1) AS m1_p;
GRANT SELECT ON TABLE p5_actors TO authenticated, anon;

SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p5_ctx), true);
SELECT public.set_my_room_picks((SELECT room FROM p5_ctx), ARRAY[(SELECT id FROM p5_matches WHERE home_team_name='Chosen')]);

-- The host now promotes the very match the member picked.
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p5_ctx), true);
SELECT public.set_common_match((SELECT room FROM p5_ctx), (SELECT id FROM p5_matches WHERE home_team_name='Chosen'));
CREATE TEMP TABLE p5_start AS
SELECT public.start_game_session((SELECT room FROM p5_ctx), gen_random_uuid(), false) AS r;
GRANT SELECT ON TABLE p5_start TO authenticated, anon;

INSERT INTO results
SELECT 'p5_promoted_pick_is_held_once_and_refilled',
       (SELECT count(*) FROM public.assignments a
         WHERE a.session_id = (SELECT room FROM p5_ctx)
           AND a.participant_id = (SELECT m1_p FROM p5_actors)
           AND a.match_id = (SELECT id FROM p5_matches WHERE home_team_name='Chosen')) = 1
   AND (SELECT count(*) FROM public.assignments a
         WHERE a.session_id = (SELECT room FROM p5_ctx)
           AND a.participant_id = (SELECT m1_p FROM p5_actors)
           AND a.match_id <> (SELECT id FROM p5_matches WHERE home_team_name='Chosen')) = 1,
       'holds the promoted match once, plus one filled additional match';

-- ---------------------------------------------------------------------------
-- T023: the cap LOWERED after picking. Without settlement's per-participant
-- row_number() bound this settles as 3 vs 2 -- verified by negative control
-- against a real Postgres (research.md R16).
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p6_ctx), true);
SELECT public.join_room_as_registered('PPR0007');
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p6_ctx), true);
SELECT public.set_common_match((SELECT room FROM p6_ctx), (SELECT id FROM p6_matches WHERE home_team_name='Common'));
SELECT public.set_room_assignment_mode((SELECT room FROM p6_ctx), 'player_picked');
SELECT public.set_room_assignment_settings((SELECT room FROM p6_ctx), 3, 0);

SELECT set_config('request.jwt.claim.sub', (SELECT m1::text FROM p6_ctx), true);
SELECT public.set_my_room_picks((SELECT room FROM p6_ctx), ARRAY[
  (SELECT id FROM p6_matches WHERE home_team_name='P1'),
  (SELECT id FROM p6_matches WHERE home_team_name='P2'),
  (SELECT id FROM p6_matches WHERE home_team_name='P3')]);

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM p6_ctx), true);
SELECT public.set_room_assignment_settings((SELECT room FROM p6_ctx), 2, 0);
CREATE TEMP TABLE p6_start AS
SELECT public.start_game_session((SELECT room FROM p6_ctx), gen_random_uuid(), false) AS r;
GRANT SELECT ON TABLE p6_start TO authenticated, anon;

INSERT INTO results
SELECT 'p6_lowered_cap_is_enforced_at_settlement',
       bool_and(n = 2), 'per-participant additional counts: ' || string_agg(n::text, ',')
FROM (
  SELECT count(*) AS n FROM public.assignments a
  WHERE a.session_id = (SELECT room FROM p6_ctx)
    AND a.match_id <> (SELECT id FROM p6_matches WHERE home_team_name='Common')
  GROUP BY a.participant_id
) q;

RESET ROLE;

-- =============================================================================
-- Assertions.
-- =============================================================================

-- T010, T011, T012, T013, T014: the authorisation boundary.
SELECT ok((SELECT passed FROM results WHERE name='p1_member_picks_stored_against_self'),
    'T010: a registered non-host member writes picks against its own participant row');
SELECT ok((SELECT passed FROM results WHERE name='p1_host_can_pick_for_itself'),
    'T014: the host picks for itself -- no owner_account_id gate on the pick RPC');
SELECT ok((SELECT passed FROM results WHERE name='p1_guest_picks_stored_against_guest'),
    'T011: a session-scoped guest writes picks via room-scoped token only');
SELECT ok((SELECT passed FROM results WHERE name='p1_bad_guest_token_rejected'),
    'T012: an unrecognised guest token raises guest_token_expired');
SELECT ok((SELECT passed FROM results WHERE name='p1_member_write_leaves_others_untouched'),
    'T012: replacing one participant''s picks leaves every other participant''s intact');
SELECT ok((SELECT passed FROM results WHERE name='p1_non_participant_rejected'),
    'T012: a signed-in non-participant raises not_a_participant');
SELECT ok((SELECT passed FROM results WHERE name='p1_anon_cannot_read_picks_table'),
    'T013: anon has no grant on public.assignment_picks');
SELECT ok((SELECT passed FROM results WHERE name='p1_rls_hides_picks_from_non_member'),
    'T013: RLS hides a room''s picks from an authenticated non-member');
SELECT ok((SELECT passed FROM results WHERE name='p1_rls_allows_member_to_read_picks'),
    'T013: RLS lets a room member read the room''s picks');
SELECT ok((SELECT passed FROM results WHERE name='p1_member_cannot_write_table_directly'),
    'T013: even a room member has no direct INSERT grant -- writes go through the RPCs');

-- T015, T016, T017, T018: cap, release, pool, and mode guards.
SELECT ok((SELECT passed FROM results WHERE name='p1_cap_exact_is_accepted'),
    'T015: submitting exactly matches_per_player picks is accepted');
SELECT ok((SELECT passed FROM results WHERE name='p1_cap_exceeded_rejected'),
    'T015: one pick over the cap raises pick_limit_exceeded');
SELECT ok((SELECT passed FROM results WHERE name='p1_cap_rejection_changed_nothing'),
    'T015: a rejected over-cap submission leaves the stored picks unchanged');
SELECT ok((SELECT passed FROM results WHERE name='p1_smaller_set_releases_the_difference'),
    'T015: resubmitting a smaller set releases the difference');
SELECT ok((SELECT passed FROM results WHERE name='p1_identical_resubmission_is_a_noop'),
    'T015: resubmitting an identical set is an idempotent no-op');
SELECT ok((SELECT passed FROM results WHERE name='p1_empty_array_releases_everything'),
    'T016: an empty array releases everything and does NOT raise (array_length is NULL, not 0)');
SELECT ok((SELECT passed FROM results WHERE name='p1_null_releases_everything'),
    'T016: NULL is accepted as an explicit release-everything');
SELECT ok((SELECT passed FROM results WHERE name='p1_foreign_match_rejected'),
    'T017: a match outside the room''s pool raises match_not_found');
SELECT ok((SELECT passed FROM results WHERE name='p1_common_match_stripped_and_uncounted'),
    'T017: the Common Match is silently stripped and never consumes a cap slot');
SELECT ok((SELECT passed FROM results WHERE name='p1_duplicates_collapse'),
    'T017: duplicate ids collapse rather than consuming cap slots');
SELECT ok((SELECT passed FROM results WHERE name='p1_mode_guard_automatic'),
    'T018: picking in automatic mode raises room_not_player_picked');
SELECT ok((SELECT passed FROM results WHERE name='p1_mode_guard_host_assigned'),
    'T018: picking in host_assigned mode raises room_not_player_picked');

-- FR-042: progress rides the snapshot both surfaces already poll.
-- Asserted as "how many participants are represented" rather than a raw row
-- count: FR-042's claim is that every participant's progress is visible, and a
-- row-count expectation would silently drift with the cap/release cases above.
SELECT is(
    (SELECT count(DISTINCT (p ->> 'participantId'))::int
       FROM jsonb_array_elements((SELECT snapshot -> 'picks' FROM p1_snapshot)) AS p),
    3,
    'FR-042: get_room_snapshot exposes picks for all three participants (host, member, guest)'
);
SELECT is(
    (SELECT count(DISTINCT (p ->> 'participantId'))::int
       FROM jsonb_array_elements((SELECT snapshot -> 'picks' FROM p1_guest_snapshot)) AS p),
    3,
    'FR-042: get_guest_room_snapshot exposes the same three participants to a guest'
);
SELECT is(
    (SELECT snapshot ->> 'assignmentMode' FROM p1_guest_snapshot),
    'player_picked',
    'FR-042: the guest snapshot also carries the room''s assignment mode'
);

-- T024: cascade.
SELECT ok((SELECT passed FROM results WHERE name='p1_removing_picked_match_cascades'),
    'T024: removing a picked match succeeds and cascades its pick rows away');

-- T019, T020: settlement.
SELECT ok((SELECT passed FROM results WHERE name='p2_every_pick_survives_settlement'),
    'T019: every picked match appears in that participant''s settled set');
SELECT ok((SELECT passed FROM results WHERE name='p2_everyone_reaches_the_effective_count'),
    'T019: every participant reaches the effective per-player count');
SELECT ok((SELECT passed FROM results WHERE name='p2_common_match_held_by_everyone'),
    'T019: every active participant holds the Common Match');
SELECT is(
    jsonb_array_length((SELECT r -> 'filledInParticipantIds' FROM p2_start)),
    2,
    'T019: filledInParticipantIds names exactly the participants that needed filling'
);
SELECT ok((SELECT passed FROM results WHERE name='p3_no_picks_at_all_still_settles_fully'),
    'T020: a room where nobody picked still settles every participant to the count');

-- T021: leaving after picking.
SELECT ok((SELECT passed FROM results WHERE name='p4_leave_is_soft_so_the_pick_row_persists'),
    'T021: leaving is a soft leave, so the pick row persists and must be filtered at settlement');
SELECT ok((SELECT passed FROM results WHERE name='p4_departed_participant_receives_no_assignments'),
    'T021: a departed participant receives no assignments');
SELECT ok((SELECT passed FROM results WHERE name='p4_remaining_participant_is_unaffected'),
    'T021: a departure frees nothing and leaves remaining participants unaffected');

-- T022, T023: the two ordering hazards.
SELECT ok((SELECT passed FROM results WHERE name='p5_promoted_pick_is_held_once_and_refilled'),
    'T022: a pick promoted to Common Match is held once and the shortfall refilled');
SELECT ok((SELECT passed FROM results WHERE name='p6_lowered_cap_is_enforced_at_settlement'),
    'T023: a cap lowered after picking is enforced at settlement (bounded seed, FR-003)');

SELECT *
FROM finish();
ROLLBACK;
