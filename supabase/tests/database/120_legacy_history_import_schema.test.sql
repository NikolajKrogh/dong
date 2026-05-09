-- 120_legacy_history_import_schema.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);
SELECT ok(
        to_regnamespace('private') IS NOT NULL,
        'private schema exists'
    );
SELECT ok(
        to_regclass('private.legacy_history_import_state') IS NOT NULL,
        'legacy_history_import_state table exists'
    );
SELECT ok(
        to_regclass('private.legacy_history_import_sessions') IS NOT NULL,
        'legacy_history_import_sessions table exists'
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
            WHERE t.typname = 'legacy_history_import_state'
        ),
        'in_progress,completed,failed',
        'legacy_history_import_state enum contains expected values'
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
            WHERE t.typname = 'legacy_history_import_session_state'
        ),
        'pending,imported,skipped,failed,conflict',
        'legacy_history_import_session_state enum contains expected values'
    );
SELECT is(
        (
            SELECT string_agg(
                    column_name || ':' || (
                        CASE
                            WHEN data_type = 'USER-DEFINED' THEN udt_name
                            ELSE data_type
                        END
                    ) || ':' || is_nullable,
                    ','
                    ORDER BY ordinal_position
                )
            FROM information_schema.columns
            WHERE table_schema = 'private'
                AND table_name = 'legacy_history_import_state'
        ),
        'account_id:uuid:NO,claimed_local_participant_id:text:NO,claimed_local_participant_name:text:NO,state:legacy_history_import_state:NO,started_at:timestamp with time zone:NO,completed_at:timestamp with time zone:YES,failed_at:timestamp with time zone:YES,last_error:text:YES,created_at:timestamp with time zone:NO,updated_at:timestamp with time zone:NO',
        'legacy_history_import_state columns, types, and nullability match expectations'
    );
SELECT is(
        (
            SELECT string_agg(
                    column_name || ':' || (
                        CASE
                            WHEN data_type = 'USER-DEFINED' THEN udt_name
                            ELSE data_type
                        END
                    ) || ':' || is_nullable,
                    ','
                    ORDER BY ordinal_position
                )
            FROM information_schema.columns
            WHERE table_schema = 'private'
                AND table_name = 'legacy_history_import_sessions'
        ),
        'id:uuid:NO,account_id:uuid:NO,source_fingerprint:text:NO,source_local_session_id:text:NO,claimed_local_participant_id:text:NO,cloud_session_id:uuid:YES,state:legacy_history_import_session_state:NO,error_message:text:YES,created_at:timestamp with time zone:NO,updated_at:timestamp with time zone:NO',
        'legacy_history_import_sessions columns, types, and nullability match expectations'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'private.legacy_history_import_state'::regclass
                AND contype = 'f'
                AND confrelid = 'public.accounts'::regclass
        ),
        'legacy_history_import_state.account_id references public.accounts(id)'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'private.legacy_history_import_sessions'::regclass
                AND contype = 'f'
                AND confrelid = 'public.accounts'::regclass
        ),
        'legacy_history_import_sessions.account_id references public.accounts(id)'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'private.legacy_history_import_sessions'::regclass
                AND contype = 'f'
                AND confrelid = 'public.game_sessions'::regclass
        ),
        'legacy_history_import_sessions.cloud_session_id references public.game_sessions(id)'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'private'
                AND tablename = 'legacy_history_import_sessions'
                AND indexdef LIKE 'CREATE UNIQUE INDEX% (account_id, source_fingerprint)%'
        ),
        'legacy_history_import_sessions has a unique index on account_id and source_fingerprint'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'private'
                AND tablename = 'legacy_history_import_sessions'
                AND indexname = 'idx_legacy_history_import_sessions_account_id'
        ),
        'legacy_history_import_sessions has an account_id index'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'private'
                AND tablename = 'legacy_history_import_sessions'
                AND indexname = 'idx_legacy_history_import_sessions_cloud_session_id'
                AND indexdef LIKE '%WHERE (cloud_session_id IS NOT NULL)%'
        ),
        'legacy_history_import_sessions has a partial cloud_session_id index'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'private'
                AND tablename = 'legacy_history_import_sessions'
                AND indexname = 'idx_legacy_history_import_sessions_state'
        ),
        'legacy_history_import_sessions has a state index'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'private.legacy_history_import_state'::regclass
                AND conname = 'chk_legacy_history_import_state_completed_at'
        ),
        'legacy_history_import_state completed_at check constraint exists'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'private.legacy_history_import_sessions'::regclass
                AND conname = 'chk_legacy_history_import_sessions_failed_message'
        ),
        'legacy_history_import_sessions failed_message check constraint exists'
    );
SELECT ok(
        to_regprocedure(
            'private.compute_legacy_history_fingerprint(jsonb)'
        ) IS NOT NULL,
        'private.compute_legacy_history_fingerprint(jsonb) exists'
    );
SELECT ok(
        to_regprocedure('private.import_legacy_history(text, jsonb)') IS NOT NULL,
        'private.import_legacy_history(text, jsonb) exists'
    );
SELECT ok(
        to_regprocedure('public.import_legacy_history(text, jsonb)') IS NOT NULL,
        'public.import_legacy_history(text, jsonb) exists'
    );
SELECT ok(
        has_function_privilege(
            'authenticated',
            'public.import_legacy_history(text, jsonb)',
            'EXECUTE'
        ),
        'authenticated can execute public.import_legacy_history(text, jsonb)'
    );
SELECT *
FROM finish();
ROLLBACK;