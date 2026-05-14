-- 025_session_ownership_roles.sql
-- Rename session ownership to owner_account_id and add explicit participant roles.

ALTER TABLE public.game_sessions
RENAME COLUMN host_account_id TO owner_account_id;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conrelid = 'public.game_sessions'::regclass
			AND conname = 'game_sessions_host_account_id_fkey'
	) THEN
		ALTER TABLE public.game_sessions
		RENAME CONSTRAINT game_sessions_host_account_id_fkey TO game_sessions_owner_account_id_fkey;
	END IF;
END;
$$;

ALTER INDEX IF EXISTS public.idx_game_sessions_host_account_id
RENAME TO idx_game_sessions_owner_account_id;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_type
		WHERE typname = 'participant_session_role'
	) THEN
		CREATE TYPE public.participant_session_role AS ENUM ('owner', 'member');
	END IF;
END;
$$;

ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS session_role public.participant_session_role;

UPDATE public.participants participants
SET session_role = CASE
		WHEN participants.account_id = game_sessions.owner_account_id THEN 'owner'::public.participant_session_role
		ELSE 'member'::public.participant_session_role
	END
FROM public.game_sessions game_sessions
WHERE game_sessions.id = participants.session_id
	AND participants.session_role IS NULL;

INSERT INTO public.participants (
	session_id,
	account_id,
	display_name,
	membership_type,
	session_role,
	current_drink_total,
	guest_rejoin_token_hash,
	created_at
)
SELECT game_sessions.id,
	game_sessions.owner_account_id,
	COALESCE(accounts.preferred_display_name, 'Session Owner'),
	'registered'::public.participant_membership_type,
	'owner'::public.participant_session_role,
	0,
	NULL,
	COALESCE(game_sessions.created_at, now())
FROM public.game_sessions game_sessions
	JOIN public.accounts accounts ON accounts.id = game_sessions.owner_account_id
	LEFT JOIN public.participants owner_participants ON owner_participants.session_id = game_sessions.id
		AND owner_participants.account_id = game_sessions.owner_account_id
WHERE owner_participants.id IS NULL;

UPDATE public.participants participants
SET session_role = 'owner'::public.participant_session_role
FROM public.game_sessions game_sessions
WHERE game_sessions.id = participants.session_id
	AND participants.account_id = game_sessions.owner_account_id;

UPDATE public.participants
SET session_role = 'member'::public.participant_session_role
WHERE session_role IS NULL;

ALTER TABLE public.participants
ALTER COLUMN session_role SET DEFAULT 'member'::public.participant_session_role,
	ALTER COLUMN session_role SET NOT NULL;

ALTER TABLE public.participants
DROP CONSTRAINT IF EXISTS chk_participants_owner_role_consistency;

ALTER TABLE public.participants
ADD CONSTRAINT chk_participants_owner_role_consistency CHECK (
	session_role <> 'owner'::public.participant_session_role
	OR (
		membership_type = 'registered'::public.participant_membership_type
		AND account_id IS NOT NULL
		AND guest_rejoin_token_hash IS NULL
	)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_participants_session_owner_role ON public.participants (session_id)
WHERE session_role = 'owner'::public.participant_session_role;

CREATE OR REPLACE FUNCTION private.sync_session_owner_participant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
	v_display_name text;
BEGIN
	SELECT accounts.preferred_display_name INTO v_display_name
	FROM public.accounts accounts
	WHERE accounts.id = NEW.owner_account_id;

	UPDATE public.participants
	SET session_role = 'member'::public.participant_session_role
	WHERE session_id = NEW.id
		AND session_role = 'owner'::public.participant_session_role
		AND account_id IS DISTINCT FROM NEW.owner_account_id;

	UPDATE public.participants
	SET display_name = COALESCE(
			NULLIF(public.participants.display_name, ''),
			COALESCE(v_display_name, 'Session Owner')
		),
		membership_type = 'registered'::public.participant_membership_type,
		session_role = 'owner'::public.participant_session_role,
		guest_rejoin_token_hash = NULL
	WHERE session_id = NEW.id
		AND account_id = NEW.owner_account_id;

	IF NOT FOUND THEN
		INSERT INTO public.participants (
			session_id,
			account_id,
			display_name,
			membership_type,
			session_role,
			current_drink_total,
			guest_rejoin_token_hash,
			created_at
		)
		VALUES (
			NEW.id,
			NEW.owner_account_id,
			COALESCE(v_display_name, 'Session Owner'),
			'registered'::public.participant_membership_type,
			'owner'::public.participant_session_role,
			0,
			NULL,
			COALESCE(NEW.created_at, now())
		);
	END IF;

	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_session_owner_participant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
	v_session_id uuid := COALESCE(NEW.session_id, OLD.session_id);
BEGIN
	IF v_session_id IS NULL THEN
		RETURN COALESCE(NEW, OLD);
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.game_sessions game_sessions
		WHERE game_sessions.id = v_session_id
			AND NOT EXISTS (
				SELECT 1
				FROM public.participants participants
				WHERE participants.session_id = game_sessions.id
					AND participants.account_id = game_sessions.owner_account_id
					AND participants.session_role = 'owner'::public.participant_session_role
					AND participants.membership_type = 'registered'::public.participant_membership_type
			)
	) THEN
		RAISE EXCEPTION 'session owner must remain a registered owner participant for session %',
			v_session_id;
	END IF;

	RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_session_owner_participant ON public.game_sessions;

CREATE TRIGGER sync_session_owner_participant
AFTER INSERT OR UPDATE OF owner_account_id ON public.game_sessions FOR EACH ROW
EXECUTE FUNCTION private.sync_session_owner_participant();

DROP TRIGGER IF EXISTS assert_session_owner_participant_on_game_sessions ON public.game_sessions;

CREATE CONSTRAINT TRIGGER assert_session_owner_participant_on_game_sessions
AFTER INSERT OR UPDATE OF owner_account_id ON public.game_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION private.assert_session_owner_participant();

DROP TRIGGER IF EXISTS assert_session_owner_participant_on_participants ON public.participants;

CREATE CONSTRAINT TRIGGER assert_session_owner_participant_on_participants
AFTER INSERT OR UPDATE OR DELETE ON public.participants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION private.assert_session_owner_participant();

CREATE OR REPLACE FUNCTION private.can_access_session(p_session_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
SELECT EXISTS (
		SELECT 1
		FROM public.game_sessions
		WHERE id = p_session_id
			AND owner_account_id = auth.uid()
	)
	OR EXISTS (
		SELECT 1
		FROM public.participants
		WHERE session_id = p_session_id
			AND account_id = auth.uid()
	);
$$;

REVOKE ALL ON FUNCTION private.can_access_session(uuid)
FROM PUBLIC,
	anon;

GRANT EXECUTE ON FUNCTION private.can_access_session(uuid) TO authenticated,
	service_role;

DROP VIEW IF EXISTS public.leaderboard_entries;
DROP VIEW IF EXISTS public.lifetime_player_stats;
DROP FUNCTION IF EXISTS public.compare_session_participants(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.compare_registered_players(uuid, uuid);
DROP VIEW IF EXISTS public.history_overview_totals;
DROP VIEW IF EXISTS public.completed_session_summaries;
DROP VIEW IF EXISTS private._history_participant_session_rollups;
DROP VIEW IF EXISTS private._history_session_rollups;
DROP VIEW IF EXISTS private._history_completed_assignments;
DROP VIEW IF EXISTS private._history_completed_matches;
DROP VIEW IF EXISTS private._history_completed_participants;
DROP VIEW IF EXISTS private._history_completed_sessions;
DROP VIEW IF EXISTS private._history_account_display_names;

CREATE OR REPLACE VIEW private._history_account_display_names AS
SELECT accounts.id AS account_id,
	accounts.preferred_display_name
FROM public.accounts accounts;

CREATE OR REPLACE VIEW private._history_completed_sessions AS
SELECT game_sessions.id AS session_id,
	game_sessions.owner_account_id,
	game_sessions.started_at,
	game_sessions.completed_at,
	game_sessions.common_match_id
FROM public.game_sessions game_sessions
WHERE game_sessions.state = 'completed';

CREATE OR REPLACE VIEW private._history_completed_participants AS
SELECT participants.session_id,
	participants.id AS participant_id,
	participants.account_id,
	participants.display_name,
	participants.membership_type,
	participants.current_drink_total,
	participants.created_at,
	account_names.preferred_display_name AS account_display_name
FROM public.participants participants
	JOIN private._history_completed_sessions completed_sessions ON completed_sessions.session_id = participants.session_id
	LEFT JOIN private._history_account_display_names account_names ON account_names.account_id = participants.account_id;

CREATE OR REPLACE VIEW private._history_completed_matches AS
SELECT matches.session_id,
	matches.id AS match_id,
	matches.source_provider,
	matches.source_match_id,
	matches.home_team_name,
	matches.away_team_name,
	matches.kickoff_at,
	matches.home_score,
	matches.away_score,
	matches.created_at,
	(matches.home_score + matches.away_score) AS total_goals
FROM public.matches matches
	JOIN private._history_completed_sessions completed_sessions ON completed_sessions.session_id = matches.session_id;

CREATE OR REPLACE VIEW private._history_completed_assignments AS
SELECT assignments.session_id,
	assignments.participant_id,
	assignments.match_id,
	assignments.created_at
FROM public.assignments assignments
	JOIN private._history_completed_sessions completed_sessions ON completed_sessions.session_id = assignments.session_id;

CREATE OR REPLACE VIEW private._history_session_rollups AS
SELECT completed_sessions.session_id,
	completed_sessions.owner_account_id,
	completed_sessions.started_at,
	completed_sessions.completed_at,
	completed_sessions.common_match_id,
	COALESCE(participant_counts.session_total_players, 0)::integer AS session_total_players,
	COALESCE(match_counts.session_total_matches, 0)::integer AS session_total_matches,
	COALESCE(match_counts.session_total_goals, 0)::integer AS session_total_goals,
	COALESCE(participant_counts.session_total_drinks, 0)::numeric AS session_total_drinks,
	CASE
		WHEN COALESCE(participant_counts.session_total_players, 0) > 0 THEN COALESCE(match_counts.session_total_matches, 0)::numeric / participant_counts.session_total_players
		ELSE 0
	END AS matches_per_player
FROM private._history_completed_sessions completed_sessions
	LEFT JOIN LATERAL (
		SELECT count(*)::integer AS session_total_players,
			COALESCE(sum(participants.current_drink_total), 0)::numeric AS session_total_drinks
		FROM private._history_completed_participants participants
		WHERE participants.session_id = completed_sessions.session_id
	) participant_counts ON TRUE
	LEFT JOIN LATERAL (
		SELECT count(*)::integer AS session_total_matches,
			COALESCE(sum(matches.total_goals), 0)::integer AS session_total_goals
		FROM private._history_completed_matches matches
		WHERE matches.session_id = completed_sessions.session_id
	) match_counts ON TRUE;

CREATE OR REPLACE VIEW private._history_participant_session_rollups AS
SELECT participants.session_id,
	participants.participant_id,
	participants.account_id,
	participants.display_name,
	participants.account_display_name,
	participants.membership_type,
	participants.current_drink_total,
	participants.created_at,
	completed_sessions.completed_at,
	completed_sessions.common_match_id,
	COALESCE(match_counts.session_match_count, 0)::integer AS session_match_count,
	COALESCE(participant_counts.session_participant_count, 0)::integer AS session_participant_count,
	COALESCE(session_max.session_max_drinks, 0)::numeric AS session_max_drinks,
	CASE
		WHEN participants.current_drink_total = COALESCE(session_max.session_max_drinks, 0) THEN TRUE
		ELSE FALSE
	END AS is_top_drinker
FROM private._history_completed_participants participants
	JOIN private._history_completed_sessions completed_sessions ON completed_sessions.session_id = participants.session_id
	LEFT JOIN LATERAL (
		SELECT count(*)::integer AS session_match_count
		FROM private._history_completed_matches matches
		WHERE matches.session_id = participants.session_id
	) match_counts ON TRUE
	LEFT JOIN LATERAL (
		SELECT count(*)::integer AS session_participant_count
		FROM private._history_completed_participants other_participants
		WHERE other_participants.session_id = participants.session_id
	) participant_counts ON TRUE
	LEFT JOIN LATERAL (
		SELECT max(other_participants.current_drink_total)::numeric AS session_max_drinks
		FROM private._history_completed_participants other_participants
		WHERE other_participants.session_id = participants.session_id
	) session_max ON TRUE;

REVOKE ALL ON TABLE private._history_account_display_names
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE private._history_account_display_names TO authenticated,
	service_role;

REVOKE ALL ON TABLE private._history_completed_sessions
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE private._history_completed_sessions TO authenticated,
	service_role;

REVOKE ALL ON TABLE private._history_completed_participants
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE private._history_completed_participants TO authenticated,
	service_role;

REVOKE ALL ON TABLE private._history_completed_matches
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE private._history_completed_matches TO authenticated,
	service_role;

REVOKE ALL ON TABLE private._history_completed_assignments
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE private._history_completed_assignments TO authenticated,
	service_role;

REVOKE ALL ON TABLE private._history_session_rollups
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE private._history_session_rollups TO authenticated,
	service_role;

REVOKE ALL ON TABLE private._history_participant_session_rollups
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE private._history_participant_session_rollups TO authenticated,
	service_role;

CREATE OR REPLACE VIEW public.completed_session_summaries WITH (security_invoker = true) AS
SELECT session_rollups.session_id,
	session_rollups.owner_account_id,
	session_rollups.completed_at,
	session_rollups.started_at,
	session_rollups.common_match_id,
	session_rollups.session_total_players,
	session_rollups.session_total_matches,
	session_rollups.session_total_goals,
	session_rollups.session_total_drinks,
	session_rollups.matches_per_player,
	COALESCE(players.players, '[]'::jsonb) AS players,
	COALESCE(matches.matches, '[]'::jsonb) AS matches,
	COALESCE(assignments.player_assignments, '{}'::jsonb) AS player_assignments
FROM private._history_session_rollups session_rollups
	LEFT JOIN LATERAL (
		SELECT COALESCE(
				jsonb_agg(
					jsonb_build_object(
						'id',
						participants.participant_id,
						'accountId',
						participants.account_id,
						'name',
						participants.display_name,
						'drinksTaken',
						participants.current_drink_total,
						'membershipType',
						participants.membership_type
					)
					ORDER BY participants.created_at,
						participants.participant_id
				),
				'[]'::jsonb
			) AS players
		FROM private._history_completed_participants participants
		WHERE participants.session_id = session_rollups.session_id
	) players ON TRUE
	LEFT JOIN LATERAL (
		SELECT COALESCE(
				jsonb_agg(
					jsonb_build_object(
						'id',
						matches.match_id,
						'sourceProvider',
						matches.source_provider,
						'sourceMatchId',
						matches.source_match_id,
						'homeTeam',
						matches.home_team_name,
						'awayTeam',
						matches.away_team_name,
						'kickoffAt',
						matches.kickoff_at,
						'homeGoals',
						matches.home_score,
						'awayGoals',
						matches.away_score,
						'goals',
						matches.total_goals
					)
					ORDER BY matches.created_at,
						matches.match_id
				),
				'[]'::jsonb
			) AS matches
		FROM private._history_completed_matches matches
		WHERE matches.session_id = session_rollups.session_id
	) matches ON TRUE
	LEFT JOIN LATERAL (
		SELECT COALESCE(
				jsonb_object_agg(
					assignment_groups.participant_id::text,
					assignment_groups.match_ids
				),
				'{}'::jsonb
			) AS player_assignments
		FROM (
				SELECT assignments.participant_id,
					jsonb_agg(
						assignments.match_id::text
						ORDER BY assignments.match_id
					) AS match_ids
				FROM private._history_completed_assignments assignments
				WHERE assignments.session_id = session_rollups.session_id
				GROUP BY assignments.participant_id
			) assignment_groups
	) assignments ON TRUE
ORDER BY session_rollups.completed_at DESC,
	session_rollups.session_id DESC;

REVOKE ALL ON TABLE public.completed_session_summaries
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE public.completed_session_summaries TO authenticated,
	service_role;

CREATE OR REPLACE VIEW public.history_overview_totals WITH (security_invoker = true) AS
SELECT COALESCE(count(*), 0)::integer AS total_sessions,
	COALESCE(sum(session_total_players), 0)::integer AS total_participations,
	COALESCE(sum(session_total_matches), 0)::integer AS total_matches,
	COALESCE(sum(session_total_goals), 0)::integer AS total_goals,
	COALESCE(sum(session_total_drinks), 0)::numeric AS total_drinks,
	CASE
		WHEN COALESCE(sum(session_total_players), 0) > 0 THEN COALESCE(sum(session_total_drinks), 0)::numeric / sum(session_total_players)
		ELSE 0
	END AS average_drinks_per_participation
FROM public.completed_session_summaries;

REVOKE ALL ON TABLE public.history_overview_totals
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE public.history_overview_totals TO authenticated,
	service_role;

CREATE OR REPLACE VIEW public.lifetime_player_stats WITH (security_invoker = true) AS
SELECT participants.account_id,
	COALESCE(
		MAX(participants.account_display_name),
		MAX(participants.display_name)
	) AS display_name,
	count(DISTINCT participants.session_id)::integer AS games_played,
	COALESCE(sum(participants.current_drink_total), 0)::numeric AS total_drinks,
	CASE
		WHEN count(DISTINCT participants.session_id) > 0 THEN COALESCE(sum(participants.current_drink_total), 0)::numeric / count(DISTINCT participants.session_id)
		ELSE 0
	END AS average_per_game
FROM private._history_participant_session_rollups participants
WHERE participants.account_id IS NOT NULL
GROUP BY participants.account_id
ORDER BY total_drinks DESC,
	average_per_game DESC,
	account_id ASC;

REVOKE ALL ON TABLE public.lifetime_player_stats
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE public.lifetime_player_stats TO authenticated,
	service_role;

CREATE OR REPLACE FUNCTION public.compare_registered_players(
	left_account_id uuid,
	right_account_id uuid
) RETURNS TABLE (
	player1_id uuid,
	player2_id uuid,
	player1_name text,
	player2_name text,
	player1_games_played integer,
	player2_games_played integer,
	player1_total_drinks numeric,
	player2_total_drinks numeric,
	player1_average_per_game numeric,
	player2_average_per_game numeric,
	games_played_together integer,
	player1_wins_count integer,
	player2_wins_count integer,
	tied_games_count integer,
	player1_max_in_a_game numeric,
	player2_max_in_a_game numeric,
	player1_common_match_count integer,
	player2_common_match_count integer,
	player1_efficiency numeric,
	player2_efficiency numeric,
	player1_top_drinker_count integer,
	player2_top_drinker_count integer,
	player1_avg_with_player2 numeric,
	player1_avg_without_player2 numeric,
	player2_avg_with_player1 numeric,
	player2_avg_without_player1 numeric,
	timeline_data jsonb
) LANGUAGE sql STABLE AS $$
WITH left_games AS (
		SELECT participants.session_id,
			participants.completed_at,
			participants.current_drink_total,
			participants.common_match_id,
			participants.session_match_count,
			participants.is_top_drinker
		FROM private._history_participant_session_rollups participants
		WHERE participants.account_id = left_account_id
	),
	right_games AS (
		SELECT participants.session_id,
			participants.completed_at,
			participants.current_drink_total,
			participants.common_match_id,
			participants.session_match_count,
			participants.is_top_drinker
		FROM private._history_participant_session_rollups participants
		WHERE participants.account_id = right_account_id
	),
	shared_games AS (
		SELECT left_games.session_id,
			left_games.completed_at,
			left_games.current_drink_total AS player1_drinks,
			right_games.current_drink_total AS player2_drinks
		FROM left_games
			INNER JOIN right_games USING (session_id)
	),
	left_without_games AS (
		SELECT left_games.*
		FROM left_games
			LEFT JOIN shared_games USING (session_id)
		WHERE shared_games.session_id IS NULL
	),
	right_without_games AS (
		SELECT right_games.*
		FROM right_games
			LEFT JOIN shared_games USING (session_id)
		WHERE shared_games.session_id IS NULL
	),
	left_totals AS (
		SELECT count(*)::integer AS games_played,
			COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
			COALESCE(sum(session_match_count), 0)::integer AS total_matches,
			COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
			COALESCE(
				count(*) FILTER (
					WHERE common_match_id IS NOT NULL
				),
				0
			)::integer AS common_match_count,
			COALESCE(
				count(*) FILTER (
					WHERE is_top_drinker
				),
				0
			)::integer AS top_drinker_count
		FROM left_games
	),
	right_totals AS (
		SELECT count(*)::integer AS games_played,
			COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
			COALESCE(sum(session_match_count), 0)::integer AS total_matches,
			COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
			COALESCE(
				count(*) FILTER (
					WHERE common_match_id IS NOT NULL
				),
				0
			)::integer AS common_match_count,
			COALESCE(
				count(*) FILTER (
					WHERE is_top_drinker
				),
				0
			)::integer AS top_drinker_count
		FROM right_games
	)
SELECT left_account_id AS player1_id,
	right_account_id AS player2_id,
	COALESCE(
		(
			SELECT preferred_display_name
			FROM private._history_account_display_names
			WHERE account_id = left_account_id
		),
		left_account_id::text
	) AS player1_name,
	COALESCE(
		(
			SELECT preferred_display_name
			FROM private._history_account_display_names
			WHERE account_id = right_account_id
		),
		right_account_id::text
	) AS player2_name,
	left_totals.games_played AS player1_games_played,
	right_totals.games_played AS player2_games_played,
	left_totals.total_drinks AS player1_total_drinks,
	right_totals.total_drinks AS player2_total_drinks,
	CASE
		WHEN left_totals.games_played > 0 THEN left_totals.total_drinks / left_totals.games_played
		ELSE 0
	END AS player1_average_per_game,
	CASE
		WHEN right_totals.games_played > 0 THEN right_totals.total_drinks / right_totals.games_played
		ELSE 0
	END AS player2_average_per_game,
	COALESCE(
		(
			SELECT count(*)::integer
			FROM shared_games
		),
		0
	) AS games_played_together,
	COALESCE(
		(
			SELECT count(*)::integer
			FROM shared_games
			WHERE player1_drinks > player2_drinks
		),
		0
	) AS player1_wins_count,
	COALESCE(
		(
			SELECT count(*)::integer
			FROM shared_games
			WHERE player2_drinks > player1_drinks
		),
		0
	) AS player2_wins_count,
	COALESCE(
		(
			SELECT count(*)::integer
			FROM shared_games
			WHERE player1_drinks = player2_drinks
		),
		0
	) AS tied_games_count,
	left_totals.max_in_a_game AS player1_max_in_a_game,
	right_totals.max_in_a_game AS player2_max_in_a_game,
	left_totals.common_match_count AS player1_common_match_count,
	right_totals.common_match_count AS player2_common_match_count,
	CASE
		WHEN left_totals.total_matches > 0 THEN left_totals.total_drinks / left_totals.total_matches
		ELSE 0
	END AS player1_efficiency,
	CASE
		WHEN right_totals.total_matches > 0 THEN right_totals.total_drinks / right_totals.total_matches
		ELSE 0
	END AS player2_efficiency,
	left_totals.top_drinker_count AS player1_top_drinker_count,
	right_totals.top_drinker_count AS player2_top_drinker_count,
	COALESCE(
		(
			SELECT CASE
					WHEN count(*) > 0 THEN sum(player1_drinks) / count(*)
					ELSE 0
				END
			FROM shared_games
		),
		0
	) AS player1_avg_with_player2,
	COALESCE(
		(
			SELECT CASE
					WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
					ELSE 0
				END
			FROM left_without_games
		),
		0
	) AS player1_avg_without_player2,
	COALESCE(
		(
			SELECT CASE
					WHEN count(*) > 0 THEN sum(player2_drinks) / count(*)
					ELSE 0
				END
			FROM shared_games
		),
		0
	) AS player2_avg_with_player1,
	COALESCE(
		(
			SELECT CASE
					WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
					ELSE 0
				END
			FROM right_without_games
		),
		0
	) AS player2_avg_without_player1,
	COALESCE(
		(
			SELECT jsonb_agg(
					jsonb_build_object(
						'date',
						completed_at::text,
						'player1Drinks',
						player1_drinks,
						'player2Drinks',
						player2_drinks
					)
					ORDER BY completed_at,
						session_id
				)
			FROM shared_games
		),
		'[]'::jsonb
	) AS timeline_data
FROM left_totals,
	right_totals;
$$;

REVOKE ALL ON FUNCTION public.compare_registered_players(uuid, uuid)
FROM PUBLIC,
	anon,
	authenticated;

GRANT EXECUTE ON FUNCTION public.compare_registered_players(uuid, uuid) TO authenticated,
	service_role;

CREATE OR REPLACE FUNCTION public.compare_session_participants(
	p_session_id uuid,
	p_left_participant_id uuid,
	p_right_participant_id uuid
) RETURNS TABLE (
	player1_id uuid,
	player2_id uuid,
	player1_name text,
	player2_name text,
	player1_games_played integer,
	player2_games_played integer,
	player1_total_drinks numeric,
	player2_total_drinks numeric,
	player1_average_per_game numeric,
	player2_average_per_game numeric,
	games_played_together integer,
	player1_wins_count integer,
	player2_wins_count integer,
	tied_games_count integer,
	player1_max_in_a_game numeric,
	player2_max_in_a_game numeric,
	player1_common_match_count integer,
	player2_common_match_count integer,
	player1_efficiency numeric,
	player2_efficiency numeric,
	player1_top_drinker_count integer,
	player2_top_drinker_count integer,
	player1_avg_with_player2 numeric,
	player1_avg_without_player2 numeric,
	player2_avg_with_player1 numeric,
	player2_avg_without_player1 numeric,
	timeline_data jsonb
) LANGUAGE plpgsql STABLE AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM private._history_participant_session_rollups participants
		WHERE participants.session_id = p_session_id
			AND participants.participant_id = p_left_participant_id
	)
		OR NOT EXISTS (
			SELECT 1
			FROM private._history_participant_session_rollups participants
			WHERE participants.session_id = p_session_id
				AND participants.participant_id = p_right_participant_id
		) THEN
		RAISE EXCEPTION 'participants must belong to the same completed session %',
			p_session_id;
	END IF;

	RETURN QUERY
	WITH left_games AS (
			SELECT participants.session_id,
				participants.completed_at,
				participants.current_drink_total,
				participants.common_match_id,
				participants.session_match_count,
				participants.is_top_drinker,
				participants.display_name
			FROM private._history_participant_session_rollups participants
			WHERE participants.session_id = p_session_id
				AND participants.participant_id = p_left_participant_id
		),
		right_games AS (
			SELECT participants.session_id,
				participants.completed_at,
				participants.current_drink_total,
				participants.common_match_id,
				participants.session_match_count,
				participants.is_top_drinker,
				participants.display_name
			FROM private._history_participant_session_rollups participants
			WHERE participants.session_id = p_session_id
				AND participants.participant_id = p_right_participant_id
		),
		shared_games AS (
			SELECT left_games.session_id,
				left_games.completed_at,
				left_games.current_drink_total AS player1_drinks,
				right_games.current_drink_total AS player2_drinks
			FROM left_games
				INNER JOIN right_games USING (session_id)
		),
		left_without_games AS (
			SELECT left_games.*
			FROM left_games
				LEFT JOIN shared_games USING (session_id)
			WHERE shared_games.session_id IS NULL
		),
		right_without_games AS (
			SELECT right_games.*
			FROM right_games
				LEFT JOIN shared_games USING (session_id)
			WHERE shared_games.session_id IS NULL
		),
		left_totals AS (
			SELECT count(*)::integer AS games_played,
				COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
				COALESCE(sum(session_match_count), 0)::integer AS total_matches,
				COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
				COALESCE(
					count(*) FILTER (
						WHERE common_match_id IS NOT NULL
					),
					0
				)::integer AS common_match_count,
				COALESCE(
					count(*) FILTER (
						WHERE is_top_drinker
					),
					0
				)::integer AS top_drinker_count
			FROM left_games
		),
		right_totals AS (
			SELECT count(*)::integer AS games_played,
				COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
				COALESCE(sum(session_match_count), 0)::integer AS total_matches,
				COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
				COALESCE(
					count(*) FILTER (
						WHERE common_match_id IS NOT NULL
					),
					0
				)::integer AS common_match_count,
				COALESCE(
					count(*) FILTER (
						WHERE is_top_drinker
					),
					0
				)::integer AS top_drinker_count
			FROM right_games
		)
	SELECT p_left_participant_id AS player1_id,
		p_right_participant_id AS player2_id,
		(
			SELECT display_name
			FROM left_games
			LIMIT 1
		) AS player1_name,
		(
			SELECT display_name
			FROM right_games
			LIMIT 1
		) AS player2_name,
		left_totals.games_played AS player1_games_played,
		right_totals.games_played AS player2_games_played,
		left_totals.total_drinks AS player1_total_drinks,
		right_totals.total_drinks AS player2_total_drinks,
		CASE
			WHEN left_totals.games_played > 0 THEN left_totals.total_drinks / left_totals.games_played
			ELSE 0
		END AS player1_average_per_game,
		CASE
			WHEN right_totals.games_played > 0 THEN right_totals.total_drinks / right_totals.games_played
			ELSE 0
		END AS player2_average_per_game,
		COALESCE(
			(
				SELECT count(*)::integer
				FROM shared_games
			),
			0
		) AS games_played_together,
		COALESCE(
			(
				SELECT count(*)::integer
				FROM shared_games
				WHERE player1_drinks > player2_drinks
			),
			0
		) AS player1_wins_count,
		COALESCE(
			(
				SELECT count(*)::integer
				FROM shared_games
				WHERE player2_drinks > player1_drinks
			),
			0
		) AS player2_wins_count,
		COALESCE(
			(
				SELECT count(*)::integer
				FROM shared_games
				WHERE player1_drinks = player2_drinks
			),
			0
		) AS tied_games_count,
		left_totals.max_in_a_game AS player1_max_in_a_game,
		right_totals.max_in_a_game AS player2_max_in_a_game,
		left_totals.common_match_count AS player1_common_match_count,
		right_totals.common_match_count AS player2_common_match_count,
		CASE
			WHEN left_totals.total_matches > 0 THEN left_totals.total_drinks / left_totals.total_matches
			ELSE 0
		END AS player1_efficiency,
		CASE
			WHEN right_totals.total_matches > 0 THEN right_totals.total_drinks / right_totals.total_matches
			ELSE 0
		END AS player2_efficiency,
		left_totals.top_drinker_count AS player1_top_drinker_count,
		right_totals.top_drinker_count AS player2_top_drinker_count,
		COALESCE(
			(
				SELECT CASE
						WHEN count(*) > 0 THEN sum(player1_drinks) / count(*)
						ELSE 0
					END
				FROM shared_games
			),
			0
		) AS player1_avg_with_player2,
		COALESCE(
			(
				SELECT CASE
						WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
						ELSE 0
					END
				FROM left_without_games
			),
			0
		) AS player1_avg_without_player2,
		COALESCE(
			(
				SELECT CASE
						WHEN count(*) > 0 THEN sum(player2_drinks) / count(*)
						ELSE 0
					END
				FROM shared_games
			),
			0
		) AS player2_avg_with_player1,
		COALESCE(
			(
				SELECT CASE
						WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
						ELSE 0
					END
				FROM right_without_games
			),
			0
		) AS player2_avg_without_player1,
		COALESCE(
			(
				SELECT jsonb_agg(
						jsonb_build_object(
							'date',
							completed_at::text,
							'player1Drinks',
							player1_drinks,
							'player2Drinks',
							player2_drinks
						)
						ORDER BY completed_at,
							session_id
					)
				FROM shared_games
			),
			'[]'::jsonb
		) AS timeline_data
	FROM left_totals,
		right_totals;
END;
$$;

REVOKE ALL ON FUNCTION public.compare_session_participants(uuid, uuid, uuid)
FROM PUBLIC,
	anon,
	authenticated;

GRANT EXECUTE ON FUNCTION public.compare_session_participants(uuid, uuid, uuid) TO authenticated,
	service_role;

CREATE OR REPLACE VIEW public.leaderboard_entries WITH (security_invoker = true) AS
SELECT row_number() OVER (
		ORDER BY lifetime_stats.total_drinks DESC,
			lifetime_stats.average_per_game DESC,
			lifetime_stats.account_id ASC
	)::integer AS rank,
	lifetime_stats.account_id,
	lifetime_stats.display_name,
	lifetime_stats.total_drinks,
	lifetime_stats.games_played,
	lifetime_stats.average_per_game
FROM public.lifetime_player_stats lifetime_stats
ORDER BY lifetime_stats.total_drinks DESC,
	lifetime_stats.average_per_game DESC,
	lifetime_stats.account_id ASC;

REVOKE ALL ON TABLE public.leaderboard_entries
FROM PUBLIC,
	anon,
	authenticated;

GRANT SELECT ON TABLE public.leaderboard_entries TO authenticated,
	service_role;

CREATE OR REPLACE FUNCTION private.import_legacy_history(
	p_claimed_local_participant_id text,
	p_sessions jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
	v_account_id uuid := auth.uid();
	v_import_state private.legacy_history_import_state %ROWTYPE;
	v_existing_session private.legacy_history_import_sessions %ROWTYPE;
	v_session jsonb;
	v_player jsonb;
	v_match jsonb;
	v_claimed_name text;
	v_session_claimed_local_participant_id text;
	v_session_claimed_name text;
	v_session_local_id text;
	v_source_fingerprint text;
	v_session_saved_at timestamptz;
	v_cloud_session_id uuid;
	v_participant_id uuid;
	v_claimed_participant_id uuid;
	v_match_id uuid;
	v_common_match_id uuid;
	v_participant_map jsonb;
	v_match_map jsonb;
	v_assignment_key text;
	v_assignment_value jsonb;
	v_local_match_id text;
	v_results jsonb := '[]'::jsonb;
	v_imported_count integer := 0;
	v_skipped_count integer := 0;
	v_failed_count integer := 0;
	v_any_failure boolean := FALSE;
	v_last_error text;
BEGIN
	IF v_account_id IS NULL THEN
		RAISE EXCEPTION 'authenticated account required';
	END IF;

	IF jsonb_typeof(COALESCE(p_sessions, '[]'::jsonb)) <> 'array' THEN
		RAISE EXCEPTION 'sessions payload must be a JSON array';
	END IF;

	PERFORM 1
	FROM public.accounts
	WHERE id = v_account_id;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'account not found for authenticated user %',
			v_account_id;
	END IF;

	SELECT player_entry->>'name' INTO v_claimed_name
	FROM jsonb_array_elements(COALESCE(p_sessions, '[]'::jsonb)) AS session_entry,
		LATERAL jsonb_array_elements(
			COALESCE(session_entry->'players', '[]'::jsonb)
		) AS player_entry
	WHERE player_entry->>'id' = p_claimed_local_participant_id
	LIMIT 1;

	IF v_claimed_name IS NULL THEN
		RAISE EXCEPTION 'claimed local participant % not found in submitted sessions',
			p_claimed_local_participant_id;
	END IF;

	SELECT * INTO v_import_state
	FROM private.legacy_history_import_state
	WHERE account_id = v_account_id FOR
	UPDATE;

	IF FOUND THEN
		IF v_import_state.claimed_local_participant_name <> v_claimed_name THEN
			RETURN jsonb_build_object(
				'accountId',
				v_account_id::text,
				'importState',
				'failed',
				'claimedLocalParticipantId',
				v_import_state.claimed_local_participant_id,
				'summary',
				jsonb_build_object(
					'importedCount',
					0,
					'skippedCount',
					0,
					'failedCount',
					1
				),
				'sessions',
				jsonb_build_array(
					jsonb_build_object(
						'sourceLocalSessionId',
						NULL,
						'sourceFingerprint',
						NULL,
						'state',
						'conflict',
						'errorMessage',
						'Claimed local participant name does not match the existing import state.'
					)
				)
			);
		END IF;

		IF v_import_state.state = 'completed' THEN
			RETURN jsonb_build_object(
				'accountId',
				v_account_id::text,
				'importState',
				'completed',
				'claimedLocalParticipantId',
				v_import_state.claimed_local_participant_id,
				'summary',
				jsonb_build_object(
					'importedCount',
					0,
					'skippedCount',
					0,
					'failedCount',
					0
				),
				'sessions',
				'[]'::jsonb
			);
		END IF;

		UPDATE private.legacy_history_import_state
		SET claimed_local_participant_name = v_claimed_name,
			state = 'in_progress',
			failed_at = NULL,
			last_error = NULL,
			updated_at = now()
		WHERE account_id = v_account_id;
	ELSE
		INSERT INTO private.legacy_history_import_state (
			account_id,
			claimed_local_participant_id,
			claimed_local_participant_name,
			state,
			started_at,
			created_at,
			updated_at
		)
		VALUES (
			v_account_id,
			p_claimed_local_participant_id,
			v_claimed_name,
			'in_progress',
			now(),
			now(),
			now()
		);
	END IF;

	FOR v_session IN
	SELECT value
	FROM jsonb_array_elements(COALESCE(p_sessions, '[]'::jsonb)) LOOP
		v_session_local_id := COALESCE(v_session->>'sourceLocalSessionId', '');
		v_session_claimed_local_participant_id := COALESCE(
			NULLIF(v_session->>'claimedLocalParticipantId', ''),
			p_claimed_local_participant_id
		);

		SELECT player_entry->>'name' INTO v_session_claimed_name
		FROM jsonb_array_elements(COALESCE(v_session->'players', '[]'::jsonb)) AS player_entry
		WHERE player_entry->>'id' = v_session_claimed_local_participant_id
		LIMIT 1;

		v_source_fingerprint := private.compute_legacy_history_fingerprint(v_session);

		SELECT * INTO v_existing_session
		FROM private.legacy_history_import_sessions
		WHERE account_id = v_account_id
			AND source_fingerprint = v_source_fingerprint FOR
		UPDATE;

		IF FOUND
			AND v_existing_session.claimed_local_participant_id <> v_session_claimed_local_participant_id THEN
			UPDATE private.legacy_history_import_sessions
			SET state = 'conflict',
				error_message = 'Claimed local participant does not match the existing imported fingerprint.',
				updated_at = now()
			WHERE account_id = v_account_id
				AND source_fingerprint = v_source_fingerprint;

			v_results := v_results || jsonb_build_array(
				jsonb_build_object(
					'sourceLocalSessionId',
					v_session_local_id,
					'sourceFingerprint',
					v_source_fingerprint,
					'state',
					'conflict',
					'errorMessage',
					'Claimed local participant does not match the existing imported fingerprint.'
				)
			);
			v_failed_count := v_failed_count + 1;
			v_any_failure := TRUE;
			CONTINUE;
		END IF;

		IF FOUND
			AND v_existing_session.state = 'imported'
			AND v_existing_session.cloud_session_id IS NOT NULL THEN
			v_results := v_results || jsonb_build_array(
				jsonb_build_object(
					'sourceLocalSessionId',
					v_existing_session.source_local_session_id,
					'sourceFingerprint',
					v_source_fingerprint,
					'state',
					'skipped',
					'cloudSessionId',
					v_existing_session.cloud_session_id::text
				)
			);
			v_skipped_count := v_skipped_count + 1;
			CONTINUE;
		END IF;

		INSERT INTO private.legacy_history_import_sessions (
			account_id,
			source_fingerprint,
			source_local_session_id,
			claimed_local_participant_id,
			state,
			error_message,
			created_at,
			updated_at
		)
		VALUES (
			v_account_id,
			v_source_fingerprint,
			v_session_local_id,
			v_session_claimed_local_participant_id,
			'pending',
			NULL,
			now(),
			now()
		) ON CONFLICT (account_id, source_fingerprint) DO
		UPDATE
		SET source_local_session_id = EXCLUDED.source_local_session_id,
			claimed_local_participant_id = EXCLUDED.claimed_local_participant_id,
			state = 'pending',
			error_message = NULL,
			updated_at = now();

		BEGIN
			IF v_session_claimed_name IS NULL THEN
				RAISE EXCEPTION 'claimed participant % is missing from source session %',
					v_session_claimed_local_participant_id,
					v_session_local_id;
			END IF;

			IF v_session_claimed_name <> v_claimed_name THEN
				RAISE EXCEPTION 'claimed participant name % does not match selected claimant name % for source session %',
					v_session_claimed_name,
					v_claimed_name,
					v_session_local_id;
			END IF;

			v_session_saved_at := COALESCE(
				private.try_parse_timestamptz(v_session->>'savedAt'),
				now()
			);
			v_participant_map := '{}'::jsonb;
			v_match_map := '{}'::jsonb;
			v_claimed_participant_id := NULL;
			v_common_match_id := NULL;

			INSERT INTO public.game_sessions (
				owner_account_id,
				join_code,
				state,
				created_at,
				started_at,
				completed_at
			)
			VALUES (
				v_account_id,
				format(
					'IMP-%s-%s',
					left(v_source_fingerprint, 12),
					replace(extensions.gen_random_uuid()::text, '-', '')
				),
				'in_progress',
				v_session_saved_at,
				v_session_saved_at,
				NULL
			)
			RETURNING id INTO v_cloud_session_id;

			FOR v_player IN
			SELECT value
			FROM jsonb_array_elements(COALESCE(v_session->'players', '[]'::jsonb)) LOOP
				IF v_player->>'id' = v_session_claimed_local_participant_id THEN
					UPDATE public.participants
					SET display_name = COALESCE(v_player->>'name', public.participants.display_name),
						current_drink_total = COALESCE((v_player->>'drinksTaken')::numeric, 0),
						created_at = v_session_saved_at,
						membership_type = 'registered'::public.participant_membership_type,
						session_role = 'owner'::public.participant_session_role,
						guest_rejoin_token_hash = NULL
					WHERE session_id = v_cloud_session_id
						AND account_id = v_account_id
					RETURNING id INTO v_participant_id;

					IF v_participant_id IS NULL THEN
						INSERT INTO public.participants (
							session_id,
							account_id,
							display_name,
							membership_type,
							session_role,
							current_drink_total,
							guest_rejoin_token_hash,
							created_at
						)
						VALUES (
							v_cloud_session_id,
							v_account_id,
							COALESCE(v_player->>'name', 'Unknown Player'),
							'registered'::public.participant_membership_type,
							'owner'::public.participant_session_role,
							COALESCE((v_player->>'drinksTaken')::numeric, 0),
							NULL,
							v_session_saved_at
						)
						RETURNING id INTO v_participant_id;
					END IF;
				ELSE
					INSERT INTO public.participants (
						session_id,
						account_id,
						display_name,
						membership_type,
						session_role,
						current_drink_total,
						guest_rejoin_token_hash,
						created_at
					)
					VALUES (
						v_cloud_session_id,
						NULL,
						COALESCE(v_player->>'name', 'Unknown Player'),
						'guest'::public.participant_membership_type,
						'member'::public.participant_session_role,
						COALESCE((v_player->>'drinksTaken')::numeric, 0),
						encode(
							extensions.digest(
								concat(
									v_session_local_id,
									':',
									COALESCE(v_player->>'id', ''),
									':guest'
								),
								'sha256'
							),
							'hex'
						),
						v_session_saved_at
					)
					RETURNING id INTO v_participant_id;
				END IF;

				v_participant_map := v_participant_map || jsonb_build_object(
					v_player->>'id',
					v_participant_id::text
				);

				IF v_player->>'id' = v_session_claimed_local_participant_id THEN
					v_claimed_participant_id := v_participant_id;
				END IF;
			END LOOP;

			IF v_claimed_participant_id IS NULL THEN
				RAISE EXCEPTION 'claimed participant % could not be created for source session %',
					v_session_claimed_local_participant_id,
					v_session_local_id;
			END IF;

			INSERT INTO public.gameplay_events (
				session_id,
				sequence_number,
				actor_participant_id,
				event_type,
				idempotency_key,
				payload,
				created_at
			)
			VALUES (
				v_cloud_session_id,
				public.allocate_event_sequence(v_cloud_session_id),
				v_claimed_participant_id,
				'session_created',
				'legacy-import:session-created',
				jsonb_build_object(
					'sourceLocalSessionId',
					v_session_local_id,
					'sourceFingerprint',
					v_source_fingerprint,
					'imported',
					TRUE
				),
				v_session_saved_at
			);

			FOR v_player IN
			SELECT value
			FROM jsonb_array_elements(COALESCE(v_session->'players', '[]'::jsonb)) LOOP
				INSERT INTO public.gameplay_events (
					session_id,
					sequence_number,
					actor_participant_id,
					event_type,
					idempotency_key,
					payload,
					created_at
				)
				VALUES (
					v_cloud_session_id,
					public.allocate_event_sequence(v_cloud_session_id),
					COALESCE(
						(v_participant_map->>(v_player->>'id'))::uuid,
						v_claimed_participant_id
					),
					'participant_joined',
					concat('legacy-import:participant:', v_player->>'id'),
					jsonb_build_object(
						'localParticipantId',
						v_player->>'id',
						'displayName',
						COALESCE(v_player->>'name', 'Unknown Player'),
						'membershipType',
						CASE
							WHEN v_player->>'id' = v_session_claimed_local_participant_id THEN 'registered'
							ELSE 'guest'
						END,
						'currentDrinkTotal',
						COALESCE((v_player->>'drinksTaken')::numeric, 0)
					),
					v_session_saved_at
				);
			END LOOP;

			FOR v_match IN
			SELECT value
			FROM jsonb_array_elements(COALESCE(v_session->'matches', '[]'::jsonb)) LOOP
				INSERT INTO public.matches (
					session_id,
					source_provider,
					source_match_id,
					home_team_name,
					away_team_name,
					kickoff_at,
					home_score,
					away_score,
					created_at
				)
				VALUES (
					v_cloud_session_id,
					'legacy_import',
					NULLIF(v_match->>'id', ''),
					COALESCE(v_match->>'homeTeam', 'Unknown Home Team'),
					COALESCE(v_match->>'awayTeam', 'Unknown Away Team'),
					private.try_parse_timestamptz(v_match->>'startTime'),
					COALESCE((v_match->>'homeGoals')::integer, 0),
					COALESCE((v_match->>'awayGoals')::integer, 0),
					v_session_saved_at
				)
				RETURNING id INTO v_match_id;

				v_match_map := v_match_map || jsonb_build_object(
					v_match->>'id',
					v_match_id::text
				);

				INSERT INTO public.gameplay_events (
					session_id,
					sequence_number,
					actor_participant_id,
					event_type,
					idempotency_key,
					payload,
					created_at
				)
				VALUES (
					v_cloud_session_id,
					public.allocate_event_sequence(v_cloud_session_id),
					v_claimed_participant_id,
					'match_added',
					concat('legacy-import:match:', v_match->>'id'),
					jsonb_build_object(
						'localMatchId',
						v_match->>'id',
						'homeTeam',
						COALESCE(v_match->>'homeTeam', 'Unknown Home Team'),
						'awayTeam',
						COALESCE(v_match->>'awayTeam', 'Unknown Away Team'),
						'homeGoals',
						COALESCE((v_match->>'homeGoals')::integer, 0),
						'awayGoals',
						COALESCE((v_match->>'awayGoals')::integer, 0),
						'startTime',
						v_match->>'startTime'
					),
					v_session_saved_at
				);
			END LOOP;

			FOR v_assignment_key,
			v_assignment_value IN
			SELECT key,
				value
			FROM jsonb_each(
					COALESCE(v_session->'playerAssignments', '{}'::jsonb)
				) LOOP
				FOR v_local_match_id IN
				SELECT value
				FROM jsonb_array_elements_text(COALESCE(v_assignment_value, '[]'::jsonb)) LOOP
					IF (v_participant_map->>v_assignment_key) IS NOT NULL
						AND (v_match_map->>v_local_match_id) IS NOT NULL THEN
						INSERT INTO public.assignments (
							session_id,
							participant_id,
							match_id,
							created_at
						)
						VALUES (
							v_cloud_session_id,
							(v_participant_map->>v_assignment_key)::uuid,
							(v_match_map->>v_local_match_id)::uuid,
							v_session_saved_at
						) ON CONFLICT (session_id, participant_id, match_id) DO NOTHING;
					END IF;
				END LOOP;
			END LOOP;

			IF EXISTS (
				SELECT 1
				FROM jsonb_each(
						COALESCE(v_session->'playerAssignments', '{}'::jsonb)
					)
			) THEN
				INSERT INTO public.gameplay_events (
					session_id,
					sequence_number,
					actor_participant_id,
					event_type,
					idempotency_key,
					payload,
					created_at
				)
				VALUES (
					v_cloud_session_id,
					public.allocate_event_sequence(v_cloud_session_id),
					v_claimed_participant_id,
					'assignment_replaced',
					'legacy-import:assignments',
					jsonb_build_object(
						'assignments',
						COALESCE(v_session->'playerAssignments', '{}'::jsonb)
					),
					v_session_saved_at
				);
			END IF;

			IF NULLIF(v_session->>'commonMatchId', '') IS NOT NULL THEN
				v_common_match_id := (v_match_map->>(v_session->>'commonMatchId'))::uuid;

				IF v_common_match_id IS NOT NULL THEN
					UPDATE public.game_sessions
					SET common_match_id = v_common_match_id
					WHERE id = v_cloud_session_id;

					INSERT INTO public.gameplay_events (
						session_id,
						sequence_number,
						actor_participant_id,
						event_type,
						idempotency_key,
						payload,
						created_at
					)
					VALUES (
						v_cloud_session_id,
						public.allocate_event_sequence(v_cloud_session_id),
						v_claimed_participant_id,
						'common_match_selected',
						'legacy-import:common-match',
						jsonb_build_object(
							'localMatchId',
							v_session->>'commonMatchId',
							'cloudMatchId',
							v_common_match_id::text
						),
						v_session_saved_at
					);
				END IF;
			END IF;

			INSERT INTO public.gameplay_events (
				session_id,
				sequence_number,
				actor_participant_id,
				event_type,
				idempotency_key,
				payload,
				created_at
			)
			VALUES (
				v_cloud_session_id,
				public.allocate_event_sequence(v_cloud_session_id),
				v_claimed_participant_id,
				'session_completed',
				'legacy-import:session-completed',
				jsonb_build_object(
					'sourceFingerprint',
					v_source_fingerprint,
					'imported',
					TRUE
				),
				v_session_saved_at
			);

			UPDATE public.game_sessions
			SET state = 'completed',
				started_at = v_session_saved_at,
				completed_at = v_session_saved_at
			WHERE id = v_cloud_session_id;

			UPDATE private.legacy_history_import_sessions
			SET cloud_session_id = v_cloud_session_id,
				state = 'imported',
				error_message = NULL,
				updated_at = now()
			WHERE account_id = v_account_id
				AND source_fingerprint = v_source_fingerprint;

			v_results := v_results || jsonb_build_array(
				jsonb_build_object(
					'sourceLocalSessionId',
					v_session_local_id,
					'sourceFingerprint',
					v_source_fingerprint,
					'state',
					'imported',
					'cloudSessionId',
					v_cloud_session_id::text
				)
			);
			v_imported_count := v_imported_count + 1;
		EXCEPTION
			WHEN OTHERS THEN
				v_last_error := SQLERRM;

				UPDATE private.legacy_history_import_sessions
				SET cloud_session_id = NULL,
					state = 'failed',
					error_message = v_last_error,
					updated_at = now()
				WHERE account_id = v_account_id
					AND source_fingerprint = v_source_fingerprint;

				v_results := v_results || jsonb_build_array(
					jsonb_build_object(
						'sourceLocalSessionId',
						v_session_local_id,
						'sourceFingerprint',
						v_source_fingerprint,
						'state',
						'failed',
						'errorMessage',
						v_last_error
					)
				);
				v_failed_count := v_failed_count + 1;
				v_any_failure := TRUE;
		END;
	END LOOP;

	IF v_any_failure THEN
		UPDATE private.legacy_history_import_state
		SET state = 'failed',
			failed_at = now(),
			completed_at = NULL,
			last_error = COALESCE(
				v_last_error,
				'One or more legacy sessions failed to import.'
			),
			updated_at = now()
		WHERE account_id = v_account_id;
	ELSE
		UPDATE private.legacy_history_import_state
		SET state = 'completed',
			completed_at = now(),
			failed_at = NULL,
			last_error = NULL,
			updated_at = now()
		WHERE account_id = v_account_id;
	END IF;

	RETURN jsonb_build_object(
		'accountId',
		v_account_id::text,
		'importState',
		CASE
			WHEN v_any_failure THEN 'failed'
			ELSE 'completed'
		END,
		'claimedLocalParticipantId',
		p_claimed_local_participant_id,
		'summary',
		jsonb_build_object(
			'importedCount',
			v_imported_count,
			'skippedCount',
			v_skipped_count,
			'failedCount',
			v_failed_count
		),
		'sessions',
		v_results
	);
END;
$$;

REVOKE ALL ON FUNCTION private.import_legacy_history(text, jsonb)
FROM PUBLIC,
	anon;

GRANT EXECUTE ON FUNCTION private.import_legacy_history(text, jsonb) TO authenticated,
	service_role;

CREATE OR REPLACE FUNCTION public.import_legacy_history(
	claimed_local_participant_id text,
	sessions jsonb
) RETURNS jsonb LANGUAGE sql VOLATILE
SET search_path = '' AS $$
SELECT private.import_legacy_history(claimed_local_participant_id, sessions);
$$;

REVOKE ALL ON FUNCTION public.import_legacy_history(text, jsonb)
FROM PUBLIC,
	anon;

GRANT EXECUTE ON FUNCTION public.import_legacy_history(text, jsonb) TO authenticated,
	service_role;
