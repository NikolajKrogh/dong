BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);
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
        '10000000-0000-0000-0000-000000000001',
        'authenticated',
        'authenticated',
        'history-host@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'authenticated',
        'authenticated',
        'history-friend@test.local',
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
        '10000000-0000-0000-0000-000000000001',
        'History Host'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'History Friend'
    );
INSERT INTO public.game_sessions (
        id,
        host_account_id,
        join_code,
        state,
        started_at,
        completed_at
    )
VALUES (
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'HIST01',
        'completed',
        '2026-05-01 10:00:00+00',
        '2026-05-01 12:00:00+00'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        'HIST02',
        'completed',
        '2026-05-02 10:00:00+00',
        '2026-05-02 12:00:00+00'
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
        '40000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'History Host',
        'registered',
        4.0,
        NULL
    ),
    (
        '40000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
        'History Friend',
        'registered',
        2.0,
        NULL
    ),
    (
        '40000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        'History Host',
        'registered',
        5.0,
        NULL
    ),
    (
        '40000000-0000-0000-0000-000000000004',
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002',
        'History Friend',
        'registered',
        1.0,
        NULL
    ),
    (
        '40000000-0000-0000-0000-000000000005',
        '20000000-0000-0000-0000-000000000002',
        NULL,
        'History Guest',
        'guest',
        2.0,
        'guest-history-token'
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
        '30000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        'espn',
        'hist-old-1',
        'Old Home',
        'Old Away',
        '2026-05-01 10:15:00+00',
        2,
        1
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',
        'espn',
        'hist-new-1',
        'New Home',
        'New Away',
        '2026-05-02 10:15:00+00',
        1,
        1
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000002',
        'espn',
        'hist-new-2',
        'New Home 2',
        'New Away 2',
        '2026-05-02 11:15:00+00',
        0,
        2
    );
INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES (
        '20000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001'
    ),
    (
        '20000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000002',
        '30000000-0000-0000-0000-000000000001'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000003',
        '30000000-0000-0000-0000-000000000002'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000003',
        '30000000-0000-0000-0000-000000000003'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000004',
        '30000000-0000-0000-0000-000000000002'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000005',
        '30000000-0000-0000-0000-000000000003'
    );
UPDATE public.game_sessions
SET common_match_id = '30000000-0000-0000-0000-000000000001'
WHERE id = '20000000-0000-0000-0000-000000000001';
UPDATE public.game_sessions
SET common_match_id = '30000000-0000-0000-0000-000000000002'
WHERE id = '20000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        '10000000-0000-0000-0000-000000000001',
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.completed_session_summaries
        ),
        '2',
        'two completed sessions are exposed'
    );
SELECT is(
        (
            SELECT string_agg(
                    session_id::text,
                    ','
                    ORDER BY completed_at DESC,
                        session_id DESC
                )
            FROM public.completed_session_summaries
        ),
        '20000000-0000-0000-0000-000000000002,20000000-0000-0000-0000-000000000001',
        'completed sessions are ordered newest first'
    );
SELECT is(
        (
            SELECT session_total_players::text
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        '3',
        'new session counts three players'
    );
SELECT is(
        (
            SELECT session_total_matches::text
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        '2',
        'new session counts two matches'
    );
SELECT is(
        (
            SELECT session_total_goals::text
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        '4',
        'new session totals the match goals'
    );
SELECT is(
        (
            SELECT session_total_drinks::text
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        '8.0',
        'new session totals the participant drinks'
    );
SELECT is(
        (
            SELECT jsonb_array_length(players)::text
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        '3',
        'new session exposes three players'
    );
SELECT is(
        (
            SELECT players->0->>'name'
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        'History Host',
        'player payload includes the host name'
    );
SELECT is(
        (
            SELECT jsonb_array_length(matches)::text
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        '2',
        'new session exposes two matches'
    );
SELECT ok(
        (
            SELECT player_assignments ? '40000000-0000-0000-0000-000000000003'
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        'assignment payload includes the host participant'
    );
SELECT ok(
        (
            SELECT matches_per_player > 0
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000002'
        ),
        'matches-per-player is computed'
    );
SELECT is(
        (
            SELECT session_total_players::text
            FROM public.completed_session_summaries
            WHERE session_id = '20000000-0000-0000-0000-000000000001'
        ),
        '2',
        'old session counts two players'
    );
SELECT is(
        (
            SELECT total_sessions::text
            FROM public.history_overview_totals
        ),
        '2',
        'overview counts both completed sessions'
    );
SELECT is(
        (
            SELECT total_participations::text
            FROM public.history_overview_totals
        ),
        '5',
        'overview counts all participant rows'
    );
SELECT is(
        (
            SELECT total_matches::text
            FROM public.history_overview_totals
        ),
        '3',
        'overview counts all matches'
    );
SELECT is(
        (
            SELECT total_goals::text
            FROM public.history_overview_totals
        ),
        '7',
        'overview totals all goals'
    );
SELECT is(
        (
            SELECT total_drinks::text
            FROM public.history_overview_totals
        ),
        '14.0',
        'overview totals all drinks'
    );
SELECT is(
        (
            SELECT round(average_drinks_per_participation::numeric, 1)::text
            FROM public.history_overview_totals
        ),
        '2.8',
        'overview averages drinks per participation'
    );
SELECT *
FROM finish();
ROLLBACK;