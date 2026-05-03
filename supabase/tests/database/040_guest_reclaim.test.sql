-- 040_guest_reclaim.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);
CREATE TEMP TABLE guest_reclaim_context AS WITH host_auth AS (
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
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'guest-reclaim-host@test.local',
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{}'::jsonb,
            FALSE,
            FALSE
        )
    RETURNING id
),
host_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Guest Reclaim Host'
    FROM host_auth
    RETURNING id
),
session_row AS (
    INSERT INTO public.game_sessions (host_account_id, join_code)
    SELECT id,
        'GUEST4'
    FROM host_account
    RETURNING id
),
guest_participant AS (
    INSERT INTO public.participants (
            session_id,
            display_name,
            membership_type,
            guest_rejoin_token_hash
        )
    SELECT id,
        'Reconnectable Guest',
        'guest',
        'guest-reclaim-token'
    FROM session_row
    RETURNING id,
        session_id,
        guest_rejoin_token_hash
)
SELECT *
FROM guest_participant;
CREATE TEMP TABLE guest_reclaim_results (
    name text PRIMARY KEY,
    passed boolean NOT NULL
);
DO $$ BEGIN BEGIN
INSERT INTO public.participants (
        session_id,
        display_name,
        membership_type,
        guest_rejoin_token_hash
    )
VALUES (
        (
            SELECT session_id
            FROM guest_reclaim_context
        ),
        'Duplicate Guest',
        'guest',
        'guest-reclaim-token'
    );
INSERT INTO guest_reclaim_results
VALUES ('duplicate_guest_rejected', FALSE);
EXCEPTION
WHEN unique_violation THEN
INSERT INTO guest_reclaim_results
VALUES ('duplicate_guest_rejected', TRUE);
END;
END;
$$;
SELECT ok(
        EXISTS (
            SELECT 1
            FROM public.participants
            WHERE id = (
                    SELECT id
                    FROM guest_reclaim_context
                )
                AND guest_rejoin_token_hash = 'guest-reclaim-token'
        ),
        'guest participant is created with the token hash'
    );
SELECT ok(
        (
            SELECT passed
            FROM guest_reclaim_results
            WHERE name = 'duplicate_guest_rejected'
        ),
        'second guest join with the same token hash is rejected'
    );
SELECT is(
        (
            SELECT id::text
            FROM public.participants
            WHERE session_id = (
                    SELECT session_id
                    FROM guest_reclaim_context
                )
                AND guest_rejoin_token_hash = 'guest-reclaim-token'
        ),
        (
            SELECT id::text
            FROM guest_reclaim_context
        ),
        'reclaim lookup resolves to the original guest participant row'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT session_id
                    FROM guest_reclaim_context
                )
                AND guest_rejoin_token_hash = 'guest-reclaim-token'
        ),
        '1',
        'no duplicate guest participant row exists after reclaim attempts'
    );
SELECT *
FROM finish();
ROLLBACK;