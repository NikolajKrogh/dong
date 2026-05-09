-- 140_legacy_history_import_claim.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);
CREATE TEMP TABLE legacy_history_import_accounts AS WITH first_auth AS (
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
            'legacy-import-claim-first@test.local',
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
first_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Legacy Import Claim First'
    FROM first_auth
    RETURNING id
),
second_auth AS (
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
            'legacy-import-claim-second@test.local',
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
second_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Legacy Import Claim Second'
    FROM second_auth
    RETURNING id
)
SELECT 'first'::text AS account_label,
    id AS account_id
FROM first_account
UNION ALL
SELECT 'second'::text AS account_label,
    id AS account_id
FROM second_account;
CREATE TEMP TABLE legacy_history_import_payloads AS
SELECT jsonb_build_array(
        jsonb_build_object(
            'sourceLocalSessionId',
            'legacy-session-mixed',
            'savedAt',
            '2026-05-04T19:00:00.000Z',
            'claimedLocalParticipantId',
            'alex-session-a',
            'players',
            jsonb_build_array(
                jsonb_build_object(
                    'id',
                    'alex-session-a',
                    'name',
                    'Alex Example',
                    'drinksTaken',
                    3
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
            'guestParticipants',
            jsonb_build_array(
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
                    'legacy-match-mixed-1',
                    'homeTeam',
                    'Arsenal',
                    'awayTeam',
                    'Chelsea',
                    'homeGoals',
                    3,
                    'awayGoals',
                    2
                )
            ),
            'commonMatchId',
            'legacy-match-mixed-1',
            'playerAssignments',
            jsonb_build_object(
                'alex-session-a',
                jsonb_build_array('legacy-match-mixed-1'),
                'jordan-session-a',
                jsonb_build_array('legacy-match-mixed-1')
            ),
            'matchesPerPlayer',
            1
        )
    ) AS mixed_sessions;
CREATE TEMP TABLE legacy_history_import_runs (
    run_name text PRIMARY KEY,
    response jsonb NOT NULL
);
GRANT SELECT ON TABLE legacy_history_import_accounts TO authenticated;
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
            FROM legacy_history_import_accounts
            WHERE account_label = 'first'
        ),
        true
    );
INSERT INTO legacy_history_import_runs
VALUES (
        'first',
        public.import_legacy_history(
            'alex-session-a',
            (
                SELECT mixed_sessions
                FROM legacy_history_import_payloads
            )
        )
    );
CREATE TEMP TABLE legacy_history_import_first_session AS
SELECT id AS cloud_session_id
FROM public.game_sessions
WHERE host_account_id = (
        SELECT account_id
        FROM legacy_history_import_accounts
        WHERE account_label = 'first'
    )
ORDER BY created_at DESC
LIMIT 1;
SELECT is(
        (
            SELECT response->>'importState'
            FROM legacy_history_import_runs
            WHERE run_name = 'first'
        ),
        'completed',
        'first account import completes'
    );
SELECT is(
        (
            SELECT response->'summary'->>'importedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'first'
        ),
        '1',
        'first account import writes one cloud session'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE host_account_id = (
                    SELECT account_id
                    FROM legacy_history_import_accounts
                    WHERE account_label = 'first'
                )
        ),
        '1',
        'first account has one imported cloud session'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT cloud_session_id
                    FROM legacy_history_import_first_session
                )
        ),
        '2',
        'first imported session keeps both participants'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT cloud_session_id
                    FROM legacy_history_import_first_session
                )
                AND account_id = (
                    SELECT account_id
                    FROM legacy_history_import_accounts
                    WHERE account_label = 'first'
                )
                AND membership_type = 'registered'
        ),
        '1',
        'first imported session keeps the claimant registered'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT cloud_session_id
                    FROM legacy_history_import_first_session
                )
                AND account_id IS NULL
                AND membership_type = 'guest'
        ),
        '1',
        'first imported session keeps the guest scoped to the session'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT account_id::text
            FROM legacy_history_import_accounts
            WHERE account_label = 'second'
        ),
        true
    );
INSERT INTO legacy_history_import_runs
VALUES (
        'second',
        public.import_legacy_history(
            'alex-session-a',
            (
                SELECT mixed_sessions
                FROM legacy_history_import_payloads
            )
        )
    );
CREATE TEMP TABLE legacy_history_import_second_session AS
SELECT id AS cloud_session_id
FROM public.game_sessions
WHERE host_account_id = (
        SELECT account_id
        FROM legacy_history_import_accounts
        WHERE account_label = 'second'
    )
ORDER BY created_at DESC
LIMIT 1;
SELECT is(
        (
            SELECT response->>'importState'
            FROM legacy_history_import_runs
            WHERE run_name = 'second'
        ),
        'completed',
        'second account import completes'
    );
SELECT is(
        (
            SELECT response->'summary'->>'importedCount'
            FROM legacy_history_import_runs
            WHERE run_name = 'second'
        ),
        '1',
        'second account import writes one cloud session'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.game_sessions
            WHERE host_account_id = (
                    SELECT account_id
                    FROM legacy_history_import_accounts
                    WHERE account_label = 'second'
                )
        ),
        '1',
        'second account has one imported cloud session'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT cloud_session_id
                    FROM legacy_history_import_second_session
                )
        ),
        '2',
        'second imported session keeps both participants'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT cloud_session_id
                    FROM legacy_history_import_second_session
                )
                AND account_id = (
                    SELECT account_id
                    FROM legacy_history_import_accounts
                    WHERE account_label = 'second'
                )
                AND membership_type = 'registered'
        ),
        '1',
        'second imported session keeps the claimant registered'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT cloud_session_id
                    FROM legacy_history_import_second_session
                )
                AND account_id IS NULL
                AND membership_type = 'guest'
        ),
        '1',
        'second imported session keeps the guest scoped to the session'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM private.legacy_history_import_state
        ),
        '2',
        'each account keeps its own import state row'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM private.legacy_history_import_sessions
        ),
        '2',
        'each account keeps its own imported session ledger entry'
    );
SELECT is(
        (
            SELECT count(DISTINCT source_fingerprint)::text
            FROM private.legacy_history_import_sessions
        ),
        '1',
        'the same source fingerprint is reused across accounts without merging their ledgers'
    );
SELECT is(
        (
            SELECT count(DISTINCT account_id)::text
            FROM private.legacy_history_import_sessions
        ),
        '2',
        'the ledger isolates source rows per account'
    );
SELECT *
FROM finish();
ROLLBACK;