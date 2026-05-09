BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);
INSERT INTO auth.users (
        id,
        aud,
        role,
        email,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_sso_user,
        is_anonymous
    )
VALUES (
        '14000000-0000-0000-0000-000000000001',
        'authenticated',
        'authenticated',
        'perf-alpha@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '14000000-0000-0000-0000-000000000002',
        'authenticated',
        'authenticated',
        'perf-bravo@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    );
INSERT INTO public.accounts (id, preferred_display_name)
VALUES (
        '14000000-0000-0000-0000-000000000001',
        'Perf Alpha'
    ),
    (
        '14000000-0000-0000-0000-000000000002',
        'Perf Bravo'
    );
INSERT INTO public.game_sessions (
        id,
        host_account_id,
        join_code,
        state,
        started_at,
        completed_at,
        common_match_id
    )
VALUES (
        '24000000-0000-0000-0000-000000000001',
        '14000000-0000-0000-0000-000000000001',
        'PERF1',
        'completed',
        '2026-05-01 08:00:00+00',
        '2026-05-01 09:00:00+00',
        NULL
    ),
    (
        '24000000-0000-0000-0000-000000000002',
        '14000000-0000-0000-0000-000000000001',
        'PERF2',
        'completed',
        '2026-05-02 08:00:00+00',
        '2026-05-02 09:00:00+00',
        NULL
    );
INSERT INTO public.matches (
        id,
        session_id,
        source_provider,
        source_match_id,
        home_team_name,
        away_team_name,
        kickoff_at,
        home_score,
        away_score
    )
VALUES (
        '34000000-0000-0000-0000-000000000001',
        '24000000-0000-0000-0000-000000000001',
        'espn',
        'perf-1',
        'Perf Home 1',
        'Perf Away 1',
        '2026-05-01 08:30:00+00',
        1,
        0
    ),
    (
        '34000000-0000-0000-0000-000000000002',
        '24000000-0000-0000-0000-000000000002',
        'espn',
        'perf-2',
        'Perf Home 2',
        'Perf Away 2',
        '2026-05-02 08:30:00+00',
        0,
        1
    );
INSERT INTO public.participants (
        id,
        session_id,
        account_id,
        display_name,
        membership_type,
        current_drink_total,
        guest_rejoin_token_hash
    )
VALUES (
        '44000000-0000-0000-0000-000000000001',
        '24000000-0000-0000-0000-000000000001',
        '14000000-0000-0000-0000-000000000001',
        'Perf Alpha',
        'registered',
        5.0,
        NULL
    ),
    (
        '44000000-0000-0000-0000-000000000002',
        '24000000-0000-0000-0000-000000000001',
        '14000000-0000-0000-0000-000000000002',
        'Perf Bravo',
        'registered',
        1.0,
        NULL
    ),
    (
        '44000000-0000-0000-0000-000000000003',
        '24000000-0000-0000-0000-000000000002',
        '14000000-0000-0000-0000-000000000001',
        'Perf Alpha',
        'registered',
        3.0,
        NULL
    );
UPDATE public.game_sessions
SET common_match_id = '34000000-0000-0000-0000-000000000001'
WHERE id = '24000000-0000-0000-0000-000000000001';
UPDATE public.game_sessions
SET common_match_id = '34000000-0000-0000-0000-000000000002'
WHERE id = '24000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        '14000000-0000-0000-0000-000000000001',
        true
    );
SET LOCAL enable_seqscan = off;
CREATE TEMP TABLE performance_plans (
    label text NOT NULL,
    plan_text text NOT NULL
);
DO $do$
DECLARE plan_line text;
BEGIN FOR plan_line IN EXECUTE $sql$EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.completed_session_summaries
WHERE session_id = '24000000-0000-0000-0000-000000000001' $sql$ LOOP
INSERT INTO performance_plans (label, plan_text)
VALUES ('history', plan_line);
END LOOP;
END;
$do$;
DO $do$
DECLARE plan_line text;
BEGIN FOR plan_line IN EXECUTE $sql$EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.lifetime_player_stats
WHERE account_id = '14000000-0000-0000-0000-000000000001' $sql$ LOOP
INSERT INTO performance_plans (label, plan_text)
VALUES ('lifetime', plan_line);
END LOOP;
END;
$do$;
DO $do$
DECLARE plan_line text;
BEGIN FOR plan_line IN EXECUTE $sql$EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.leaderboard_entries
WHERE account_id = '14000000-0000-0000-0000-000000000001' $sql$ LOOP
INSERT INTO performance_plans (label, plan_text)
VALUES ('leaderboard', plan_line);
END LOOP;
END;
$do$;
CREATE TEMP TABLE performance_timings (
    label text PRIMARY KEY,
    elapsed interval NOT NULL
);
DO $do$
DECLARE started_at timestamptz;
finished_at timestamptz;
BEGIN started_at := clock_timestamp();
PERFORM 1
FROM public.compare_registered_players(
        '14000000-0000-0000-0000-000000000001',
        '14000000-0000-0000-0000-000000000002'
    );
finished_at := clock_timestamp();
INSERT INTO performance_timings (label, elapsed)
VALUES ('registered', finished_at - started_at);
END;
$do$;
DO $do$
DECLARE started_at timestamptz;
finished_at timestamptz;
BEGIN started_at := clock_timestamp();
PERFORM 1
FROM public.compare_session_participants(
        '24000000-0000-0000-0000-000000000001',
        '44000000-0000-0000-0000-000000000001',
        '44000000-0000-0000-0000-000000000002'
    );
finished_at := clock_timestamp();
INSERT INTO performance_timings (label, elapsed)
VALUES ('guest', finished_at - started_at);
END;
$do$;
SELECT ok(
        EXISTS (
            SELECT 1
            FROM performance_plans
            WHERE label = 'history'
                AND plan_text LIKE '%Index%'
        ),
        'completed-session history query uses an index-backed plan'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM performance_plans
            WHERE label = 'lifetime'
                AND plan_text LIKE '%Index%'
        ),
        'lifetime stats query uses an index-backed plan'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM performance_plans
            WHERE label = 'leaderboard'
                AND plan_text LIKE '%Index%'
        ),
        'leaderboard query uses an index-backed plan'
    );
SELECT ok(
        (
            SELECT elapsed < interval '250 milliseconds'
            FROM performance_timings
            WHERE label = 'registered'
        ),
        'registered comparison finishes within the smoke threshold'
    );
SELECT ok(
        (
            SELECT elapsed < interval '250 milliseconds'
            FROM performance_timings
            WHERE label = 'guest'
        ),
        'guest comparison finishes within the smoke threshold'
    );
SELECT *
FROM finish();
ROLLBACK;