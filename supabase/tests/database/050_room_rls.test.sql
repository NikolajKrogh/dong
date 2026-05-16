BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);
CREATE TEMP TABLE room_rls_context AS WITH host_one_auth AS (
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
            'room-host-1@test.local',
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
participant_one_auth AS (
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
            'room-participant-1@test.local',
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
host_two_auth AS (
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
            'room-host-2@test.local',
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
participant_two_auth AS (
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
            'room-participant-2@test.local',
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
host_one_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Room Host One'
    FROM host_one_auth
    RETURNING id
),
participant_one_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Room Participant One'
    FROM participant_one_auth
    RETURNING id
),
host_two_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Room Host Two'
    FROM host_two_auth
    RETURNING id
),
participant_two_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Room Participant Two'
    FROM participant_two_auth
    RETURNING id
),
session_one AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code)
    SELECT id,
        'RLS501'
    FROM host_one_account
    RETURNING id
),
session_two AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code)
    SELECT id,
        'RLS502'
    FROM host_two_account
    RETURNING id
),
participant_one AS (
    INSERT INTO public.participants (
            session_id,
            account_id,
            display_name,
            membership_type
        )
    SELECT session_one.id,
        participant_one_account.id,
        'Participant One',
        'registered'
    FROM session_one,
        participant_one_account
    RETURNING id
),
participant_two AS (
    INSERT INTO public.participants (
            session_id,
            account_id,
            display_name,
            membership_type
        )
    SELECT session_two.id,
        participant_two_account.id,
        'Participant Two',
        'registered'
    FROM session_two,
        participant_two_account
    RETURNING id
),
match_one AS (
    INSERT INTO public.matches (
            session_id,
            source_provider,
            source_match_id,
            home_team_name,
            away_team_name
        )
    SELECT session_one.id,
        'espn',
        'room-rls-match-1',
        'Home One',
        'Away One'
    FROM session_one
    RETURNING id
),
match_two AS (
    INSERT INTO public.matches (
            session_id,
            source_provider,
            source_match_id,
            home_team_name,
            away_team_name
        )
    SELECT session_two.id,
        'espn',
        'room-rls-match-2',
        'Home Two',
        'Away Two'
    FROM session_two
    RETURNING id
),
assignment_one AS (
    INSERT INTO public.assignments (session_id, participant_id, match_id)
    SELECT session_one.id,
        participant_one.id,
        match_one.id
    FROM session_one,
        participant_one,
        match_one
    RETURNING session_id,
        participant_id,
        match_id
),
assignment_two AS (
    INSERT INTO public.assignments (session_id, participant_id, match_id)
    SELECT session_two.id,
        participant_two.id,
        match_two.id
    FROM session_two,
        participant_two,
        match_two
    RETURNING session_id,
        participant_id,
        match_id
),
event_one AS (
    INSERT INTO public.gameplay_events (
            session_id,
            sequence_number,
            actor_participant_id,
            event_type,
            idempotency_key,
            payload
        )
    SELECT session_one.id,
        1,
        participant_one.id,
        'participant_joined',
        'room-rls-event-1',
        '{}'::jsonb
    FROM session_one,
        participant_one
    RETURNING id
),
event_two AS (
    INSERT INTO public.gameplay_events (
            session_id,
            sequence_number,
            actor_participant_id,
            event_type,
            idempotency_key,
            payload
        )
    SELECT session_two.id,
        1,
        participant_two.id,
        'participant_joined',
        'room-rls-event-2',
        '{}'::jsonb
    FROM session_two,
        participant_two
    RETURNING id
)
SELECT (
        SELECT id
        FROM host_one_account
    ) AS host_one_account_id,
    (
        SELECT id
        FROM participant_one_account
    ) AS participant_one_account_id,
    (
        SELECT id
        FROM host_two_account
    ) AS host_two_account_id,
    (
        SELECT id
        FROM participant_two_account
    ) AS participant_two_account_id,
    (
        SELECT id
        FROM session_one
    ) AS session_one_id,
    (
        SELECT id
        FROM session_two
    ) AS session_two_id,
    (
        SELECT id
        FROM participant_one
    ) AS participant_one_id,
    (
        SELECT id
        FROM participant_two
    ) AS participant_two_id,
    (
        SELECT id
        FROM match_one
    ) AS match_one_id,
    (
        SELECT id
        FROM match_two
    ) AS match_two_id,
    (
        SELECT id
        FROM event_one
    ) AS event_one_id,
    (
        SELECT id
        FROM event_two
    ) AS event_two_id;
GRANT SELECT ON TABLE room_rls_context TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT host_one_account_id::text
            FROM room_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '1',
        'host can read the game session row'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '2',
        'host can read the session participant rows'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.matches
            WHERE id = (
                    SELECT match_one_id
                    FROM room_rls_context
                )
        ),
        '1',
        'host can read the session match rows'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.assignments
            WHERE session_id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '1',
        'host can read the session assignment rows'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.gameplay_events
            WHERE id = (
                    SELECT event_one_id
                    FROM room_rls_context
                )
        ),
        '1',
        'host can read the session gameplay events'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT participant_one_account_id::text
            FROM room_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '1',
        'participant can read the game session row'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '2',
        'participant can read the session participant rows'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.matches
            WHERE id = (
                    SELECT match_one_id
                    FROM room_rls_context
                )
        ),
        '1',
        'participant can read the session match rows'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.assignments
            WHERE session_id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '1',
        'participant can read the session assignment rows'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.gameplay_events
            WHERE id = (
                    SELECT event_one_id
                    FROM room_rls_context
                )
        ),
        '1',
        'participant can read the session gameplay events'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT host_two_account_id::text
            FROM room_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '0',
        'unrelated host cannot read another session row'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '0',
        'unrelated host cannot read another session participants'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.matches
            WHERE id = (
                    SELECT match_one_id
                    FROM room_rls_context
                )
        ),
        '0',
        'unrelated host cannot read another session matches'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.assignments
            WHERE session_id = (
                    SELECT session_one_id
                    FROM room_rls_context
                )
        ),
        '0',
        'unrelated host cannot read another session assignments'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.gameplay_events
            WHERE id = (
                    SELECT event_one_id
                    FROM room_rls_context
                )
        ),
        '0',
        'unrelated host cannot read another session gameplay events'
    );
RESET ROLE;
SELECT *
FROM finish();
ROLLBACK;