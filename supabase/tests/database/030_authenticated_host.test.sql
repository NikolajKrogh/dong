-- 030_authenticated_host.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);
CREATE TEMP TABLE host_session_context AS WITH inserted_auth_user AS (
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
            'host-phase3@test.local',
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
inserted_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Host Phase 3'
    FROM inserted_auth_user
    RETURNING id
),
inserted_session AS (
    INSERT INTO public.game_sessions (host_account_id, join_code)
    SELECT id,
        'ROOM01'
    FROM inserted_account
    RETURNING id,
        host_account_id,
        join_code,
        state
)
SELECT *
FROM inserted_session;
CREATE TEMP TABLE duplicate_join_code_check (rejected boolean NOT NULL);
DO $$ BEGIN BEGIN
INSERT INTO public.game_sessions (host_account_id, join_code)
VALUES (
        (
            SELECT host_account_id
            FROM host_session_context
        ),
        'ROOM01'
    );
INSERT INTO duplicate_join_code_check
VALUES (FALSE);
EXCEPTION
WHEN unique_violation THEN
INSERT INTO duplicate_join_code_check
VALUES (TRUE);
END;
END;
$$;
SELECT ok(
        EXISTS (
            SELECT 1
            FROM public.game_sessions
            WHERE id = (
                    SELECT id
                    FROM host_session_context
                )
        ),
        'host session is created'
    );
SELECT is(
        (
            SELECT host_account_id::text
            FROM public.game_sessions
            WHERE id = (
                    SELECT id
                    FROM host_session_context
                )
        ),
        (
            SELECT host_account_id::text
            FROM host_session_context
        ),
        'host identity is preserved on reload'
    );
SELECT is(
        (
            SELECT join_code
            FROM public.game_sessions
            WHERE id = (
                    SELECT id
                    FROM host_session_context
                )
        ),
        'ROOM01',
        'join code is preserved on reload'
    );
SELECT is(
        (
            SELECT state::text
            FROM public.game_sessions
            WHERE id = (
                    SELECT id
                    FROM host_session_context
                )
        ),
        'joinable',
        'session state begins as joinable'
    );
SELECT ok(
        (
            SELECT rejected
            FROM duplicate_join_code_check
            LIMIT 1
        ), 'duplicate active join code is rejected'
    );
SELECT *
FROM finish();
ROLLBACK;