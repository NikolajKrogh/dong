-- 050_idempotency_and_completion.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

CREATE TEMP TABLE phase5_event_context AS
WITH host_auth AS (
	INSERT INTO auth.users (
		id, aud, role, email, email_confirmed_at, created_at, updated_at,
		raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
	)
	VALUES (
		gen_random_uuid(), 'authenticated', 'authenticated', 'phase5-host@test.local', now(), now(), now(),
		'{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, FALSE, FALSE
	)
	RETURNING id
), host_account AS (
	INSERT INTO public.accounts (id, preferred_display_name)
	SELECT id, 'Phase5 Host' FROM host_auth
	RETURNING id
), session_row AS (
	INSERT INTO public.game_sessions (host_account_id, join_code)
	SELECT id, 'EVT501' FROM host_account
	RETURNING id
), participant_row AS (
	INSERT INTO public.participants (session_id, display_name, membership_type, guest_rejoin_token_hash)
	SELECT id, 'Event Guest', 'guest', 'event-guest-token'
	FROM session_row
	RETURNING id, session_id
)
SELECT id AS participant_id, session_id FROM participant_row;

CREATE TEMP TABLE phase5_sequence_observations AS
WITH first_call AS (
	SELECT public.allocate_event_sequence((SELECT session_id FROM phase5_event_context)) AS first_seq
), second_call AS (
	SELECT public.allocate_event_sequence((SELECT session_id FROM phase5_event_context)) AS second_seq
)
SELECT first_seq, second_seq FROM first_call CROSS JOIN second_call;

INSERT INTO public.gameplay_events (session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
VALUES (
	(SELECT session_id FROM phase5_event_context),
	(SELECT first_seq FROM phase5_sequence_observations),
	(SELECT participant_id FROM phase5_event_context),
	'participant_joined',
	'phase5-event-1',
	'{}'::jsonb
);

INSERT INTO public.gameplay_events (session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
VALUES (
	(SELECT session_id FROM phase5_event_context),
	(SELECT second_seq FROM phase5_sequence_observations),
	(SELECT participant_id FROM phase5_event_context),
	'score_changed',
	'phase5-event-2',
	'{}'::jsonb
);

CREATE TEMP TABLE phase5_results (
	name text PRIMARY KEY,
	passed boolean NOT NULL
);

DO $$
BEGIN
	BEGIN
		INSERT INTO public.gameplay_events (session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
		VALUES (
			(SELECT session_id FROM phase5_event_context),
			3,
			(SELECT participant_id FROM phase5_event_context),
			'drink_changed',
			'phase5-event-2',
			'{}'::jsonb
		);
		INSERT INTO phase5_results VALUES ('duplicate_idempotency_rejected', FALSE);
	EXCEPTION
		WHEN unique_violation THEN
			INSERT INTO phase5_results VALUES ('duplicate_idempotency_rejected', TRUE);
	END;
END;
$$;

UPDATE public.game_sessions
SET state = 'completed', completed_at = now()
WHERE id = (SELECT session_id FROM phase5_event_context);

DO $$
BEGIN
	BEGIN
		INSERT INTO public.gameplay_events (session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload)
		VALUES (
			(SELECT session_id FROM phase5_event_context),
			99,
			(SELECT participant_id FROM phase5_event_context),
			'drink_changed',
			'phase5-event-3',
			'{}'::jsonb
		);
		INSERT INTO phase5_results VALUES ('completed_session_insert_rejected', FALSE);
	EXCEPTION
		WHEN OTHERS THEN
			INSERT INTO phase5_results VALUES ('completed_session_insert_rejected', TRUE);
	END;
END;
$$;

SELECT is((SELECT first_seq::text FROM phase5_sequence_observations), '1', 'allocate_event_sequence returns 1 for the first event');
SELECT is((SELECT second_seq::text FROM phase5_sequence_observations), '2', 'allocate_event_sequence returns 2 for the second event');
SELECT is((SELECT last_event_sequence::text FROM public.game_sessions WHERE id = (SELECT session_id FROM phase5_event_context)), '2', 'last_event_sequence tracks the latest allocated sequence');
SELECT ok((SELECT passed FROM phase5_results WHERE name = 'duplicate_idempotency_rejected'), 'duplicate idempotency keys are rejected');
SELECT is((SELECT string_agg(event_type, ',' ORDER BY sequence_number) FROM public.gameplay_events WHERE session_id = (SELECT session_id FROM phase5_event_context)), 'participant_joined,score_changed', 'event rows replay in sequence order');
SELECT ok((SELECT passed FROM phase5_results WHERE name = 'completed_session_insert_rejected'), 'completed sessions reject new gameplay events');
SELECT is((SELECT count(*)::text FROM public.gameplay_events WHERE session_id = (SELECT session_id FROM phase5_event_context)), '2', 'failed completion writes do not append an extra event');

SELECT * FROM finish();
ROLLBACK;
