-- 010_schema.test.sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(30);

SELECT ok(to_regclass('public.accounts') IS NOT NULL, 'accounts table exists');

SELECT ok(to_regtype('session_state') IS NOT NULL, 'session_state enum exists');

SELECT ok(to_regtype('participant_membership_type') IS NOT NULL, 'participant_membership_type enum exists');

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'id'),
	'uuid',
	'accounts.id is uuid'
);

SELECT is(
	(SELECT is_nullable
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'id'),
	'NO',
	'accounts.id is not nullable'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'preferred_display_name'),
	'text',
	'accounts.preferred_display_name is text'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'created_at'),
	'timestamp with time zone',
	'accounts.created_at is timestamptz'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'updated_at'),
	'timestamp with time zone',
	'accounts.updated_at is timestamptz'
);

SELECT ok(to_regclass('public.game_sessions') IS NOT NULL, 'game_sessions table exists');

SELECT is(
	(SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions'),
	'id,host_account_id,join_code,state,common_match_id,last_event_sequence,created_at,started_at,completed_at',
	'game_sessions has expected columns'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'id'),
	'uuid',
	'game_sessions.id is uuid'
);

SELECT is(
	(SELECT is_nullable
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'host_account_id'),
	'NO',
	'game_sessions.host_account_id is not nullable'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'join_code'),
	'text',
	'game_sessions.join_code is text'
);

SELECT is(
	(SELECT is_nullable
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'join_code'),
	'NO',
	'game_sessions.join_code is not nullable'
);

SELECT is(
	(SELECT udt_name
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'state'),
	'session_state',
	'game_sessions.state uses the session_state enum'
);

SELECT is(
	(SELECT is_nullable
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'state'),
	'NO',
	'game_sessions.state is not nullable'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'common_match_id'),
	'uuid',
	'game_sessions.common_match_id is uuid'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'last_event_sequence'),
	'bigint',
	'game_sessions.last_event_sequence is bigint'
);

SELECT is(
	(SELECT column_default
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'state'),
	'''joinable''::session_state',
	'game_sessions.state defaults to joinable'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'created_at'),
	'timestamp with time zone',
	'game_sessions.created_at is timestamptz'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'started_at'),
	'timestamp with time zone',
	'game_sessions.started_at is timestamptz'
);

SELECT is(
	(SELECT data_type
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'game_sessions' AND column_name = 'completed_at'),
	'timestamp with time zone',
	'game_sessions.completed_at is timestamptz'
);

SELECT ok(to_regclass('public.participants') IS NOT NULL, 'participants table exists');

SELECT is(
	(SELECT string_agg(
		column_name || ':' ||
		(CASE WHEN data_type = 'USER-DEFINED' THEN udt_name ELSE data_type END) || ':' ||
		is_nullable,
		',' ORDER BY ordinal_position)
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'participants'),
	'id:uuid:NO,session_id:uuid:NO,account_id:uuid:YES,display_name:text:NO,membership_type:participant_membership_type:NO,current_drink_total:numeric:NO,guest_rejoin_token_hash:text:YES,created_at:timestamp with time zone:YES',
	'participants columns, types, and nullability match expectations'
);

SELECT ok(to_regclass('public.matches') IS NOT NULL, 'matches table exists');

SELECT is(
	(SELECT string_agg(
		column_name || ':' ||
		(CASE WHEN data_type = 'USER-DEFINED' THEN udt_name ELSE data_type END) || ':' ||
		is_nullable,
		',' ORDER BY ordinal_position)
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'matches'),
	'id:uuid:NO,session_id:uuid:NO,source_provider:text:NO,source_match_id:text:YES,home_team_name:text:NO,away_team_name:text:NO,kickoff_at:timestamp with time zone:YES,home_score:integer:NO,away_score:integer:NO,created_at:timestamp with time zone:YES',
	'matches columns, types, and nullability match expectations'
);

SELECT ok(to_regclass('public.assignments') IS NOT NULL, 'assignments table exists');

SELECT is(
	(SELECT string_agg(
		column_name || ':' ||
		(CASE WHEN data_type = 'USER-DEFINED' THEN udt_name ELSE data_type END) || ':' ||
		is_nullable,
		',' ORDER BY ordinal_position)
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'assignments'),
	'session_id:uuid:NO,participant_id:uuid:NO,match_id:uuid:NO,created_at:timestamp with time zone:YES',
	'assignments columns, types, and nullability match expectations'
);

SELECT ok(to_regclass('public.gameplay_events') IS NOT NULL, 'gameplay_events table exists');

SELECT is(
	(SELECT string_agg(
		column_name || ':' ||
		(CASE WHEN data_type = 'USER-DEFINED' THEN udt_name ELSE data_type END) || ':' ||
		is_nullable,
		',' ORDER BY ordinal_position)
	 FROM information_schema.columns
	 WHERE table_schema = 'public' AND table_name = 'gameplay_events'),
	'id:uuid:NO,session_id:uuid:NO,sequence_number:bigint:NO,actor_participant_id:uuid:NO,event_type:text:NO,idempotency_key:text:NO,payload:jsonb:NO,created_at:timestamp with time zone:YES',
	'gameplay_events columns, types, and nullability match expectations'
);

SELECT * FROM finish();
ROLLBACK;
