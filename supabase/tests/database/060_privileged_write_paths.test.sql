BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);
CREATE TEMP TABLE privileged_write_context AS WITH host_auth AS (
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
            'privileged-host@test.local',
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
participant_auth AS (
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
            'privileged-participant@test.local',
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
        'Privileged Host'
    FROM host_auth
    RETURNING id
),
participant_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Privileged Participant'
    FROM participant_auth
    RETURNING id
),
session_row AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code)
    SELECT id,
        'WRIT60'
    FROM host_account
    RETURNING id
),
participant_row AS (
    INSERT INTO public.participants (
            session_id,
            account_id,
            display_name,
            membership_type
        )
    SELECT session_row.id,
        participant_account.id,
        'Privileged Participant',
        'registered'
    FROM session_row,
        participant_account
    RETURNING id
),
match_row AS (
    INSERT INTO public.matches (
            session_id,
            source_provider,
            source_match_id,
            home_team_name,
            away_team_name
        )
    SELECT session_row.id,
        'espn',
        'privileged-match-1',
        'Privileged Home',
        'Privileged Away'
    FROM session_row
    RETURNING id
),
assignment_row AS (
    INSERT INTO public.assignments (session_id, participant_id, match_id)
    SELECT session_row.id,
        participant_row.id,
        match_row.id
    FROM session_row,
        participant_row,
        match_row
    RETURNING session_id,
        participant_id,
        match_id
),
event_row AS (
    INSERT INTO public.gameplay_events (
            session_id,
            sequence_number,
            actor_participant_id,
            event_type,
            idempotency_key,
            payload
        )
    SELECT session_row.id,
        1,
        participant_row.id,
        'participant_joined',
        'privileged-event-1',
        '{}'::jsonb
    FROM session_row,
        participant_row
    RETURNING id
)
SELECT (
        SELECT id
        FROM host_account
    ) AS owner_account_id,
    (
        SELECT id
        FROM participant_account
    ) AS participant_account_id,
    (
        SELECT id
        FROM session_row
    ) AS session_id,
    (
        SELECT id
        FROM participant_row
    ) AS participant_id,
    (
        SELECT id
        FROM match_row
    ) AS match_id,
    (
        SELECT id
        FROM event_row
    ) AS event_id;
GRANT SELECT ON TABLE privileged_write_context TO authenticated,
    service_role;
CREATE TEMP TABLE privileged_write_results (
    name text PRIMARY KEY,
    passed boolean NOT NULL
);
GRANT SELECT,
    INSERT ON TABLE privileged_write_results TO authenticated;
CREATE TEMP TABLE privileged_write_artifacts (
    service_session_id uuid,
    service_participant_id uuid,
    service_match_id uuid,
    service_event_id uuid
);
INSERT INTO privileged_write_artifacts DEFAULT
VALUES;
GRANT SELECT,
    UPDATE ON TABLE privileged_write_artifacts TO service_role;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT owner_account_id::text
            FROM privileged_write_context
        ),
        true
    );
DO $$ BEGIN BEGIN
INSERT INTO public.game_sessions (owner_account_id, join_code)
VALUES (
        (
            SELECT owner_account_id
            FROM privileged_write_context
        ),
        'WRIT61'
    );
INSERT INTO privileged_write_results
VALUES (
        'authenticated_insert_game_session_rejected',
        FALSE
    );
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES (
        'authenticated_insert_game_session_rejected',
        TRUE
    );
END;
END;
$$;
DO $$ BEGIN BEGIN
UPDATE public.game_sessions
SET state = 'in_progress'
WHERE id = (
        SELECT session_id
        FROM privileged_write_context
    );
INSERT INTO privileged_write_results
VALUES (
        'authenticated_update_game_session_rejected',
        FALSE
    );
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES (
        'authenticated_update_game_session_rejected',
        TRUE
    );
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.participants (
        session_id,
        account_id,
        display_name,
        membership_type
    )
VALUES (
        (
            SELECT session_id
            FROM privileged_write_context
        ),
        (
            SELECT owner_account_id
            FROM privileged_write_context
        ),
        'Denied Host Participant',
        'registered'
    );
INSERT INTO privileged_write_results
VALUES (
        'authenticated_insert_participant_rejected',
        FALSE
    );
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES (
        'authenticated_insert_participant_rejected',
        TRUE
    );
END;
END;
$$;
DO $$ BEGIN BEGIN
UPDATE public.participants
SET display_name = 'Denied Update'
WHERE id = (
        SELECT participant_id
        FROM privileged_write_context
    );
INSERT INTO privileged_write_results
VALUES (
        'authenticated_update_participant_rejected',
        FALSE
    );
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES (
        'authenticated_update_participant_rejected',
        TRUE
    );
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.matches (
        session_id,
        source_provider,
        source_match_id,
        home_team_name,
        away_team_name
    )
VALUES (
        (
            SELECT session_id
            FROM privileged_write_context
        ),
        'espn',
        'privileged-match-2',
        'Denied Home',
        'Denied Away'
    );
INSERT INTO privileged_write_results
VALUES ('authenticated_insert_match_rejected', FALSE);
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES ('authenticated_insert_match_rejected', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
UPDATE public.matches
SET home_score = 1
WHERE id = (
        SELECT match_id
        FROM privileged_write_context
    );
INSERT INTO privileged_write_results
VALUES ('authenticated_update_match_rejected', FALSE);
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES ('authenticated_update_match_rejected', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES (
        (
            SELECT session_id
            FROM privileged_write_context
        ),
        (
            SELECT participant_id
            FROM privileged_write_context
        ),
        (
            SELECT match_id
            FROM privileged_write_context
        )
    );
INSERT INTO privileged_write_results
VALUES (
        'authenticated_insert_assignment_rejected',
        FALSE
    );
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES ('authenticated_insert_assignment_rejected', TRUE);
END;
END;
$$;
DO $$ BEGIN BEGIN
DELETE FROM public.assignments
WHERE session_id = (
        SELECT session_id
        FROM privileged_write_context
    )
    AND participant_id = (
        SELECT participant_id
        FROM privileged_write_context
    )
    AND match_id = (
        SELECT match_id
        FROM privileged_write_context
    );
INSERT INTO privileged_write_results
VALUES (
        'authenticated_delete_assignment_rejected',
        FALSE
    );
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES ('authenticated_delete_assignment_rejected', TRUE);
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
            SELECT session_id
            FROM privileged_write_context
        ),
        2,
        (
            SELECT participant_id
            FROM privileged_write_context
        ),
        'score_changed',
        'privileged-event-2',
        '{}'::jsonb
    );
INSERT INTO privileged_write_results
VALUES (
        'authenticated_insert_gameplay_event_rejected',
        FALSE
    );
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES (
        'authenticated_insert_gameplay_event_rejected',
        TRUE
    );
END;
END;
$$;
DO $$ BEGIN BEGIN
DELETE FROM public.gameplay_events
WHERE id = (
        SELECT event_id
        FROM privileged_write_context
    );
INSERT INTO privileged_write_results
VALUES (
        'authenticated_delete_gameplay_event_rejected',
        FALSE
    );
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO privileged_write_results
VALUES (
        'authenticated_delete_gameplay_event_rejected',
        TRUE
    );
END;
END;
$$;
RESET ROLE;
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_insert_game_session_rejected'
        ),
        'authenticated clients cannot insert game sessions directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_update_game_session_rejected'
        ),
        'authenticated clients cannot update game sessions directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_insert_participant_rejected'
        ),
        'authenticated clients cannot insert participants directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_update_participant_rejected'
        ),
        'authenticated clients cannot update participants directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_insert_match_rejected'
        ),
        'authenticated clients cannot insert matches directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_update_match_rejected'
        ),
        'authenticated clients cannot update matches directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_insert_assignment_rejected'
        ),
        'authenticated clients cannot insert assignments directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_delete_assignment_rejected'
        ),
        'authenticated clients cannot delete assignments directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_insert_gameplay_event_rejected'
        ),
        'authenticated clients cannot insert gameplay events directly'
    );
SELECT ok(
        (
            SELECT passed
            FROM privileged_write_results
            WHERE name = 'authenticated_delete_gameplay_event_rejected'
        ),
        'authenticated clients cannot delete gameplay events directly'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_roles
            WHERE rolname = 'service_role'
        ),
        'service_role exists for privileged write smoke checks'
    );
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
WITH inserted_session AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code)
    VALUES (
            (
                SELECT owner_account_id
                FROM privileged_write_context
            ),
            'SRV601'
        )
    RETURNING id
)
UPDATE privileged_write_artifacts
SET service_session_id = (
        SELECT id
        FROM inserted_session
    );
WITH inserted_participant AS (
    INSERT INTO public.participants (
            session_id,
            account_id,
            display_name,
            membership_type
        )
    VALUES (
            (
                SELECT service_session_id
                FROM privileged_write_artifacts
            ),
            (
                SELECT participant_account_id
                FROM privileged_write_context
            ),
            'Service Participant',
            'registered'
        )
    RETURNING id
)
UPDATE privileged_write_artifacts
SET service_participant_id = (
        SELECT id
        FROM inserted_participant
    );
WITH inserted_match AS (
    INSERT INTO public.matches (
            session_id,
            source_provider,
            source_match_id,
            home_team_name,
            away_team_name
        )
    VALUES (
            (
                SELECT service_session_id
                FROM privileged_write_artifacts
            ),
            'espn',
            'service-match-1',
            'Service Home',
            'Service Away'
        )
    RETURNING id
)
UPDATE privileged_write_artifacts
SET service_match_id = (
        SELECT id
        FROM inserted_match
    );
INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES (
        (
            SELECT service_session_id
            FROM privileged_write_artifacts
        ),
        (
            SELECT service_participant_id
            FROM privileged_write_artifacts
        ),
        (
            SELECT service_match_id
            FROM privileged_write_artifacts
        )
    );
WITH inserted_event AS (
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
                SELECT service_session_id
                FROM privileged_write_artifacts
            ),
            1,
            (
                SELECT service_participant_id
                FROM privileged_write_artifacts
            ),
            'participant_joined',
            'service-event-1',
            '{}'::jsonb
        )
    RETURNING id
)
UPDATE privileged_write_artifacts
SET service_event_id = (
        SELECT id
        FROM inserted_event
    );
UPDATE public.matches
SET home_score = 2
WHERE id = (
        SELECT service_match_id
        FROM privileged_write_artifacts
    );
RESET ROLE;
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE id = (
                    SELECT service_session_id
                    FROM privileged_write_artifacts
                )
        ),
        '1',
        'service_role can insert game sessions'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE id = (
                    SELECT service_participant_id
                    FROM privileged_write_artifacts
                )
        ),
        '1',
        'service_role can insert participants'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.matches
            WHERE id = (
                    SELECT service_match_id
                    FROM privileged_write_artifacts
                )
        ),
        '1',
        'service_role can insert matches'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.assignments
            WHERE session_id = (
                    SELECT service_session_id
                    FROM privileged_write_artifacts
                )
                AND participant_id = (
                    SELECT service_participant_id
                    FROM privileged_write_artifacts
                )
                AND match_id = (
                    SELECT service_match_id
                    FROM privileged_write_artifacts
                )
        ),
        '1',
        'service_role can insert assignments'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.gameplay_events
            WHERE id = (
                    SELECT service_event_id
                    FROM privileged_write_artifacts
                )
        ),
        '1',
        'service_role can insert gameplay events'
    );
SELECT is(
        (
            SELECT home_score::text
            FROM public.matches
            WHERE id = (
                    SELECT service_match_id
                    FROM privileged_write_artifacts
                )
        ),
        '2',
        'service_role can update room state through the approved path'
    );
SELECT *
FROM finish();
ROLLBACK;