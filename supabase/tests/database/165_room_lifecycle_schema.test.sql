BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(2);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'session_state' AND e.enumlabel = 'closed'
    ),
    'session_state enum has a closed value'
);

CREATE TEMP TABLE ctx AS
WITH u AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'lifecycle-host@test.local', now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false)
    RETURNING id
),
a AS (INSERT INTO public.accounts (id, preferred_display_name) SELECT id, 'Lifecycle Host' FROM u RETURNING id),
s AS (INSERT INTO public.game_sessions (owner_account_id, join_code) SELECT id, 'LIFE01' FROM a RETURNING id)
SELECT (SELECT id FROM a) AS account_id, (SELECT id FROM s) AS session_id;

UPDATE public.game_sessions SET last_activity_at = now() - interval '2 days'
WHERE id = (SELECT session_id FROM ctx);

INSERT INTO public.gameplay_events (session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
SELECT ctx.session_id, public.allocate_event_sequence(ctx.session_id),
    (SELECT p.id FROM public.participants p WHERE p.session_id = ctx.session_id AND p.session_role = 'owner' LIMIT 1),
    'score_changed', concat('evt:', gen_random_uuid()::text), '{}'::jsonb
FROM ctx;

SELECT ok(
    (SELECT last_activity_at FROM public.game_sessions WHERE id = (SELECT session_id FROM ctx)) > now() - interval '1 minute',
    'inserting a gameplay event bumps game_sessions.last_activity_at'
);

SELECT * FROM finish();
ROLLBACK;
