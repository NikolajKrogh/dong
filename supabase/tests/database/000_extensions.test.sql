-- 000_extensions.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
SELECT plan(2);
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_extension
            WHERE extname = 'pgtap'
        ),
        'pgtap extension is installed'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_namespace
            WHERE nspname = 'extensions'
        ),
        'extensions schema is available for pgtap'
    );
SELECT *
FROM finish();
ROLLBACK;