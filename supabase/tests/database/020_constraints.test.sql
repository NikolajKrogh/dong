-- 020_constraints.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.accounts'::regclass
                AND contype = 'p'
        ),
        'accounts has a primary key'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.accounts'::regclass
                AND contype = 'f'
                AND confrelid = 'auth.users'::regclass
        ),
        'accounts.id references auth.users(id)'
    );
SELECT is(
        (
            SELECT string_agg(
                    e.enumlabel,
                    ','
                    ORDER BY e.enumsortorder
                )
            FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'session_state'
        ),
        'joinable,in_progress,completed',
        'session_state enum contains expected values'
    );
SELECT is(
        (
            SELECT string_agg(
                    e.enumlabel,
                    ','
                    ORDER BY e.enumsortorder
                )
            FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'participant_membership_type'
        ),
        'registered,guest',
        'participant_membership_type enum contains expected values'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
                AND tablename = 'game_sessions'
                AND indexdef LIKE 'CREATE UNIQUE INDEX% (join_code)%WHERE (state <> ''completed''::session_state)%'
        ),
        'game_sessions has a partial unique index for active join codes'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.game_sessions'::regclass
                AND conname = 'chk_game_sessions_completed_state'
                AND pg_get_constraintdef(oid) = 'CHECK (((completed_at IS NULL) OR (state = ''completed''::session_state)))'
        ),
        'game_sessions has the completed_at lifecycle check constraint'
    );
CREATE TEMP TABLE phase45_constraint_context AS WITH host_one_auth AS (
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
            'phase45-host-1@test.local',
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
            'phase45-host-2@test.local',
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
registered_auth AS (
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
            'phase45-registered@test.local',
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
        'Phase45 Host One'
    FROM host_one_auth
    RETURNING id
),
host_two_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Phase45 Host Two'
    FROM host_two_auth
    RETURNING id
),
registered_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Phase45 Registered'
    FROM registered_auth
    RETURNING id
),
session_one AS (
    INSERT INTO public.game_sessions (host_account_id, join_code)
    SELECT id,
        'P4S001'
    FROM host_one_account
    RETURNING id
),
session_two AS (
    INSERT INTO public.game_sessions (host_account_id, join_code)
    SELECT id,
        'P4S002'
    FROM host_two_account
    RETURNING id
),
registered_participant AS (
    INSERT INTO public.participants (
            session_id,
            account_id,
            display_name,
            membership_type
        )
    SELECT session_one.id,
        registered_account.id,
        'Registered Participant',
        'registered'
    FROM session_one,
        registered_account
    RETURNING id
),
guest_participant AS (
    INSERT INTO public.participants (
            session_id,
            display_name,
            membership_type,
            guest_rejoin_token_hash
        )
    SELECT session_one.id,
        'Guest Participant',
        'guest',
        'guest-token-1'
    FROM session_one
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
        'match-1',
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
        'match-2',
        'Home Two',
        'Away Two'
    FROM session_two
    RETURNING id
),
event_seed AS (
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
        registered_participant.id,
        'participant_joined',
        'event-seed-1',
        '{}'::jsonb
    FROM session_one,
        registered_participant
    RETURNING id
)
SELECT (
        SELECT id
        FROM session_one
    ) AS session_one_id,
    (
        SELECT id
        FROM session_two
    ) AS session_two_id,
    (
        SELECT id
        FROM registered_account
    ) AS registered_account_id,
    (
        SELECT id
        FROM registered_participant
    ) AS registered_participant_id,
    (
        SELECT id
        FROM guest_participant
    ) AS guest_participant_id,
    (
        SELECT id
        FROM match_one
    ) AS match_one_id,
    (
        SELECT id
        FROM match_two
    ) AS match_two_id;
CREATE TEMP TABLE phase45_constraint_results (
    name text PRIMARY KEY,
    passed boolean NOT NULL
);
DO $$ BEGIN BEGIN
INSERT INTO public.participants (
        session_id,
        account_id,
        display_name,
        membership_type
    )
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        (
            SELECT registered_account_id
            FROM phase45_constraint_context
        ),
        'Duplicate Registered',
        'registered'
    );
INSERT INTO phase45_constraint_results
VALUES ('duplicate_registered_participant', FALSE);
EXCEPTION
WHEN unique_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('duplicate_registered_participant', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.participants (
        session_id,
        display_name,
        membership_type,
        guest_rejoin_token_hash
    )
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        'Duplicate Guest Token',
        'guest',
        'guest-token-1'
    );
INSERT INTO phase45_constraint_results
VALUES ('duplicate_guest_token', FALSE);
EXCEPTION
WHEN unique_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('duplicate_guest_token', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.participants (session_id, display_name, membership_type)
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        'Invalid Registered Participant',
        'registered'
    );
INSERT INTO phase45_constraint_results
VALUES ('invalid_membership_combination', FALSE);
EXCEPTION
WHEN check_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('invalid_membership_combination', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.matches (
        session_id,
        source_provider,
        source_match_id,
        home_team_name,
        away_team_name,
        home_score
    )
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        'espn',
        'match-negative',
        'Negative Home',
        'Negative Away',
        -1
    );
INSERT INTO phase45_constraint_results
VALUES ('negative_score_rejected', FALSE);
EXCEPTION
WHEN check_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('negative_score_rejected', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        (
            SELECT registered_participant_id
            FROM phase45_constraint_context
        ),
        (
            SELECT match_two_id
            FROM phase45_constraint_context
        )
    );
INSERT INTO phase45_constraint_results
VALUES ('cross_session_assignment_rejected', FALSE);
EXCEPTION
WHEN foreign_key_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('cross_session_assignment_rejected', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.gameplay_events (
        session_id,
        sequence_number,
        actor_participant_id,
        event_type,
        idempotency_key,
        payload
    )
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        1,
        (
            SELECT registered_participant_id
            FROM phase45_constraint_context
        ),
        'score_changed',
        'event-seed-2',
        '{}'::jsonb
    );
INSERT INTO phase45_constraint_results
VALUES ('duplicate_event_sequence_rejected', FALSE);
EXCEPTION
WHEN unique_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('duplicate_event_sequence_rejected', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.gameplay_events (
        session_id,
        sequence_number,
        actor_participant_id,
        event_type,
        idempotency_key,
        payload
    )
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        2,
        (
            SELECT registered_participant_id
            FROM phase45_constraint_context
        ),
        'score_changed',
        'event-seed-1',
        '{}'::jsonb
    );
INSERT INTO phase45_constraint_results
VALUES ('duplicate_event_idempotency_rejected', FALSE);
EXCEPTION
WHEN unique_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('duplicate_event_idempotency_rejected', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.gameplay_events (
        session_id,
        sequence_number,
        actor_participant_id,
        event_type,
        idempotency_key,
        payload
    )
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        2,
        (
            SELECT registered_participant_id
            FROM phase45_constraint_context
        ),
        'not_allowed',
        'event-invalid-type',
        '{}'::jsonb
    );
INSERT INTO phase45_constraint_results
VALUES ('invalid_event_type_rejected', FALSE);
EXCEPTION
WHEN check_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('invalid_event_type_rejected', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.gameplay_events (
        session_id,
        sequence_number,
        actor_participant_id,
        event_type,
        idempotency_key,
        payload
    )
VALUES (
        (
            SELECT session_one_id
            FROM phase45_constraint_context
        ),
        0,
        (
            SELECT registered_participant_id
            FROM phase45_constraint_context
        ),
        'score_changed',
        'event-invalid-sequence',
        '{}'::jsonb
    );
INSERT INTO phase45_constraint_results
VALUES ('non_positive_sequence_rejected', FALSE);
EXCEPTION
WHEN check_violation THEN
INSERT INTO phase45_constraint_results
VALUES ('non_positive_sequence_rejected', TRUE);
END;
END;
$$;
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'duplicate_registered_participant'
        ),
        'duplicate registered participant is rejected'
    );
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'duplicate_guest_token'
        ),
        'duplicate guest token in the same session is rejected'
    );
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'invalid_membership_combination'
        ),
        'invalid participant membership combinations are rejected'
    );
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'negative_score_rejected'
        ),
        'negative match scores are rejected'
    );
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'cross_session_assignment_rejected'
        ),
        'cross-session assignments are rejected'
    );
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'duplicate_event_sequence_rejected'
        ),
        'duplicate event sequence numbers are rejected'
    );
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'duplicate_event_idempotency_rejected'
        ),
        'duplicate event idempotency keys are rejected'
    );
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'invalid_event_type_rejected'
        ),
        'invalid gameplay event types are rejected'
    );
SELECT ok(
        (
            SELECT passed
            FROM phase45_constraint_results
            WHERE name = 'non_positive_sequence_rejected'
        ),
        'non-positive gameplay event sequence numbers are rejected'
    );
SELECT *
FROM finish();
ROLLBACK;