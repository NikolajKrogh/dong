BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);
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
        '11000000-0000-0000-0000-000000000001',
        'authenticated',
        'authenticated',
        'lifetime-host@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '11000000-0000-0000-0000-000000000002',
        'authenticated',
        'authenticated',
        'lifetime-friend@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '11000000-0000-0000-0000-000000000003',
        'authenticated',
        'authenticated',
        'lifetime-unused@test.local',
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
        '11000000-0000-0000-0000-000000000001',
        'Lifetime Host'
    ),
    (
        '11000000-0000-0000-0000-000000000002',
        'Lifetime Friend'
    ),
    (
        '11000000-0000-0000-0000-000000000003',
        'Unused Player'
    );
INSERT INTO public.game_sessions (
        id,
    owner_account_id,
        join_code,
        state,
        started_at,
        completed_at
    )
VALUES (
        '21000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001',
        'LIFE01',
        'completed',
        '2026-05-01 08:00:00+00',
        '2026-05-01 09:00:00+00'
    ),
    (
        '21000000-0000-0000-0000-000000000002',
        '11000000-0000-0000-0000-000000000001',
        'LIFE02',
        'completed',
        '2026-05-02 08:00:00+00',
        '2026-05-02 09:00:00+00'
    );
UPDATE public.participants
SET id = '41000000-0000-0000-0000-000000000001',
    display_name = 'Lifetime Host',
    membership_type = 'registered',
    session_role = 'owner',
    current_drink_total = 4.0
WHERE session_id = '21000000-0000-0000-0000-000000000001'
    AND account_id = '11000000-0000-0000-0000-000000000001';
UPDATE public.participants
SET id = '41000000-0000-0000-0000-000000000003',
    display_name = 'Lifetime Host',
    membership_type = 'registered',
    session_role = 'owner',
    current_drink_total = 5.0
WHERE session_id = '21000000-0000-0000-0000-000000000002'
    AND account_id = '11000000-0000-0000-0000-000000000001';
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
        '41000000-0000-0000-0000-000000000002',
        '21000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000002',
        'Lifetime Friend',
        'registered',
        2.0,
        NULL
    ),
    (
        '41000000-0000-0000-0000-000000000004',
        '21000000-0000-0000-0000-000000000002',
        NULL,
        'Lifetime Guest',
        'guest',
        3.0,
        'lifetime-guest-token'
    );
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        '11000000-0000-0000-0000-000000000001',
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.lifetime_player_stats
        ),
        '2',
        'only registered accounts with completed sessions are returned'
    );
SELECT is(
        (
            SELECT string_agg(
                    account_id::text,
                    ','
                    ORDER BY total_drinks DESC,
                        average_per_game DESC,
                        account_id ASC
                )
            FROM public.lifetime_player_stats
        ),
        '11000000-0000-0000-0000-000000000001,11000000-0000-0000-0000-000000000002',
        'lifetime stats are ordered by total drinks, average per game, then account id'
    );
SELECT is(
        (
            SELECT games_played::text
            FROM public.lifetime_player_stats
            WHERE account_id = '11000000-0000-0000-0000-000000000001'
        ),
        '2',
        'host appears in two completed sessions'
    );
SELECT is(
        (
            SELECT total_drinks::text
            FROM public.lifetime_player_stats
            WHERE account_id = '11000000-0000-0000-0000-000000000001'
        ),
        '9.0',
        'host lifetime total drinks are aggregated'
    );
SELECT is(
        (
            SELECT round(average_per_game::numeric, 1)::text
            FROM public.lifetime_player_stats
            WHERE account_id = '11000000-0000-0000-0000-000000000001'
        ),
        '4.5',
        'host lifetime average per game is calculated'
    );
SELECT ok(
        NOT EXISTS (
            SELECT 1
            FROM public.lifetime_player_stats
            WHERE account_id = '11000000-0000-0000-0000-000000000003'
        ),
        'players with no completed sessions are excluded'
    );
SELECT ok(
        NOT EXISTS (
            SELECT 1
            FROM public.lifetime_player_stats
            WHERE display_name = 'Lifetime Guest'
        ),
        'guest participants are excluded from lifetime stats'
    );
SELECT *
FROM finish();
ROLLBACK;