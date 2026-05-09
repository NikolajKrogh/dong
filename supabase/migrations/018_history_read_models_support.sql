-- 018_history_read_models_support.sql
-- Shared private rollups for the history read models.
CREATE OR REPLACE VIEW private._history_account_display_names AS
SELECT accounts.id AS account_id,
    accounts.preferred_display_name
FROM public.accounts accounts;
CREATE OR REPLACE VIEW private._history_completed_sessions AS
SELECT game_sessions.id AS session_id,
    game_sessions.host_account_id,
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
    completed_sessions.host_account_id,
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