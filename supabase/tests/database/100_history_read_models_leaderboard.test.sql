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
        '12000000-0000-0000-0000-000000000001',
        'authenticated',
        'authenticated',
        'leaderboard-a@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '12000000-0000-0000-0000-000000000002',
        'authenticated',
        'authenticated',
        'leaderboard-b@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '12000000-0000-0000-0000-000000000003',
        'authenticated',
        'authenticated',
        'leaderboard-c@test.local',
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE,
        FALSE
    ),
    (
        '12000000-0000-0000-0000-000000000004',
        'authenticated',
        'authenticated',
        'leaderboard-unused@test.local',
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
        '12000000-0000-0000-0000-000000000001',
        'Alpha'
    ),
    (
        '12000000-0000-0000-0000-000000000002',
        'Bravo'
    ),
    (
        '12000000-0000-0000-0000-000000000003',
        'Charlie'
    ),
    (
        '12000000-0000-0000-0000-000000000004',
        'Unused'
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
        '22000000-0000-0000-0000-000000000001',
        '12000000-0000-0000-0000-000000000001',
        'LB01',
        'completed',
        '2026-05-01 08:00:00+00',
        '2026-05-01 09:00:00+00'
    ),
    (
        '22000000-0000-0000-0000-000000000002',
        '12000000-0000-0000-0000-000000000001',
        'LB02',
        'completed',
        '2026-05-02 08:00:00+00',
        '2026-05-02 09:00:00+00'
    ),
    (
        '22000000-0000-0000-0000-000000000003',
        '12000000-0000-0000-0000-000000000001',
        'LB03',
        'completed',
        '2026-05-03 08:00:00+00',
        '2026-05-03 09:00:00+00'
    );
UPDATE public.participants
SET id = '42000000-0000-0000-0000-000000000001',
    display_name = 'Alpha',
    membership_type = 'registered',
    session_role = 'owner',
    current_drink_total = 4.0
WHERE session_id = '22000000-0000-0000-0000-000000000001'
    AND account_id = '12000000-0000-0000-0000-000000000001';
UPDATE public.participants
SET id = '42000000-0000-0000-0000-000000000004',
    display_name = 'Alpha',
    membership_type = 'registered',
    session_role = 'owner',
    current_drink_total = 2.0
WHERE session_id = '22000000-0000-0000-0000-000000000002'
    AND account_id = '12000000-0000-0000-0000-000000000001';
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
        '42000000-0000-0000-0000-000000000002',
        '22000000-0000-0000-0000-000000000001',
        '12000000-0000-0000-0000-000000000002',
        'Bravo',
        'registered',
        6.0,
        NULL
    ),
    (
        '42000000-0000-0000-0000-000000000003',
        '22000000-0000-0000-0000-000000000001',
        NULL,
        'Guest Alpha',
        'guest',
        1.0,
        'leaderboard-guest-1'
    ),
    (
        '42000000-0000-0000-0000-000000000005',
        '22000000-0000-0000-0000-000000000003',
        '12000000-0000-0000-0000-000000000003',
        'Charlie',
        'registered',
        2.0,
        NULL
    );
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        '12000000-0000-0000-0000-000000000001',
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.leaderboard_entries
        ),
        '3',
        'only registered accounts with completed sessions are ranked'
    );
SELECT is(
        (
            SELECT string_agg(
                    account_id::text,
                    ','
                    ORDER BY rank
                )
            FROM public.leaderboard_entries
        ),
        '12000000-0000-0000-0000-000000000002,12000000-0000-0000-0000-000000000001,12000000-0000-0000-0000-000000000003',
        'leaderboard is ordered by total drinks, average per game, then account id'
    );
SELECT is(
        (
            SELECT rank::text
            FROM public.leaderboard_entries
            WHERE account_id = '12000000-0000-0000-0000-000000000002'
        ),
        '1',
        'highest total and average ranks first'
    );
SELECT is(
        (
            SELECT rank::text
            FROM public.leaderboard_entries
            WHERE account_id = '12000000-0000-0000-0000-000000000001'
        ),
        '2',
        'second rank follows by the same totals with a lower average'
    );
SELECT is(
        (
            SELECT rank::text
            FROM public.leaderboard_entries
            WHERE account_id = '12000000-0000-0000-0000-000000000003'
        ),
        '3',
        'third rank is assigned to the lower total'
    );
SELECT ok(
        NOT EXISTS (
            SELECT 1
            FROM public.leaderboard_entries
            WHERE account_id = '12000000-0000-0000-0000-000000000004'
        ),
        'users with no completed sessions are excluded from the leaderboard'
    );
SELECT ok(
        NOT EXISTS (
            SELECT 1
            FROM public.leaderboard_entries
            WHERE display_name = 'Guest Alpha'
        ),
        'guest participants are excluded from the leaderboard'
    );
SELECT *
FROM finish();
ROLLBACK;