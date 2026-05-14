BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(21);
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
        '13000000-0000-0000-0000-000000000001',
        'authenticated',
        'authenticated',
        'compare-alpha@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '13000000-0000-0000-0000-000000000002',
        'authenticated',
        'authenticated',
        'compare-bravo@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '13000000-0000-0000-0000-000000000003',
        'authenticated',
        'authenticated',
        'compare-charlie@test.local',
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
        '13000000-0000-0000-0000-000000000001',
        'Compare Alpha'
    ),
    (
        '13000000-0000-0000-0000-000000000002',
        'Compare Bravo'
    ),
    (
        '13000000-0000-0000-0000-000000000003',
        'Compare Charlie'
    );
INSERT INTO public.game_sessions (
        id,
    owner_account_id,
        join_code,
        state,
        started_at,
        completed_at,
        common_match_id
    )
VALUES (
        '23000000-0000-0000-0000-000000000001',
        '13000000-0000-0000-0000-000000000001',
        'CMP01',
        'completed',
        '2026-05-01 08:00:00+00',
        '2026-05-01 09:00:00+00',
        NULL
    ),
    (
        '23000000-0000-0000-0000-000000000002',
        '13000000-0000-0000-0000-000000000001',
        'CMP02',
        'completed',
        '2026-05-02 08:00:00+00',
        '2026-05-02 09:00:00+00',
        NULL
    ),
    (
        '23000000-0000-0000-0000-000000000003',
        '13000000-0000-0000-0000-000000000001',
        'CMP03',
        'completed',
        '2026-05-03 08:00:00+00',
        '2026-05-03 09:00:00+00',
        NULL
    ),
    (
        '23000000-0000-0000-0000-000000000004',
        '13000000-0000-0000-0000-000000000003',
        'CMP04',
        'completed',
        '2026-05-04 08:00:00+00',
        '2026-05-04 09:00:00+00',
        NULL
    );
UPDATE public.participants
SET id = '43000000-0000-0000-0000-000000000001',
    display_name = 'Compare Alpha',
    membership_type = 'registered',
    session_role = 'owner',
    current_drink_total = 4.0
WHERE session_id = '23000000-0000-0000-0000-000000000001'
    AND account_id = '13000000-0000-0000-0000-000000000001';
UPDATE public.participants
SET id = '43000000-0000-0000-0000-000000000004',
    display_name = 'Compare Alpha',
    membership_type = 'registered',
    session_role = 'owner',
    current_drink_total = 1.0
WHERE session_id = '23000000-0000-0000-0000-000000000002'
    AND account_id = '13000000-0000-0000-0000-000000000001';
UPDATE public.participants
SET id = '43000000-0000-0000-0000-000000000006',
    display_name = 'Compare Alpha',
    membership_type = 'registered',
    session_role = 'owner',
    current_drink_total = 7.0
WHERE session_id = '23000000-0000-0000-0000-000000000003'
    AND account_id = '13000000-0000-0000-0000-000000000001';
UPDATE public.participants
SET id = '43000000-0000-0000-0000-000000000007',
    display_name = 'Compare Charlie',
    membership_type = 'registered',
    session_role = 'owner',
    current_drink_total = 2.0
WHERE session_id = '23000000-0000-0000-0000-000000000004'
    AND account_id = '13000000-0000-0000-0000-000000000003';
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
        '33000000-0000-0000-0000-000000000001',
        '23000000-0000-0000-0000-000000000001',
        'espn',
        'cmp-1',
        'Home 1',
        'Away 1',
        '2026-05-01 08:30:00+00',
        1,
        0
    ),
    (
        '33000000-0000-0000-0000-000000000002',
        '23000000-0000-0000-0000-000000000002',
        'espn',
        'cmp-2',
        'Home 2',
        'Away 2',
        '2026-05-02 08:30:00+00',
        0,
        1
    ),
    (
        '33000000-0000-0000-0000-000000000003',
        '23000000-0000-0000-0000-000000000003',
        'espn',
        'cmp-3',
        'Home 3',
        'Away 3',
        '2026-05-03 08:30:00+00',
        2,
        1
    ),
    (
        '33000000-0000-0000-0000-000000000004',
        '23000000-0000-0000-0000-000000000004',
        'espn',
        'cmp-4',
        'Home 4',
        'Away 4',
        '2026-05-04 08:30:00+00',
        1,
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
        '43000000-0000-0000-0000-000000000002',
        '23000000-0000-0000-0000-000000000001',
        '13000000-0000-0000-0000-000000000002',
        'Compare Bravo',
        'registered',
        2.0,
        NULL
    ),
    (
        '43000000-0000-0000-0000-000000000003',
        '23000000-0000-0000-0000-000000000001',
        NULL,
        'Compare Guest',
        'guest',
        1.0,
        'compare-guest-token'
    ),
    (
        '43000000-0000-0000-0000-000000000005',
        '23000000-0000-0000-0000-000000000002',
        '13000000-0000-0000-0000-000000000002',
        'Compare Bravo',
        'registered',
        5.0,
        NULL
    );
UPDATE public.game_sessions
SET common_match_id = '33000000-0000-0000-0000-000000000001'
WHERE id = '23000000-0000-0000-0000-000000000001';
UPDATE public.game_sessions
SET common_match_id = '33000000-0000-0000-0000-000000000002'
WHERE id = '23000000-0000-0000-0000-000000000002';
UPDATE public.game_sessions
SET common_match_id = '33000000-0000-0000-0000-000000000003'
WHERE id = '23000000-0000-0000-0000-000000000003';
UPDATE public.game_sessions
SET common_match_id = '33000000-0000-0000-0000-000000000004'
WHERE id = '23000000-0000-0000-0000-000000000004';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        '13000000-0000-0000-0000-000000000001',
        true
    );
SELECT is(
        (
            SELECT (
                    player1_name = 'Compare Alpha'
                    AND player2_name = 'Compare Bravo'
                )::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        'true',
        'registered comparison returns the selected player names'
    );
SELECT is(
        (
            SELECT games_played_together::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '2',
        'registered comparison counts shared sessions'
    );
SELECT is(
        (
            SELECT player1_games_played::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '3',
        'registered comparison counts player 1 sessions'
    );
SELECT is(
        (
            SELECT player2_games_played::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '2',
        'registered comparison counts player 2 sessions'
    );
SELECT is(
        (
            SELECT player1_total_drinks::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '12.0',
        'registered comparison aggregates player 1 drinks'
    );
SELECT is(
        (
            SELECT player2_total_drinks::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '7.0',
        'registered comparison aggregates player 2 drinks'
    );
SELECT is(
        (
            SELECT player1_wins_count::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '1',
        'registered comparison counts player 1 wins'
    );
SELECT is(
        (
            SELECT player2_wins_count::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '1',
        'registered comparison counts player 2 wins'
    );
SELECT is(
        (
            SELECT jsonb_array_length(timeline_data)::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '2',
        'registered comparison returns a two-point timeline'
    );
SELECT is(
        (
            SELECT round(player1_avg_with_player2::numeric, 1)::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '2.5',
        'registered comparison averages player 1 drinks with player 2'
    );
SELECT is(
        (
            SELECT round(player1_avg_without_player2::numeric, 1)::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '7.0',
        'registered comparison averages player 1 drinks without player 2'
    );
SELECT is(
        (
            SELECT round(player2_avg_without_player1::numeric, 1)::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000002'
                )
        ),
        '0.0',
        'registered comparison zeroes player 2 without-player-1 average when no sessions remain'
    );
SELECT is(
        (
            SELECT games_played_together::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000003'
                )
        ),
        '0',
        'no-overlap registered comparison reports zero shared sessions'
    );
SELECT is(
        (
            SELECT jsonb_array_length(timeline_data)::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000003'
                )
        ),
        '0',
        'no-overlap registered comparison returns an empty timeline'
    );
SELECT is(
        (
            SELECT round(player1_avg_with_player2::numeric, 1)::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000003'
                )
        ),
        '0.0',
        'no-overlap registered comparison zeroes player 1 with-player-2 average'
    );
SELECT is(
        (
            SELECT round(player1_avg_without_player2::numeric, 1)::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000003'
                )
        ),
        '4.0',
        'no-overlap registered comparison keeps player 1 without-player-2 average'
    );
SELECT is(
        (
            SELECT round(player2_avg_without_player1::numeric, 1)::text
            FROM public.compare_registered_players(
                    '13000000-0000-0000-0000-000000000001',
                    '13000000-0000-0000-0000-000000000003'
                )
        ),
        '2.0',
        'no-overlap registered comparison keeps player 2 without-player-1 average'
    );
SELECT is(
        (
            SELECT player1_name
            FROM public.compare_session_participants(
                    '23000000-0000-0000-0000-000000000001',
                    '43000000-0000-0000-0000-000000000003',
                    '43000000-0000-0000-0000-000000000001'
                )
        ),
        'Compare Guest',
        'guest comparison uses the guest participant name'
    );
SELECT is(
        (
            SELECT player2_name
            FROM public.compare_session_participants(
                    '23000000-0000-0000-0000-000000000001',
                    '43000000-0000-0000-0000-000000000003',
                    '43000000-0000-0000-0000-000000000001'
                )
        ),
        'Compare Alpha',
        'guest comparison uses the registered participant name'
    );
SELECT is(
        (
            SELECT games_played_together::text
            FROM public.compare_session_participants(
                    '23000000-0000-0000-0000-000000000001',
                    '43000000-0000-0000-0000-000000000003',
                    '43000000-0000-0000-0000-000000000001'
                )
        ),
        '1',
        'guest comparison is scoped to the shared completed session'
    );
SELECT is(
        (
            SELECT jsonb_array_length(timeline_data)::text
            FROM public.compare_session_participants(
                    '23000000-0000-0000-0000-000000000001',
                    '43000000-0000-0000-0000-000000000003',
                    '43000000-0000-0000-0000-000000000001'
                )
        ),
        '1',
        'guest comparison returns a single timeline point'
    );
SELECT *
FROM finish();
ROLLBACK;