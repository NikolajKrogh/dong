-- 130_legacy_history_import_dedupe.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);
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
            'legacy-import-dedupe@test.local',
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
        'Legacy Import Dedupe'
    FROM inserted_auth_user
    RETURNING id
)
SELECT id AS account_id
FROM inserted_account;
CREATE TEMP TABLE legacy_history_import_payloads AS
SELECT jsonb_build_array(
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
        )
    ) AS single_session;
CREATE TEMP TABLE legacy_history_import_runs (
    run_name text PRIMARY KEY,
    response jsonb NOT NULL
);
GRANT SELECT ON TABLE legacy_history_import_context TO authenticated;
GRANT SELECT ON TABLE legacy_history_import_payloads TO authenticated;
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
        'first',
        public.import_legacy_history(
            'alex-session-a',
            (
                SELECT single_session
                FROM legacy_history_import_payloads
            )
        )
    );
INSERT INTO legacy_history_import_runs
VALUES (
        'second',
        public.import_legacy_history(
            'alex-session-a',
            (
                SELECT single_session
                FROM legacy_history_import_payloads
            )
        )
    );
SELECT is(
        (
            SELECT response->>'importState'
            FROM legacy_history_import_runs
            WHERE run_name = 'first'
        ),
        'completed',
        'first import completes'
    );
SELECT is(
        (
            SELECT response->'summary'->>'importedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'first'
        ),
        '1',
        'first import creates one session'
    );
SELECT is(
        (
            SELECT response->'summary'->>'skippedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'first'
        ),
        '0',
        'first import skips nothing'
    );
SELECT is(
        (
            SELECT response->'summary'->>'failedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'first'
        ),
        '0',
        'first import fails nothing'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE host_account_id = (
                    SELECT account_id
                    FROM legacy_history_import_context
                )
        ),
        '1',
        'first import creates one cloud session'
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
        'import state is completed after the first run'
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
        'import completion timestamp is recorded'
    );
SELECT is(
        (
            SELECT response->>'importState'
            FROM legacy_history_import_runs
            WHERE run_name = 'second'
        ),
        'completed',
        'second import stays completed'
    );
SELECT is(
        (
            SELECT response->'summary'->>'importedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'second'
        ),
        '0',
        'second import is a no-op'
    );
SELECT is(
        (
            SELECT response->'summary'->>'skippedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'second'
        ),
        '0',
        'second import skips nothing'
    );
SELECT is(
        (
            SELECT response->'summary'->>'failedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'second'
        ),
        '0',
        'second import fails nothing'
    );
SELECT is(
        (
            SELECT jsonb_array_length(response->'sessions')::text
            FROM legacy_history_import_runs
            WHERE run_name = 'second'
        ),
        '0',
        'second import returns no session results'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE host_account_id = (
                    SELECT account_id
                    FROM legacy_history_import_context
                )
        ),
        '1',
        'completed import does not create duplicate cloud sessions'
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
        '1',
        'completed import does not create duplicate ledger rows'
    );
SELECT is(
        (
            SELECT state::text
            FROM private.legacy_history_import_sessions
            WHERE account_id = (
                    SELECT account_id
                    FROM legacy_history_import_context
                )
        ),
        'imported',
        'ledger row remains imported after the retry attempt'
    );
SELECT *
FROM finish();
ROLLBACK;