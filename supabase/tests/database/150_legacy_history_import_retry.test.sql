-- 150_legacy_history_import_retry.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);
CREATE TEMP TABLE legacy_history_import_context AS WITH inserted_auth_user AS (
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
            'legacy-import-retry@test.local',
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
        'Legacy Import Retry'
    FROM inserted_auth_user
    RETURNING id
)
SELECT id AS account_id
FROM inserted_account;
CREATE TEMP TABLE legacy_history_import_payloads AS
SELECT jsonb_build_object(
        'sourceLocalSessionId',
        'legacy-session-a',
        'savedAt',
        '2026-05-01T19:00:00.000Z',
        'players',
        jsonb_build_array(
            jsonb_build_object(
                'id',
                'alex-session-a',
                'name',
                'Alex Example',
                'drinksTaken',
                2
            ),
            jsonb_build_object(
                'id',
                'jordan-session-a',
                'name',
                'Jordan Guest',
                'drinksTaken',
                1
            )
        ),
        'matches',
        jsonb_build_array(
            jsonb_build_object(
                'id',
                'legacy-match-a-1',
                'homeTeam',
                'Arsenal',
                'awayTeam',
                'Chelsea',
                'homeGoals',
                2,
                'awayGoals',
                1
            )
        ),
        'commonMatchId',
        'legacy-match-a-1',
        'playerAssignments',
        jsonb_build_object(
            'alex-session-a',
            jsonb_build_array('legacy-match-a-1'),
            'jordan-session-a',
            jsonb_build_array('legacy-match-a-1')
        ),
        'matchesPerPlayer',
        1
    ) AS first_session,
    jsonb_build_array(
        jsonb_build_object(
            'sourceLocalSessionId',
            'legacy-session-a',
            'savedAt',
            '2026-05-01T19:00:00.000Z',
            'players',
            jsonb_build_array(
                jsonb_build_object(
                    'id',
                    'alex-session-a',
                    'name',
                    'Alex Example',
                    'drinksTaken',
                    2
                ),
                jsonb_build_object(
                    'id',
                    'jordan-session-a',
                    'name',
                    'Jordan Guest',
                    'drinksTaken',
                    1
                )
            ),
            'matches',
            jsonb_build_array(
                jsonb_build_object(
                    'id',
                    'legacy-match-a-1',
                    'homeTeam',
                    'Arsenal',
                    'awayTeam',
                    'Chelsea',
                    'homeGoals',
                    2,
                    'awayGoals',
                    1
                )
            ),
            'commonMatchId',
            'legacy-match-a-1',
            'playerAssignments',
            jsonb_build_object(
                'alex-session-a',
                jsonb_build_array('legacy-match-a-1'),
                'jordan-session-a',
                jsonb_build_array('legacy-match-a-1')
            ),
            'matchesPerPlayer',
            1
        ),
        jsonb_build_object(
            'sourceLocalSessionId',
            'legacy-session-b',
            'savedAt',
            '2026-05-03T19:00:00.000Z',
            'players',
            jsonb_build_array(
                jsonb_build_object(
                    'id',
                    'alex-session-a',
                    'name',
                    'Alex Example',
                    'drinksTaken',
                    4
                ),
                jsonb_build_object(
                    'id',
                    'jordan-session-b',
                    'name',
                    'Jordan Guest',
                    'drinksTaken',
                    3
                )
            ),
            'matches',
            jsonb_build_array(
                jsonb_build_object(
                    'id',
                    'legacy-match-b-1',
                    'homeTeam',
                    'Liverpool',
                    'awayTeam',
                    'Everton',
                    'homeGoals',
                    3,
                    'awayGoals',
                    2
                )
            ),
            'commonMatchId',
            'legacy-match-b-1',
            'playerAssignments',
            jsonb_build_object(
                'alex-session-a',
                jsonb_build_array('legacy-match-b-1'),
                'jordan-session-b',
                jsonb_build_array('legacy-match-b-1')
            ),
            'matchesPerPlayer',
            1
        )
    ) AS retry_sessions;
CREATE TEMP TABLE legacy_history_import_seeded_sessions AS WITH seeded_game_session AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code)
    SELECT account_id,
        'IMPRET1'
    FROM legacy_history_import_context
    RETURNING id,
        owner_account_id
)
SELECT *
FROM seeded_game_session;
INSERT INTO private.legacy_history_import_sessions (
        account_id,
        source_fingerprint,
        source_local_session_id,
        claimed_local_participant_id,
        cloud_session_id,
        state,
        error_message,
        created_at,
        updated_at
    )
VALUES (
        (
            SELECT account_id
            FROM legacy_history_import_context
        ),
        private.compute_legacy_history_fingerprint(
            (
                SELECT first_session
                FROM legacy_history_import_payloads
            )
        ),
        'legacy-session-a',
        'alex-session-a',
        (
            SELECT id
            FROM legacy_history_import_seeded_sessions
        ),
        'imported',
        NULL,
        now(),
        now()
    );
INSERT INTO private.legacy_history_import_state (
        account_id,
        claimed_local_participant_id,
        claimed_local_participant_name,
        state,
        started_at,
        failed_at,
        last_error,
        created_at,
        updated_at
    )
VALUES (
        (
            SELECT account_id
            FROM legacy_history_import_context
        ),
        'alex-session-a',
        'Alex Example',
        'failed',
        now(),
        now(),
        'Previous attempt failed.',
        now(),
        now()
    );
CREATE TEMP TABLE legacy_history_import_runs (
    run_name text PRIMARY KEY,
    response jsonb NOT NULL
);
GRANT SELECT ON TABLE legacy_history_import_context TO authenticated;
GRANT SELECT ON TABLE legacy_history_import_payloads TO authenticated;
GRANT SELECT ON TABLE legacy_history_import_seeded_sessions TO authenticated;
GRANT SELECT ON TABLE private.legacy_history_import_state TO authenticated;
GRANT SELECT ON TABLE private.legacy_history_import_sessions TO authenticated;
GRANT SELECT,
    INSERT ON TABLE legacy_history_import_runs TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT account_id::text
            FROM legacy_history_import_context
        ),
        true
    );
INSERT INTO legacy_history_import_runs
VALUES (
        'retry',
        public.import_legacy_history(
            'alex-session-a',
            (
                SELECT retry_sessions
                FROM legacy_history_import_payloads
            )
        )
    );
SELECT is(
        (
            SELECT response->>'importState'
            FROM legacy_history_import_runs
            WHERE run_name = 'retry'
        ),
        'completed',
        'retry import completes after the missing session is imported'
    );
SELECT is(
        (
            SELECT response->'summary'->>'importedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'retry'
        ),
        '1',
        'retry import creates the remaining session'
    );
SELECT is(
        (
            SELECT response->'summary'->>'skippedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'retry'
        ),
        '1',
        'retry import skips the already-imported session'
    );
SELECT is(
        (
            SELECT response->'summary'->>'failedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'retry'
        ),
        '0',
        'retry import does not fail any sessions'
    );
SELECT is(
        (
            SELECT jsonb_array_length(response->'sessions')::text
            FROM legacy_history_import_runs
            WHERE run_name = 'retry'
        ),
        '2',
        'retry import reports both session outcomes'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE owner_account_id = (
                    SELECT account_id
                    FROM legacy_history_import_context
                )
        ),
        '2',
        'retry import creates only one additional cloud session'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM private.legacy_history_import_sessions
            WHERE account_id = (
                    SELECT account_id
                    FROM legacy_history_import_context
                )
        ),
        '2',
        'retry import keeps a single ledger row per fingerprint'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM private.legacy_history_import_sessions
            WHERE account_id = (
                    SELECT account_id
                    FROM legacy_history_import_context
                )
                AND state = 'imported'
        ),
        '2',
        'both ledger rows are imported after the retry'
    );
SELECT is(
        (
            SELECT state::text
            FROM private.legacy_history_import_state
            WHERE account_id = (
                    SELECT account_id
                    FROM legacy_history_import_context
                )
        ),
        'completed',
        'retry import clears the failed account state'
    );
SELECT ok(
        (
            SELECT completed_at IS NOT NULL
            FROM private.legacy_history_import_state
            WHERE account_id = (
                    SELECT account_id
                    FROM legacy_history_import_context
                )
        ),
        'retry import records a completed timestamp'
    );
SELECT *
FROM finish();
ROLLBACK;