-- 019_history_read_models_history.sql
-- Completed history summaries and overview totals.
CREATE OR REPLACE VIEW public.completed_session_summaries WITH (security_invoker = true) AS
SELECT session_rollups.session_id,
    session_rollups.host_account_id,
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